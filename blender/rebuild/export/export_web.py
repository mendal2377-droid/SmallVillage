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

data = {
    "version": "village-2027-phase4-1",
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
