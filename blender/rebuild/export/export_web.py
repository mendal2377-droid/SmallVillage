"""SmallVillage 2.0 — Phase 4 web export.

Run on a layout built with --export (all seasonal props kept, no Blender-only scatter):

  blender -b --factory-startup --python blender/rebuild/layout/build_layout.py -- --export --month 8
  blender -b blender/rebuild/layout/village_layout.blend --python blender/rebuild/export/export_web.py

Writes public/models/v2/:
  assets.glb    every kit mesh once (node name = kit name), Draco compressed, no materials
  static.glb    unique meshes: terrain, ponds, field parcels, the merged home quarter (materials named)
  village.json  instances per asset key, seasonal states and LODs, palette, crop calendar, sky presets,
                wires, viewpoints and anchors

Coordinates are converted to three.js (Y up): (x, y, z)_blender -> (x, z, -y).
"""
import json
import math
import os
import re
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REB = os.path.dirname(HERE)
sys.path[:0] = [os.path.join(REB, "kit"), os.path.join(REB, "layout"), REB]
import palette as PAL  # noqa: E402
import sky as SKY  # noqa: E402

REPO = os.path.dirname(os.path.dirname(REB))
OUT = os.path.join(REPO, "public", "models", "v2")
os.makedirs(OUT, exist_ok=True)


def t3(v):
    return [round(v[0], 3), round(v[2], 3), round(-v[1], 3)]


def select_only(objs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]


def export_glb(path, objs, materials):
    select_only(objs)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_materials=materials, export_extras=False,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                              export_draco_position_quantization=14, export_draco_normal_quantization=10,
                              export_draco_texcoord_quantization=12, export_animations=False, export_cameras=False,
                              export_lights=False)
    return os.path.getsize(path)


# ---------------------------------------------------------------- 1. kit assets

lib = bpy.data.collections["KIT library"]
lc = bpy.context.view_layer.layer_collection.children[lib.name]
lc.exclude = False
kit = [o for o in lib.objects if o.type == "MESH"]
for o in kit:
    o.location = (0, 0, 0)
    o.rotation_euler = (0, 0, 0)
    o.scale = (1, 1, 1)
size_assets = export_glb(os.path.join(OUT, "assets.glb"), kit, "NONE")
print("ASSETS", len(kit), size_assets)

# asset keys: drop "KIT ", split LOD suffix and the leafy/bare state
assets = {}
KEYRE = re.compile(r"^(.*?)(?: L(\d))?$")


def keyof(kitname):
    base = kitname[4:]
    m = KEYRE.match(base)
    base, lod = m.group(1), int(m.group(2) or 0)
    state = ""
    for st in ("leafy", "bare"):
        if f" {st}" in f" {base} ":
            state = st
            base = re.sub(rf"\b{st}\b", "{state}", base)
    return base, state, lod


for o in kit:
    k, st, lod = keyof(o.name)
    a = assets.setdefault(k, {"lods": {}, "months": {}, "kind": o.get("sv_kind", ""), "family": o.get("sv_family", "")})
    lods = a["lods"].setdefault(st, [])
    while len(lods) <= lod:
        lods.append(None)
    lods[lod] = o.name
    if o.get("sv_months"):
        a["months"][st] = [int(x) for x in str(o["sv_months"]).split(",")]
lc.exclude = True

# ---------------------------------------------------------------- 2. instances

skip_cols = {"clouds", "near-view scatter"}
inst = {}
seasonal = []
n_inst = 0
for o in bpy.data.objects:
    src = o.get("sv_src")
    if not src or o.name in lib.objects:
        continue
    if any(c.name in skip_cols for c in o.users_collection):
        continue
    k, st, lod = keyof(src)
    rec = t3(o.location) + [round(o.rotation_euler.z, 4), round(o.scale.x, 3), round(o.scale.y, 3), round(o.scale.z, 3)]
    lst = inst.setdefault(k, [])
    lst.append(rec)
    if o.get("sv_months") and o.get("sv_kind") not in ("tree", "crop"):
        seasonal.append([k, len(lst) - 1, [int(x) for x in str(o["sv_months"]).split(",")]])
    n_inst += 1
print("INSTANCES", n_inst, "keys", len(inst))

# ---------------------------------------------------------------- 3. static meshes

HOME_PREFIXES = ("VIDEO ", "MAP | Photo roofscape")


def toon_base(m):
    """Base colour of a toonified or palette material (for the merged home quarter)."""
    if not m or not m.node_tree:
        return (0.8, 0.8, 0.8, 1), 1.0
    g = next((n for n in m.node_tree.nodes if n.type == "GROUP"), None)
    alpha = 0.35 if any(n.type == "BSDF_TRANSPARENT" for n in m.node_tree.nodes) else 1.0
    if g and "Base" in g.inputs:
        return tuple(g.inputs["Base"].default_value), alpha
    p = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if p:
        return tuple(p.inputs["Base Color"].default_value), p.inputs["Alpha"].default_value
    return (0.8, 0.8, 0.8, 1), alpha


def web_material(m):
    name = (m.name if m else "none") + " web"
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    col, alpha = toon_base(m)
    w = bpy.data.materials.new(name)
    p = w.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = col
    p.inputs["Alpha"].default_value = alpha
    p.inputs["Roughness"].default_value = 1.0
    if alpha < 1:
        try:
            w.surface_render_method = "BLENDED"
        except AttributeError:
            pass
    return w


def merged_copy(objs, name):
    """Duplicate mesh objects with modifiers/transforms applied and join them into one object."""
    dg = bpy.context.evaluated_depsgraph_get()
    import bmesh
    bm = bmesh.new()
    mats, matmap = [], {}
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        me.transform(o.matrix_world)
        if o.matrix_world.determinant() < 0:
            me.flip_normals()
        idx = []
        for s in o.material_slots:
            key = s.material.name if s.material else "none"
            if key not in matmap:
                matmap[key] = len(mats)
                mats.append(s.material)
            idx.append(matmap[key])
        off = len(bm.faces)
        bm.from_mesh(me)
        bm.faces.ensure_lookup_table()
        for f in bm.faces[off:]:
            f.material_index = idx[f.material_index] if idx else 0
        ev.to_mesh_clear()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


home_objs = [o for o in bpy.data.objects if o.type == "MESH" and any(c.name.startswith(HOME_PREFIXES) for c in o.users_collection)]
home = merged_copy(home_objs, "home quarter")
for i, m in enumerate(list(home.data.materials)):
    home.data.materials[i] = web_material(m)
fields = merged_copy([o for o in bpy.data.objects if o.get("sv_kind") == "field"], "fields")
for i, m in enumerate(list(fields.data.materials)):
    nm = m.name.split(" m")[0]  # "SV field wheat-maize m8" -> "SV field wheat-maize"
    w = bpy.data.materials.get(nm) or bpy.data.materials.new(nm)
    fields.data.materials[i] = w
ground = bpy.data.objects["ground"]
ponds = [o for o in bpy.data.objects if o.get("sv_family") == "pond"]
static_objs = [home, fields, ground] + ponds
size_static = export_glb(os.path.join(OUT, "static.glb"), static_objs, "EXPORT")
print("STATIC", size_static, "home tris", sum(len(p.vertices) - 2 for p in home.data.polygons))

# ---------------------------------------------------------------- 4. wires, viewpoints, anchors

wires = []
w = bpy.data.objects.get("power wires")
if w:
    for sp in w.data.splines:
        pts = []
        for p in sp.points:
            pts += t3(w.matrix_world @ Vector(p.co[:3]))
        wires.append(pts)

views = {}
for o in bpy.data.objects:
    if o.type == "CAMERA" and (o.name.startswith("CAM ") or o.name.startswith("VIDEO A")):
        fw = o.matrix_world.to_3x3() @ Vector((0, 0, -1))
        nm = o.name[4:] if o.name.startswith("CAM ") else "home courtyard"
        if nm == "satellite":
            continue
        views[nm] = {"position": t3(o.matrix_world.translation), "target": t3(o.matrix_world.translation + fw * 30),
                     "ortho": o.data.type == "ORTHO"}

anchors = {}
d = bpy.data.objects.get("DREAM AREA anchor")
if d:
    anchors["dream"] = {"position": t3(d.location), "radius": d.get("sv_radius", 600.0)}
anchors["home"] = {"position": t3(Vector((-31.0, -110.0, 0.2)))}

# ---------------------------------------------------------------- 5. palette, crop calendar, sky

pal = {"grid": PAL.GRID, "slots": PAL.SLOTS,
       "seasons": {s: [list(PAL.color(sl, s)) for sl in PAL.SLOTS] for s in PAL.SEASONS}}
CROPS = {
    "wheat-maize": {10: ("soil", "wheat_seedling"), 11: ("wheat_seedling", "wheat_winter"), 12: ("wheat_winter", "soil"),
                    1: ("wheat_winter", "soil"), 2: ("wheat_winter", "soil"), 3: ("wheat_green", "wheat_winter"),
                    4: ("wheat_green", "wheat_heading"), 5: ("wheat_ripe", "wheat_heading"), 6: ("stubble", "maize_green"),
                    7: ("maize_green", "maize_dark"), 8: ("maize_green", "maize_dark"), 9: ("maize_dry", "maize_dry_d")},
}
CROPS["soybean"] = {m: (("bean", "soil") if m in (6, 7, 8, 9) else CROPS["wheat-maize"][m]) for m in range(1, 13)}
CROPS["vegetables"] = {m: (("garlic", "soil") if m in (10, 11, 12, 1, 2, 3, 4, 5) else ("bean", "soil")) for m in range(1, 13)}
SEASON_OF = {12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
             6: "summer", 7: "summer", 8: "summer", 9: "summer", 10: "autumn", 11: "autumn"}

# ---------------------------------------------------------------- 6. walking navigation, field parcels, road corridors

import layout_data as LD  # noqa: E402
import layout_geo as LG  # noqa: E402


def map_to3(p):
    x, y = LD.to_world(p)
    return x, -y


nav_boxes = []


def add_box(cx, cz, hx, hz, a=0.0, low=-100.0, high=100.0):
    nav_boxes.append([round(cx, 3), round(cz, 3), round(hx, 3), round(hz, 3), round(a, 4), low, high])


def kit_prop(src, prop, default=None):
    o = bpy.data.objects.get(src)
    return o.get(prop, default) if o else default


SOLID = {  # family -> (local centre x, local centre y, half x, half y, height) for single-footprint colliders
    "school": (17.0, 12.0, 19.0, 12.0, 8.0),
    "electric tricycle": (0.0, 0.4, 0.6, 1.1, 2.0), "walking tractor": (0.0, -0.4, 0.7, 2.0, 1.6),
    "tractor": (0.0, 0.2, 0.75, 1.3, 2.3), "combine harvester": (0.0, -0.8, 2.4, 3.6, 4.0), "handcart": (0.0, 0.9, 0.6, 1.9, 1.0),
    "transformer": (0.0, 0.0, 1.8, 0.5, 9.0), "well hut": (0.0, 0.0, 0.62, 0.62, 2.0), "wellhead": (0.0, 0.0, 0.35, 0.35, 0.7),
    "washing machine": (0.0, 0.0, 0.4, 0.25, 0.9), "laundry line": (0.0, 0.0, 1.85, 0.08, 1.9),
}
TRUNK = {"poplar": 0.22, "broadleaf": 0.3, "willow": 0.45, "conifer": 0.3, "hedge": 0.55,
         "utility pole": 0.18, "utility pole lamp": 0.18, "solar lamp": 0.15}
for o in bpy.data.objects:
    src = o.get("sv_src")
    if not src or o.name in lib.objects or any(c.name in skip_cols for c in o.users_collection):
        continue
    fam = kit_prop(src, "sv_family", "")
    a = o.rotation_euler.z
    ca, sa = math.cos(a), math.sin(a)
    sx = o.scale.x

    def local_to3(lx, ly):
        lx *= sx
        X = o.location.x + ca * lx - sa * ly
        Y = o.location.y + sa * lx + ca * ly
        return X, -Y

    if fam == "courtyard plot":
        W_, D_ = [float(v) for v in str(kit_prop(src, "sv_footprint", "12,18")).split(",")]
        cx, cz = local_to3(W_ / 2, D_ / 2)
        add_box(cx, cz, W_ / 2, D_ / 2, a, -100, 100)
    elif fam.startswith("house "):
        cx, cz = local_to3(5.5, 4.0)
        add_box(cx, cz, 5.5, 4.0, a, -100, 100)
    elif fam in SOLID:
        lx, ly, hx, hy, h = SOLID[fam]
        cx, cz = local_to3(lx, ly)
        add_box(cx, cz, hx, hy, a, -100, o.location.z + h)
    elif fam in TRUNK:
        r = TRUNK[fam]
        add_box(o.location.x, -o.location.y, r, r, 0.0, -100, 100)

# water: ditches and the canal as boxes along their lines, ponds as a grid inside the banks,
# leaving gaps wherever a road or a bridge crosses
roads3 = {n: {"width": R["width"], "pts": [list(map_to3(p)) for p in R["pts"]]} for n, R in LD.ROADS.items()}
bridges3 = [map_to3(p) for p, _ in LD.BRIDGES]


def crossing(x, z):
    if any(math.hypot(x - bx, z - bz) < 6 for bx, bz in bridges3):
        return True
    return any(LG.poly_dist((x, z), [tuple(q) for q in R["pts"]]) < R["width"] / 2 + 1.2 for R in roads3.values())


for lines, half in ((LD.DITCHES, 1.2), (LD.RIVERS, 5.0)):
    for L in lines.values():
        pts = [map_to3(p) for p in L["pts"]]
        for a3, b3 in zip(pts, pts[1:]):
            dx, dz = b3[0] - a3[0], b3[1] - a3[1]
            seg = math.hypot(dx, dz)
            n = max(1, int(seg / 4))
            ang = math.atan2(dz, dx)  # rotate the box's local X onto the segment direction
            for k in range(n):
                t = (k + 0.5) / n
                x, z = a3[0] + dx * t, a3[1] + dz * t
                if crossing(x, z):
                    continue
                # walk.js box: localX = c*dx - s*dz with a = -ang aligns local X with the segment
                add_box(x, z, seg / n / 2 + 0.3, half, -ang, -100, 0.6)
for P in LD.PONDS.values():
    ring = [map_to3(p) for p in P["pts"]]
    ring = LG.offset_poly(ring, 1.5)
    xs, zs = [p[0] for p in ring], [p[1] for p in ring]
    x = min(xs)
    while x < max(xs):
        z = min(zs)
        while z < max(zs):
            if LG.point_in_poly((x + 2, z + 2), ring):
                add_box(x + 2, z + 2, 2.2, 2.2, 0.0, -100, 0.6)
            z += 4
        x += 4

# the family house: reuse the original walk data (same coordinates) inside the home quarter
old = json.load(open(os.path.join(REPO, "public", "models", "navigation.json"), encoding="utf8"))["village"]
home_rects = []
for ob in home_objs:
    bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    if max(ob.dimensions) > 60:
        continue
    home_rects.append((min(v.x for v in bb) - 0.3, min(-v.y for v in bb) - 0.3, max(v.x for v in bb) + 0.3, max(-v.y for v in bb) + 0.3))


def in_home(x, z):
    return any(r[0] <= x <= r[2] and r[1] <= z <= r[3] for r in home_rects)


nav_boxes = [b for b in nav_boxes if not in_home(b[0], b[1])]
kept_old = [b for b in old["boxes"] if in_home(b[0], b[1])]
nav_boxes += kept_old
vc = map_to3((330, 330))
nav = {
    "boxes": nav_boxes,
    "surfaces": [s for s in old.get("surfaces", []) if in_home((s["rect"][0] + s["rect"][2]) / 2, (s["rect"][1] + s["rect"][3]) / 2)],
    "shelters": [s for s in old.get("shelters", []) if in_home((s["rect"][0] + s["rect"][2]) / 2, (s["rect"][1] + s["rect"][3]) / 2)],
    "ground": old.get("ground", 0.1),  # same base level as the original house walk data (steps stay reachable)
    "bounds": [round(vc[0] - 1500), round(vc[1] - 1500), round(vc[0] + 1500), round(vc[1] + 1500)],
    "spawn": [-31.0, 1.85, 110.0],
    "yaw": 0.0,
}
print("NAV boxes", len(nav_boxes), "old house boxes", len(kept_old), "surfaces", len(nav["surfaces"]))

field_rects = []
for o in bpy.data.objects:
    if o.get("sv_kind") == "field":
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        field_rects.append([round(min(v.x for v in bb), 2), round(min(-v.y for v in bb), 2), round(max(v.x for v in bb), 2),
                            round(max(-v.y for v in bb), 2), o.get("sv_crop", "wheat-maize")])

places = [{"id": pid, "zh": zh, "en": en, "kind": kind, "position": [round(v, 2) for v in map_to3(pt)],
           "look": [round(v, 2) for v in map_to3(look)]}
          for pid, zh, en, pt, kind, look in LD.PLACES]
msc = map_to3(LD.MAP_SHEET["center"])
map_sheet = {"center": [round(msc[0], 2), round(msc[1], 2)], "size": LD.MAP_SHEET["size"],
             "images": {s: f"/images/v2/map_{s}.webp" for s in ("spring", "summer", "autumn", "winter")}}

data = {
    "version": "village-2027-phase5-1",
    "places": places,
    "mapSheet": map_sheet,
    "nav": nav,
    "fields": field_rects,
    "roads": roads3,
    "units": "metres, three.js Y-up",
    "assets": assets,
    "instances": inst,
    "seasonal": seasonal,
    "palette": pal,
    "crops": {k: {str(m): v for m, v in t.items()} for k, t in CROPS.items()},
    "seasonOfMonth": {str(k): v for k, v in SEASON_OF.items()},
    "sky": SKY.PRESETS,
    "wires": wires,
    "views": views,
    "anchors": anchors,
    "ponds": {o.name: {"algae": o.get("sv_algae", 0.3)} for o in ponds},
}
with open(os.path.join(OUT, "village.json"), "w", encoding="utf8") as fh:
    json.dump(data, fh, separators=(",", ":"))
print("JSON", os.path.getsize(os.path.join(OUT, "village.json")))
print("DONE", OUT)
