"""SmallVillage 2.0 — Phase 3: lay out the real village from the satellite trace using the asset kit.

  blender -b --factory-startup --python blender/rebuild/layout/build_layout.py -- [--month 8] [--preset "summer afternoon"]
                                                                                  [--render all|overview,plan,...] [--preview]

Reads kit/sv_kit.blend (build it first) and the authoritative house collections; writes
layout/village_layout.blend and review renders in layout/renders. Neither source file is modified.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REB = os.path.dirname(HERE)
KITDIR = os.path.join(REB, "kit")
sys.path[:0] = [HERE, KITDIR, REB]
import kit_lib as K  # noqa: E402
import layout_data as D  # noqa: E402
import layout_geo as G  # noqa: E402
import palette as PAL  # noqa: E402
import sky as SKY  # noqa: E402
import style_lib as SL  # noqa: E402
from kit_buildings import PLOTS, MeshWriter  # noqa: E402
from kit_infra import WIRE_ATTACH, catenary  # noqa: E402

REPO = os.path.dirname(os.path.dirname(REB))
SOURCE = os.path.join(REPO, "blender", "video_revision", "Yanlaozhai_Video_House_and_Lane.blend")
KIT_BLEND = os.path.join(KITDIR, "sv_kit.blend")
OUT = os.path.join(HERE, "village_layout.blend")
RENDERS = os.path.join(HERE, "renders")

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


MONTH = int(arg("--month", 8))
PRESET = arg("--preset", "summer afternoon")
RENDER = arg("--render", "")
PREVIEW = "--preview" in argv
SEASON = {12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
          6: "summer", 7: "summer", 8: "summer", 9: "autumn", 10: "autumn", 11: "autumn"}[MONTH]
LEAFY = MONTH in (4, 5, 6, 7, 8, 9, 10)
rng = random.Random(2027)

HOME_W = Vector((*D.HOME_WORLD, 0))


def W(p, z=0.0):
    x, y = D.to_world(p)
    return Vector((x, y, z))


def to_map(x, y):
    return (x - D.HOME_WORLD[0] + D.HOME_MAP[0], -(y - D.HOME_WORLD[1]) + D.HOME_MAP[1])


def coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


# ---------------------------------------------------------------- setup and kit


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = "Village"
    r = sc.render
    r.engine = "BLENDER_EEVEE"
    r.resolution_x, r.resolution_y = (960, 540) if PREVIEW else (1920, 1080)
    sc.view_settings.view_transform = "Standard"
    sc.eevee.taa_render_samples = 24 if PREVIEW else 64
    sc.eevee.shadow_pool_size = "1024"
    with bpy.data.libraries.load(KIT_BLEND, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n.startswith("KIT ")]
    lib = coll("KIT library")
    for o in dst.objects:
        lib.objects.link(o)
        o.location = (0, 0, 0)
    vl = bpy.context.view_layer.layer_collection.children[lib.name]
    vl.exclude = True
    K.palette_images()
    K.set_season(SEASON)
    return sc, {o.name: o for o in dst.objects}


SRC = {}


def place(name, loc, rot=0.0, scale=(1, 1, 1), c=None, z=0.0):
    src = SRC[name]
    o = bpy.data.objects.new(name[4:] + " @", src.data)
    o.location = (loc[0], loc[1], loc[2] + z if len(loc) > 2 else z)
    o.rotation_euler = (0, 0, rot)
    o.scale = scale if isinstance(scale, tuple) else (scale, scale, scale)
    o["sv_src"] = name
    for k in ("sv_kind", "sv_family", "sv_state", "sv_months"):
        if k in src:
            o[k] = src[k]
    (c or bpy.context.scene.collection).objects.link(o)
    return o


def lod_for(p, near=220.0, far=700.0):
    d = (Vector((p[0], p[1], 0)) - HOME_W).length
    return 0 if d < near else (1 if d < far else 2)


# ---------------------------------------------------------------- obstacles (map coordinates)

HOME_RECTS = []


def road_items(include_lanes=True):
    for name, R in D.ROADS.items():
        if not include_lanes and R["width"] < 4:
            continue
        yield name, R


def blocked(rect, roads=True, margin=1.0):
    for e in D.EXCLUDE:
        if G.rects_overlap(rect, e, margin):
            return "exclude"
    for P in D.PONDS.values():
        if G.rect_poly_overlap(rect, P["pts"], 4.0):
            return "pond"
    for Dt in D.DITCHES.values():
        if G.rect_poly_dist(rect, Dt["pts"]) < 2.6:
            return "ditch"
    for Rv in D.RIVERS.values():
        if G.rect_poly_dist(rect, Rv["pts"]) < 6.5:
            return "river"
    if roads:
        for name, R in road_items():
            if G.rect_poly_dist(rect, R["pts"]) < R["width"] / 2 + 1.0:
                return "road"
    for h in HOME_RECTS:
        if G.rects_overlap(rect, h, 2.0):
            return "home"
    return None


# ---------------------------------------------------------------- terrain and water


def finish_mesh(name, bm, slots, c, meta=None):
    for f in bm.faces:
        f.normal_update()
        if f.normal.z < -0.01:
            f.normal_flip()
    o = K.finish(name, bm, slots, c, meta or {"sv_kind": "terrain"})
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def pond(c, name, P):
    """Pond bowl: water surface, sloping soil then grass bank up to ground level. Returns outer polygon (world)."""
    inner = [tuple(W(p)[:2]) for p in P["pts"]]
    mid = G.offset_poly(inner, 1.6)
    outer = G.offset_poly(inner, 4.0)
    collar = G.offset_poly(inner, 5.2)  # flat grass collar overlapping the ground's 1 m stair-stepped hole edge
    bm = bmesh.new()
    n = len(inner)
    wv = [bm.verts.new((x, y, -0.7)) for x, y in inner]
    bm.faces.new(wv).material_index = 0
    rings = [([Vector((x, y, -0.7)) for x, y in inner], 1), ([Vector((x, y, -0.25)) for x, y in mid], 2),
             ([Vector((x, y, 0.005)) for x, y in outer], 2), ([Vector((x, y, 0.005)) for x, y in collar], None)]
    for (ra, slot), (rb, _) in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            vs = [bm.verts.new(ra[i]), bm.verts.new(rb[i]), bm.verts.new(rb[j]), bm.verts.new(ra[j])]
            bm.faces.new(vs).material_index = slot
    o = finish_mesh("pond " + name, bm, ["water", "soil", "grass"], c, {"sv_kind": "water", "sv_family": "pond", "sv_algae": P["algae"]})
    # painted water surface for renders (the web uses its own water shader on 'water' faces)
    wm = SL.water_material("SV pond water " + name, (0.06, 0.20, 0.17, 1), (0.30, 0.48, 0.45, 1),
                           algae=(0.50, 0.64, 0.16, 1), algae_amount=P["algae"])  # duckweed: yellower than grass
    o.data.materials.append(wm)
    for p in o.data.polygons:
        if p.index == 0:
            p.material_index = 1
    return outer


def chain(c, pts_world, src_name, module_len, z=0.0, lod_auto=False, name_fn=None):
    """Lay linear kit modules (local +Y, length module_len) along a world polyline."""
    out = []
    for a, b in zip(pts_world, pts_world[1:]):
        a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
        d = b - a
        L = d.length
        if L < 0.5:
            continue
        n = max(1, round(L / module_len))
        s = L / (n * module_len)
        rot = math.atan2(d.y, d.x) - math.pi / 2
        for k in range(n):
            p = a + d.normalized() * (k * module_len * s)
            nm = name_fn(p) if name_fn else src_name
            out.append(place(nm, p, rot, (1, s, 1), c, z=z))
    return out


def cutter_strip(m, pts_world, hw):
    for a, b in zip(pts_world, pts_world[1:]):
        a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
        d = b - a
        L = d.length
        mid = (a + b) / 2
        m.push((mid.x, mid.y, -1.0), math.atan2(d.y, d.x))
        m.box((0, 0, 0), (L + 0.6, 2 * hw, 4.0), "soil")
        m.pop()


def terrain_and_water(c):
    cut = MeshWriter(0)
    for name, P in D.PONDS.items():
        outer = pond(c, name, P)
        # prism of the outer bank polygon
        bm = cut.bm
        vb = [bm.verts.new((x, y, -3.0)) for x, y in outer]
        vt = [bm.verts.new((x, y, 1.0)) for x, y in outer]
        bm.faces.new(vb[::-1])
        bm.faces.new(vt)
        for i in range(len(outer)):
            j = (i + 1) % len(outer)
            bm.faces.new((vb[i], vb[j], vt[j], vt[i]))
    for name, Dt in D.DITCHES.items():
        pts = [tuple(W(p)[:2]) for p in Dt["pts"]]
        chain(c, pts, "KIT ditch wet L0" if Dt["water"] else "KIT ditch dry L0", 5.0, z=0.004)
        cutter_strip(cut, pts, 1.15)
    for name, Rv in D.RIVERS.items():
        pts = [tuple(W(p)[:2]) for p in Rv["pts"]]
        chain(c, pts, "KIT river L0", 10.0, z=0.004)
        cutter_strip(cut, pts, 5.3)
    cut.bm.free()  # the cutter volumes are only kept as documentation of the old boolean approach
    return ground_grid(c)


def water_sdf():
    """Signed distance (world metres) to open water: negative inside a pond bank cut, ditch or canal channel."""
    feats = []
    for P in D.PONDS.values():
        ring = G.offset_poly([tuple(W(q)[:2]) for q in P["pts"]], 4.0)
        feats.append(("poly", ring))
    for Dt in D.DITCHES.values():
        feats.append(("line", [tuple(W(q)[:2]) for q in Dt["pts"]], 1.15))
    for Rv in D.RIVERS.values():
        feats.append(("line", [tuple(W(q)[:2]) for q in Rv["pts"]], 5.3))

    def sdf(p):
        best = 1e9
        for f in feats:
            if f[0] == "poly":
                ring = f[1]
                d = G.poly_dist(p, ring + [ring[0]])
                d = -d if G.point_in_poly(p, ring) else d
            else:
                d = G.poly_dist(p, f[1]) - f[2]
            best = min(best, d)
        return best
    return sdf


def ground_grid(c, half=1400.0, coarse=100.0, fine=1.0):
    """Ground as an adaptive quadtree: big quads on open land, 1 m cells along water edges, no cells in water."""
    sdf = water_sdf()
    bm = bmesh.new()
    stack = []
    n = int(2 * half / coarse)
    for i in range(n):
        for j in range(n):
            stack.append((-half + i * coarse, -half + j * coarse, coarse))
    kept = 0
    while stack:
        x, y, s = stack.pop()
        cx, cy = x + s / 2, y + s / 2
        d = sdf((cx, cy))
        hd = s * 0.7072
        if d > hd:
            inside = False
        elif d < -hd:
            continue  # all water
        elif s > fine:
            h = s / 2
            stack += [(x, y, h), (x + h, y, h), (x, y + h, h), (x + h, y + h, h)]
            continue
        elif d < 0:
            continue  # finest cell whose centre is in water
        vs = [bm.verts.new((x, y, 0)), bm.verts.new((x + s, y, 0)), bm.verts.new((x + s, y + s, 0)), bm.verts.new((x, y + s, 0))]
        bm.faces.new(vs)
        kept += 1
    # open land beyond the detailed square
    R = 3600.0
    for (x0, y0, x1, y1) in ((-R, -R, R, -half), (-R, half, R, R), (-R, -half, -half, half), (half, -half, R, half)):
        vs = [bm.verts.new((x0, y0, 0)), bm.verts.new((x1, y0, 0)), bm.verts.new((x1, y1, 0)), bm.verts.new((x0, y1, 0))]
        bm.faces.new(vs)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.001)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts[:], edges=bm.edges[:])
    print("GROUND cells", kept, "faces after merge", len(bm.faces))
    return finish_mesh("ground", bm, ["grass"], c)


# ---------------------------------------------------------------- roads and bridges


ROAD_SRC = {4.5: "KIT road main", 3.0: "KIT road lane", 2.4: "KIT road field"}


def roads(c):
    for name, R in D.ROADS.items():
        pts = [tuple(W(p)[:2]) for p in R["pts"]]
        if R.get("kind") == "field":
            chain(c, pts, "KIT field path L0", 5.0, z=0.0)
            continue
        base = ROAD_SRC[R["width"]]
        z = 0.0 if R["width"] >= 4 else 0.003
        chain(c, pts, None, 5.0, z=z, name_fn=lambda p, base=base: f"{base} L{min(1, lod_for(p))}")


def bridges(c):
    for p, kind in D.BRIDGES:
        lines = D.RIVERS if kind == "river" else D.DITCHES
        best = None
        for L in lines.values():
            for a, b in zip(L["pts"], L["pts"][1:]):
                dd = G.seg_dist(p, a, b)
                if best is None or dd < best[0]:
                    best = (dd, a, b)
        _, a, b = best
        wa, wb = W(a), W(b)
        d = wb - wa
        rot = math.atan2(d.y, d.x) - math.pi / 2
        place("KIT river bridge L0" if kind == "river" else "KIT culvert bridge L0", W(p), rot, (1, 1, 1), c, z=0.0)


# ---------------------------------------------------------------- housing

PLOT_WEIGHTS = {"home_like": 2, "grey_two": 3, "white_three": 1.5, "old_brick": 1.5, "pink_pitched": 1,
                "cream_two": 2, "brick_two": 2, "grey_pitched": 1.5}


def pick_plot():
    total = sum(PLOT_WEIGHTS.values())
    r = rng.uniform(0, total)
    for k, w in PLOT_WEIGHTS.items():
        r -= w
        if r <= 0:
            return k
    return "grey_two"


def tree_name(family, variant=None, lod=0):
    if family == "poplar":
        v = rng.randrange(3) if variant is None else variant
        return f"KIT poplar {v} {'leafy' if LEAFY else 'bare'} L{lod}"
    if family == "broadleaf":
        v = rng.randrange(3) if variant is None else variant
        return f"KIT broadleaf {v} {'leafy' if LEAFY else 'bare'} L{lod}"
    if family == "willow":
        v = rng.randrange(2) if variant is None else variant
        return f"KIT willow {v} {'leafy' if MONTH not in (12, 1, 2) else 'bare'} L{lod}"
    raise KeyError(family)


def housing(c, trees):
    lanes = []
    stats = {"plots": 0, "gardens": 0}
    for region, (x0, y0, x1, y1) in D.HOUSING.items():
        yl = y1 - 1.5
        while yl - 1.5 - 17 >= y0:
            x = x0 + rng.uniform(0, 2)
            row_x = []
            while x + 11 <= x1:
                v = pick_plot()
                Wd, Dp = PLOTS[v]["W"], PLOTS[v]["D"]
                if yl - 1.5 - Dp < y0 - 1:
                    Dp = 16
                    v = "grey_pitched"
                    Wd = PLOTS[v]["W"]
                rect = (x, yl - 1.5 - Dp, x + Wd, yl - 1.5)
                why = blocked(rect)
                if why in ("home", "exclude", "pond"):
                    # shallow infill: a standalone 11 x 8 m house block straight onto the lane
                    small = (x, yl - 1.5 - 8.0, x + 11.0, yl - 1.5)
                    if not blocked(small):
                        fac = rng.choice(["grey 2F flat", "white 3F flat", "cream 2F flat", "brick 1F tile", "pink 1F tile"])
                        p = W((x, yl - 1.5))
                        place(f"KIT house {fac} L{min(1, lod_for(p))}", p, 0.0, (1, 1, 1), c)
                        stats["infill"] = stats.get("infill", 0) + 1
                        row_x.append((x, x + 11.0))
                        x += 11.0 + rng.uniform(0.5, 2.0)
                        continue
                if why:
                    x += 3.0
                    continue
                p = W((x, yl - 1.5))
                lod = min(1, lod_for(p))
                if rng.random() < 0.1:
                    # vegetable garden with yard trees instead of a house
                    for k in range(rng.randint(2, 3)):
                        q = W((x + rng.uniform(1, Wd - 1), yl - 1.5 - rng.uniform(2, Dp - 2)))
                        place(tree_name("broadleaf", lod=lod), q, rng.uniform(0, 6.28), rng.uniform(0.8, 1.2), trees)
                    stats["gardens"] += 1
                else:
                    mirror = rng.random() < 0.5
                    loc = W((x + Wd, yl - 1.5)) if mirror else p
                    place(f"KIT plot {v} L{lod}", loc, 0.0, (-1, 1, 1) if mirror else (1, 1, 1), c)
                    stats["plots"] += 1
                    if rng.random() < 0.35:
                        q = W((x + rng.uniform(0, Wd), yl - 1.5 - Dp - rng.uniform(0.5, 2.5)))
                        place(tree_name("broadleaf", lod=lod), q, rng.uniform(0, 6.28), rng.uniform(0.8, 1.15), trees)
                row_x.append((x, x + Wd))
                x += Wd + rng.uniform(0.0, 1.2)
            if row_x:
                lanes.append(((row_x[0][0] - 1.5, yl), (row_x[-1][1] + 1.5, yl)))
            yl -= D.LANE_SPACING
    # lanes in front of each row, clipped where they meet water or the home quarter
    for (a, b) in lanes:
        segs, cur = [], []
        n = max(2, int((b[0] - a[0]) / 2.5))
        for i in range(n + 1):
            q = (a[0] + (b[0] - a[0]) * i / n, a[1])
            r = (q[0] - 1.5, q[1] - 1.5, q[0] + 1.5, q[1] + 1.5)
            ok = blocked(r, roads=False, margin=0.0) is None
            if ok:
                cur.append(q)
            elif cur:
                segs.append(cur)
                cur = []
        if cur:
            segs.append(cur)
        for s in segs:
            if len(s) >= 2 and s[-1][0] - s[0][0] > 4:
                chain(c, [tuple(W(s[0])[:2]), tuple(W(s[-1])[:2])], None, 5.0, z=0.003,
                      name_fn=lambda p: f"KIT road lane L{min(1, lod_for(p))}")
    return stats


def school(c):
    cx, cy = W(D.SCHOOL["center"])[:2]
    place("KIT school L0", (cx - 19, cy - 12, 0), 0.0, (1, 1, 1), c)


# ---------------------------------------------------------------- the family house (authoritative reconstruction)

HOME_COLLECTIONS = [
    "VIDEO 00 | Filmed house - architecture",
    "VIDEO 01 | Brick alley and neighboring walls",
    "VIDEO 03 | Ivy weeds and cut branches",
    "VIDEO 05 | Clean interiors and walkable stairs",
    "MAP | Photo roofscape",
]


def toonify(m):
    if not m or not m.node_tree or m.get("sv_toon"):
        return
    p = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not p:
        return
    alpha = p.inputs["Alpha"].default_value
    trans = p.inputs["Transmission Weight"].default_value
    bc = p.inputs["Base Color"]
    col = tuple(bc.default_value)
    if bc.links and bc.links[0].from_node.type == "VALTORGB":
        cs = [e.color for e in bc.links[0].from_node.color_ramp.elements]
        col = tuple(sum(cc[i] for cc in cs) / len(cs) for i in range(3)) + (1,)
    col = tuple(min(1.0, (v ** 0.85) * 1.15) for v in col[:3]) + (1,)
    if alpha < 0.6 or trans > 0.05:
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        g = nt.nodes.new("ShaderNodeGroup")
        g.node_tree = SL.toon_group()
        g.inputs["Base"].default_value = (0.40, 0.58, 0.60, 1)
        g.inputs["Shadow Tint"].default_value = SL.SHADOW_TINT
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        mx = nt.nodes.new("ShaderNodeMixShader")
        mx.inputs["Fac"].default_value = 0.35
        nt.links.new(tr.outputs[0], mx.inputs[1])
        nt.links.new(g.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], out.inputs["Surface"])
        try:
            m.surface_render_method = "BLENDED"
        except AttributeError:
            pass
    else:
        SL.build_toon_nodes(m, col, var=1.2)
    m["sv_toon"] = True


def home_quarter():
    with bpy.data.libraries.load(SOURCE, link=False) as (src, dst):
        dst.collections = [n for n in HOME_COLLECTIONS if n in src.collections]
        dst.objects = [n for n in src.objects if n.startswith(("VIDEO A |", "VIDEO D |"))]
    root = coll("HOME family house (authoritative)")
    for cl in dst.collections:
        root.children.link(cl)
    cams = {}
    for o in dst.objects:
        if o and o.type == "CAMERA":
            root.objects.link(o)
            cams[o.name] = o
    mats = {m for cl in dst.collections for o in cl.all_objects if o.type == "MESH" for m in o.data.materials if m}
    for m in mats:
        toonify(m)
    bpy.context.view_layer.update()
    for cl in dst.collections:
        for o in cl.all_objects:
            if o.type != "MESH" or max(o.dimensions) > 60:
                continue
            xs = [(o.matrix_world @ Vector(cn)) for cn in o.bound_box]
            mx0, my0 = to_map(min(v.x for v in xs), max(v.y for v in xs))
            mx1, my1 = to_map(max(v.x for v in xs), min(v.y for v in xs))
            HOME_RECTS.append((mx0, my0, mx1, my1))
    return cams


# ---------------------------------------------------------------- vegetation, fields, utilities


def in_housing(p, margin=8.0):
    return any(x0 - margin <= p[0] <= x1 + margin and y0 - margin <= p[1] <= y1 + margin for x0, y0, x1, y1 in D.HOUSING.values())


def avenues(trees):
    n = 0
    for rname in D.AVENUES:
        R = D.ROADS[rname]
        others = [o for k, o in D.ROADS.items() if k != rname]
        for side in (-1, 1):
            for x, y, ang in G.walk(R["pts"], 4.3, side * (R["width"] / 2 + 1.25), start=rng.uniform(0, 2)):
                if in_housing((x, y)) or blocked((x - 0.5, y - 0.5, x + 0.5, y + 0.5), roads=False, margin=0.0):
                    continue
                if any(G.poly_dist((x, y), o["pts"]) < o["width"] / 2 + 2.0 for o in others):
                    continue
                p = W((x + rng.uniform(-0.15, 0.15), y + rng.uniform(-0.3, 0.3)))
                place(tree_name("poplar", lod=lod_for(p)), p, rng.uniform(0, 6.28), rng.uniform(0.9, 1.1), trees)
                n += 1
    return n


def village_trees(trees):
    n = 0
    # poplar line along the central ditch
    for x, y, ang in G.walk(D.DITCHES["central ditch"]["pts"], 6.0, 2.8):
        if blocked((x - 0.4, y - 0.4, x + 0.4, y + 0.4), roads=True, margin=0.0) in ("road", "pond"):
            continue
        p = W((x, y))
        place(tree_name("poplar", lod=lod_for(p)), p, rng.uniform(0, 6.28), rng.uniform(0.85, 1.05), trees)
        n += 1
    # willows and yard trees around the ponds
    for name, P in D.PONDS.items():
        ring = G.offset_poly([tuple(W(q)[:2]) for q in P["pts"]], 5.5)
        for i, (x, y) in enumerate(ring):
            if rng.random() < 0.55:
                fam = "willow" if rng.random() < 0.6 else "broadleaf"
                place(tree_name(fam, lod=lod_for((x, y))), (x, y, 0), rng.uniform(0, 6.28), rng.uniform(0.9, 1.2), trees)
                n += 1
    # dense shelterbelt west of the village (satellite)
    for pts, kind, rows in D.TREE_BELTS:
        if kind != "shelterbelt":
            continue
        for r in range(rows):
            for x, y, ang in G.walk(pts, 4.0, (r - rows / 2) * 4.5, start=rng.uniform(0, 2)):
                p = W((x, y))
                place(tree_name("poplar", lod=lod_for(p)), p, rng.uniform(0, 6.28), rng.uniform(0.9, 1.15), trees)
                n += 1
    return n


def field_material(kind):
    """Striped field ground colour for the chosen month (crop rotation: winter wheat then summer maize)."""
    m = MONTH
    if kind == "wheat-maize":
        stage = {10: ("soil", "wheat_seedling"), 11: ("wheat_seedling", "wheat_winter"), 12: ("wheat_winter", "soil"),
                 1: ("wheat_winter", "soil"), 2: ("wheat_winter", "soil"), 3: ("wheat_green", "wheat_winter"),
                 4: ("wheat_green", "wheat_heading"), 5: ("wheat_ripe", "wheat_heading"), 6: ("stubble", "maize_green"),
                 7: ("maize_green", "maize_dark"), 8: ("maize_green", "maize_dark"), 9: ("maize_dry", "maize_dry_d")}[m]
    elif kind == "soybean":
        stage = ("bean", "soil") if m in (6, 7, 8, 9) else ({10: ("soil", "wheat_seedling")}.get(m, ("wheat_winter", "soil")))
    else:  # vegetables / garlic
        stage = ("garlic", "soil") if m in (10, 11, 12, 1, 2, 3, 4, 5) else ("bean", "soil")
    name = f"SV field {kind} m{m}"
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    a = (*PAL.color(stage[0], SEASON), 1)
    b = (*PAL.color(stage[1], SEASON), 1)
    mat = SL.striped_field_material(name, a, b, stripe_scale=1.2, along="X")
    return mat


def fields(c, huts):
    ex0, ey0, ex1, ey1 = D.FIELD_EXTENT
    sw, sl = D.FIELD_STRIP
    cells = []
    y = ey0
    while y < ey1:
        x = ex0
        while x < ex1:
            cells.append((x, y, x + sw, y + sl))
            x += sw
        y += sl
    kept = []
    while cells:
        r = cells.pop()
        x0, y0, x1, y1 = r
        # roads may cross fields (they sit above the parcels); water, ponds and the village may not
        bad = in_housing(((x0 + x1) / 2, (y0 + y1) / 2), margin=0) or blocked(r, roads=False, margin=0.5) is not None \
            or any(G.rects_overlap(r, h, 6.0) for h in D.HOUSING.values())
        if not bad:
            kept.append(r)
        elif (x1 - x0) > 10 and (y1 - y0) > 10:
            mx, my = (x0 + x1) / 2, (y0 + y1) / 2
            if (y1 - y0) > 3 * (x1 - x0):
                cells += [(x0, y0, x1, my), (x0, my, x1, y1)]
            else:
                cells += [(x0, y0, mx, my), (mx, y0, x1, my), (x0, my, mx, y1), (mx, my, x1, y1)]
    parcels = []
    for r in kept:
        u = rng.random()
        kind = "wheat-maize" if u < 0.85 else ("soybean" if u < 0.93 else "vegetables")
        parcels.append((r, kind))
        x0, y0, x1, y1 = r
        a, b = W((x0 + 0.3, y1 - 0.3)), W((x1 - 0.3, y0 + 0.3))
        bm = bmesh.new()
        vs = [bm.verts.new((a.x, a.y, 0.02)), bm.verts.new((b.x, a.y, 0.02)), bm.verts.new((b.x, b.y, 0.02)), bm.verts.new((a.x, b.y, 0.02))]
        bm.faces.new(vs)
        me = bpy.data.meshes.new("field")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(field_material(kind))
        o = bpy.data.objects.new("field " + kind, me)
        o["sv_kind"] = "field"
        o["sv_crop"] = kind
        c.objects.link(o)
        # irrigation well huts and stakes on the large parcels
        if (x1 - x0) >= sw - 1 and (y1 - y0) >= sl - 1 and rng.random() < 0.3:
            hp = W((x0 + 1.5, (y0 + y1) / 2 + rng.uniform(-60, 60)))
            place(f"KIT well hut {rng.randrange(2)} L{min(1, lod_for(hp))}", hp, rng.choice((0, math.pi / 2)), (1, 1, 1), huts)
            for k in range(2):
                sp = W((x0 + rng.uniform(2, sw - 2), y0 + rng.uniform(10, sl - 10)))
                place(f"KIT field stake {rng.randrange(2)}", sp, 0.0, (1, 1, 1), huts)
    return parcels


def utilities(c):
    wires = []
    for rname in ("main road", "east road"):
        R = D.ROADS[rname]
        poles = []
        for x, y, ang in G.walk(R["pts"], 42.0, -(R["width"] / 2 + 2.6), start=10):
            if blocked((x - 0.4, y - 0.4, x + 0.4, y + 0.4), roads=False, margin=0.0):
                continue
            p = W((x, y))
            wang = -ang  # map y points south: flip the travel angle into world space
            o = place(f"KIT utility pole L{min(1, lod_for(p))}", p, wang + math.pi / 2, (1, 1, 1), c)
            poles.append(o)
        for a, b in zip(poles, poles[1:]):
            if (a.location - b.location).length > 70:
                continue
            for x, z in WIRE_ATTACH:
                pa = a.matrix_basis @ Vector((x, 0, z))
                pb = b.matrix_basis @ Vector((x, 0, z))
                wires.append(catenary(pa, pb, sag=0.8))
    cu = bpy.data.curves.new("wires", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.012
    for pts in wires:
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            sp.points[i].co = (p.x, p.y, p.z, 1)
    cu.materials.append(SL.toon("SV wire", (0.03, 0.03, 0.03, 1)))
    o = bpy.data.objects.new("power wires", cu)
    o["sv_kind"] = "wires"
    c.objects.link(o)
    place("KIT transformer L0", W((362, 262)), 0.0, (1, 1, 1), c)
    for x, y, ang in G.walk(D.ROADS["main road"]["pts"][1:6], 35.0, D.ROADS["main road"]["width"] / 2 + 1.6, start=5):
        p = W((x, y))
        place(f"KIT solar lamp L{min(1, lod_for(p))}", p, -ang - math.pi / 2, (1, 1, 1), c)
    return len(wires)


def horizon(c):
    center = W((330, 330))
    n = 0
    for k in range(9):
        a = 2 * math.pi * k / 9 + rng.uniform(-0.15, 0.15)
        rad = rng.uniform(1900, 2600)
        p = center + Vector((math.cos(a), math.sin(a), 0)) * rad
        u = (center - p).normalized()
        th = math.atan2(u.x, -u.y)
        L = 400.0
        loc = p - Vector((math.cos(th), math.sin(th), 0)) * L / 2
        place(f"KIT distant village {rng.randrange(3)} {'leafy' if LEAFY else 'bare'}" if LEAFY else "KIT distant village 0 bare",
              loc, th, (1, 1, 1), c)
        n += 1
    for k in range(14):
        a = rng.uniform(0, 2 * math.pi)
        rad = rng.uniform(650, 1500)
        p = center + Vector((math.cos(a), math.sin(a), 0)) * rad
        place(f"KIT shelterbelt {'leafy' if LEAFY else 'bare'} {rng.randrange(2)}", p, rng.choice((0.0, math.pi / 2)), (1, 1, 1), c)
    for k in range(26):
        a = rng.uniform(0, 2 * math.pi)
        rad = rng.uniform(380, 1600)
        p = center + Vector((math.cos(a), math.sin(a), 0)) * rad
        if in_housing(to_map(p.x, p.y), margin=20):
            continue
        place(f"KIT poplar clump {'leafy' if LEAFY else 'bare'} {rng.randrange(2)}", p, rng.uniform(0, 6.28), (1, 1, 1), c)
    return n


# ---------------------------------------------------------------- second pass: groves, home dressing, near scatter

def groves(trees):
    n = 0
    for (x0, y0, x1, y1) in D.GROVES:
        count = int((x1 - x0) * (y1 - y0) / 45)
        for k in range(count):
            q = (rng.uniform(x0 + 2, x1 - 2), rng.uniform(y0 + 2, y1 - 2))
            if any(G.poly_dist(q, R["pts"]) < R["width"] / 2 + 2 for R in D.ROADS.values()):
                continue
            p = W(q)
            fam = "broadleaf" if rng.random() < 0.7 else "poplar"
            place(tree_name(fam, lod=lod_for(p)), p, rng.uniform(0, 6.28), rng.uniform(0.8, 1.25), trees)
            n += 1
    return n


def floor_at(x, y, top=2.6):
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, *_ = bpy.context.scene.ray_cast(dg, Vector((x, y, top)), Vector((0, 0, -1)))
    return loc.z if hit else 0.19


# the courtyard slab spans x -37.2..-24.8, y -117.3..-101.8: house to the north, kitchen and entry to the west,
# blue shed to the east. Props follow the courtyard photos and videos (tidy, but lived in).
HOME_PROPS = [
    # (kit asset, world x, world y, rotation, months or None, ray start height)
    ("KIT washing machine", -33.2, -107.7, 0.0, None, 2.6),
    ("KIT stool red", -31.0, -108.7, 0.3, None, 2.6),
    ("KIT stool green", -30.3, -109.3, 1.1, None, 2.6),
    ("KIT kid chair green", -32.6, -109.1, 2.6, None, 2.6),
    ("KIT basin red", -29.4, -110.6, 0.0, None, 2.6),
    ("KIT basin pink", -29.0, -111.3, 0.0, None, 2.6),
    ("KIT basin blue", -32.9, -112.3, 0.0, None, 2.6),
    ("KIT laundry line", -31.7, -114.6, 0.0, None, 2.6),
    ("KIT drying rack", -29.6, -113.4, 0.4, None, 2.6),
    ("KIT umbrella open", -33.1, -110.6, 0.6, None, 2.6),
    ("KIT potted plant 0", -28.7, -107.5, 0.0, None, 2.6),
    ("KIT potted plant 1", -28.7, -108.4, 0.0, None, 2.6),
    ("KIT bamboo broom", -34.0, -112.9, 1.57, None, 2.6),
    ("KIT stalk pile 0", -29.1, -116.3, 0.3, None, 2.6),
    ("KIT electric tricycle L0", -26.5, -110.6, 1.5708, None, 2.6),
    ("KIT e-scooter L0", -38.9, -115.6, 0.05, None, 2.6),
    ("KIT corn drying", -31.2, -112.0, 0.0, (9, 10), 2.6),
    ("KIT corn cob pile", -29.3, -115.6, 0.0, (9, 10, 11), 2.6),
    ("KIT urns", -35.8, -109.8, 0.0, None, 6.5),
    ("KIT satellite dish", -35.3, -108.2, 2.2, None, 6.5),
]


def home_dressing(c):
    bpy.context.view_layer.update()
    n = 0
    for name, x, y, rot, months, top in HOME_PROPS:
        if months and MONTH not in months:
            continue
        place(name, (x, y, floor_at(x, y, top)), rot, (1, 1, 1), c)
        n += 1
    if MONTH in (9, 10, 11, 12, 1, 2):  # strings of chillies drying under the eaves
        for k, x in enumerate((-32.3, -31.9)):
            place("KIT chilli string", (x, -106.3, 1.75), 0.0, (1, 1, 1), c)
            n += 1
    return n


def crop_src(kind, lod):
    m = MONTH
    wheat_maize = {10: "wheat seedling", 11: "wheat seedling", 12: "wheat winter", 1: "wheat winter", 2: "wheat winter",
                   3: "wheat jointing", 4: "wheat jointing", 5: "wheat ripe", 6: "maize seedling 0", 7: "maize knee 0",
                   8: "maize tall 0", 9: "maize dry 0"}
    if kind == "soybean" and m in (6, 7, 8, 9):
        return "KIT soybean L0", (4.0, 2.0)
    if kind == "vegetables":
        return "KIT garlic L0", (10.0, 4.0)
    st = wheat_maize[m]
    dens = (2.5, 1.5) if st.startswith("maize") else (10.0, 4.0)
    return f"KIT {st} L{lod}", dens


HOTSPOTS = [(599, 700), (565, 400), (250, 266), (404, 131)]  # avenue, home, main road, north pond (map)


def _clip(r, q):
    x0, y0 = max(r[0], q[0]), max(r[1], q[1])
    x1, y1 = min(r[2], q[2]), min(r[3], q[3])
    return (x0, y0, x1, y1) if x1 - x0 > 0.5 and y1 - y0 > 0.5 else None


def _plane(name, rects_map, c, z=0.02):
    bm = bmesh.new()
    for (x0, y0, x1, y1) in rects_map:
        a, b = W((x0, y1)), W((x1, y0))
        vs = [bm.verts.new((a.x, a.y, z)), bm.verts.new((b.x, a.y, z)), bm.verts.new((b.x, b.y, z)), bm.verts.new((a.x, b.y, z))]
        bm.faces.new(vs)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o["sv_kind"] = "scatter"
    c.objects.link(o)
    return o


def _quads_plane(name, quads_map, c, z=0.03):
    bm = bmesh.new()
    for quad in quads_map:
        vs = [bm.verts.new((*W(q)[:2], z)) for q in quad]
        f = bm.faces.new(vs)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o["sv_kind"] = "scatter"
    c.objects.link(o)
    return o


def clear_of_roads(rect, min_size=2.0):
    """Split a map rectangle into pieces that keep clear of every road corridor (road, shoulder and tree line)."""
    out, stack = [], [rect]
    while stack:
        r = stack.pop()
        near = min(G.rect_poly_dist(r, R["pts"], samples=2) - (R["width"] / 2 + 2.4) for R in D.ROADS.values())
        if near > 0:
            out.append(r)
            continue
        x0, y0, x1, y1 = r
        if max(x1 - x0, y1 - y0) <= min_size:
            continue
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        if (x1 - x0) > 2 * (y1 - y0):
            stack += [(x0, y0, mx, y1), (mx, y0, x1, y1)]
        elif (y1 - y0) > 2 * (x1 - x0):
            stack += [(x0, y0, x1, my), (x0, my, x1, y1)]
        else:
            stack += [(x0, y0, mx, my), (mx, y0, x1, my), (x0, my, mx, y1), (mx, my, x1, y1)]
    return out


def scatter_near(c, parcels):
    """Crops at the month's growth stage and verge grass/flowers around the ground-level views only
    (the web build scatters crops at run time; these make the Blender review renders readable)."""
    seed = 100
    count = 0
    for hx, hy in HOTSPOTS:
        inner = (hx - 60, hy - 60, hx + 60, hy + 60)
        outer = (hx - 110, hy - 110, hx + 110, hy + 110)
        ring = [(outer[0], outer[1], outer[2], inner[1]), (outer[0], inner[3], outer[2], outer[3]),
                (outer[0], inner[1], inner[0], inner[3]), (inner[2], inner[1], outer[2], inner[3])]
        groups = {}
        for r, kind in parcels:
            ci = _clip(r, inner)
            if ci:
                groups.setdefault((kind, 0), []).extend(clear_of_roads(ci))
            for q in ring:
                co = _clip(r, q)
                if co:
                    groups.setdefault((kind, 1), []).extend(clear_of_roads(co, min_size=4.0))
        for (kind, lod), rects in groups.items():
            src, dens = crop_src(kind, lod)
            pl = _plane(f"crop scatter {kind} L{lod}", rects, c)
            SL.scatter(pl, SRC[src], dens[lod], seed=seed, scale=(0.85, 1.15), tilt=0.08)
            seed += 7
            count += 1
        # grass and flowers on the road verges near the view
        quads = []
        for R in D.ROADS.values():
            if R["width"] < 3:
                continue
            pts = list(G.walk(R["pts"], 8.0))
            for (x0, y0, a0), (x1, y1, a1) in zip(pts, pts[1:]):
                if math.hypot(x0 - hx, y0 - hy) > 110 or in_housing((x0, y0), margin=-2):
                    continue
                for side in (-1, 1):
                    o0, o1 = side * (R["width"] / 2 + 0.85), side * (R["width"] / 2 + 3.0)
                    nx0, ny0 = -math.sin(a0), math.cos(a0)
                    nx1, ny1 = -math.sin(a1), math.cos(a1)
                    quads.append([(x0 + nx0 * o0, y0 + ny0 * o0), (x1 + nx1 * o0, y1 + ny1 * o0),
                                  (x1 + nx1 * o1, y1 + ny1 * o1), (x0 + nx0 * o1, y0 + ny0 * o1)])
        if quads:
            for k in range(3):
                v = _quads_plane(f"verge grass {k}", quads, c)
                SL.scatter(v, SRC[f"KIT grass tuft {k}"], 7.0, seed=seed + k, scale=(0.8, 1.5))
            if MONTH in (4, 5, 6, 7, 8, 9):
                for k, col in enumerate(("white", "yellow", "purple")):
                    v = _quads_plane(f"verge flowers {col}", quads, c)
                    SL.scatter(v, SRC[f"KIT wildflower {col}"], (0.5, 0.35, 0.12)[k], seed=seed + 10 + k, scale=(0.8, 1.2))
            seed += 31
            count += 1
    return count


# ---------------------------------------------------------------- sky, cameras, renders


def sky(sc):
    P = SKY.PRESETS[PRESET]
    w = bpy.data.worlds.new("ambient")
    sc.world = w
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*P["ambient"], 1)
    bg.inputs["Strength"].default_value = P["ambient_strength"]
    m = bpy.data.materials.new("sky dome")
    N, Ln = m.node_tree.nodes, m.node_tree.links
    N.clear()
    mo = N.new("ShaderNodeOutputMaterial")
    tc = N.new("ShaderNodeTexCoord")
    nrm = N.new("ShaderNodeVectorMath")
    nrm.operation = "NORMALIZE"
    sep = N.new("ShaderNodeSeparateXYZ")
    ramp = N.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements.new(0.5)
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.0, (*P["horizon"], 1)
    e[1].position, e[1].color = 0.12, (*P["mid"], 1)
    e[2].position, e[2].color = 0.62, (*P["zenith"], 1)
    em = N.new("ShaderNodeEmission")
    Ln.new(tc.outputs["Object"], nrm.inputs[0])
    Ln.new(nrm.outputs["Vector"], sep.inputs[0])
    Ln.new(sep.outputs["Z"], ramp.inputs[0])
    Ln.new(ramp.outputs["Color"], em.inputs["Color"])
    Ln.new(em.outputs[0], mo.inputs["Surface"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=5500)
    dome = bpy.context.object
    dome.name = "sky dome"
    dome.data.materials.append(m)
    dome.visible_shadow = False
    ld = bpy.data.lights.new("sun", "SUN")
    ld.angle = math.radians(1.0)
    sun = bpy.data.objects.new("sun", ld)
    sc.collection.objects.link(sun)
    el, az = math.radians(P["sun_el"]), math.radians(P["sun_az"])
    sv = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = sv.to_track_quat("Z", "Y")
    ld.color = P["sun"]
    ld.energy = P["sun_strength"]
    ng = SL.toon_group()
    ng.nodes["global lit"].outputs[0].default_value = (*P["lit"], 1)
    ng.nodes["global shadow"].inputs["B"].default_value = (*P["shadow"], 1)
    cl = coll("clouds")
    clouds = {"cumulus": "KIT cloud cumulus", "cumulus tower": "KIT cloud tower", "cumulus small": "KIT cloud small",
              "thunderhead": "KIT cloud thunderhead", "stratus": "KIT cloud stratus 0", "cirrus": "KIT cloud cirrus"}
    center = W((330, 330))
    for kind in P["clouds"]:
        for k in range(1 if kind in ("thunderhead", "stratus") else 7):
            nm = clouds[kind]
            if kind not in ("thunderhead", "stratus"):
                nm += f" {rng.randrange(3 if kind == 'cumulus' or kind == 'cumulus small' else 2)}"
            a = rng.uniform(0, 2 * math.pi)
            p = center + Vector((math.cos(a), math.sin(a), 0)) * rng.uniform(900, 2600)
            p.z = {"stratus": 520, "cirrus": 950, "thunderhead": 120}.get(kind, rng.uniform(260, 520))
            place(nm, p, rng.uniform(0, 6.28), (1, 1, 1), cl)
    return dome


def camera(name, loc, look, lens=30, ortho=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.2
    cd.clip_end = 9000
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    o = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    d = Vector(look) - Vector(loc)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("-Z", "Y")
    return o


def cameras(home_cams):
    cams = {}
    vc = W((330, 300))
    cams["overview"] = camera("CAM overview", (vc.x + 520, vc.y - 640, 360), (vc.x - 40, vc.y + 40, 0), lens=32)
    cams["plan"] = camera("CAM plan", (vc.x, vc.y, 1500), (vc.x, vc.y + 0.01, 0), ortho=760)
    cams["main road"] = camera("CAM main road", tuple(W((250, 266), 1.65)), tuple(W((420, 245), 3.0)), lens=28)
    cams["north pond"] = camera("CAM north pond", tuple(W((404, 131), 1.8)), tuple(W((372, 82), 1.0)), lens=24)
    cams["avenue"] = camera("CAM avenue", tuple(W((599, 760), 1.65)), tuple(W((597, 560), 4.0)), lens=28)
    # orthographic top view matching the traced satellite crop (map x 0..685.6, y 0..610), for fit checks
    sat_c = W((685.6 / 2, 610.0 / 2))
    cams["satellite"] = camera("CAM satellite", (sat_c.x, sat_c.y, 1500), (sat_c.x, sat_c.y + 0.01, 0), ortho=685.6)
    cams["home aerial"] = camera("CAM home aerial", tuple(W((640, 470), 70)), tuple(W((560, 395), 0)), lens=30)
    for n, o in home_cams.items():
        if n.startswith("VIDEO A"):
            cams["home courtyard"] = o
    for o in cams.values():
        o.data.clip_end = 9000
    return cams


# ---------------------------------------------------------------- main

sc, SRC_ = setup()
SRC.update(SRC_)
root = coll("VILLAGE layout")
c_ter = coll("terrain and water", root)
c_road = coll("roads and bridges", root)
c_house = coll("courtyard plots", root)
c_tree = coll("trees", root)
c_field = coll("fields", root)
c_util = coll("poles wires lamps", root)
c_hor = coll("horizon", root)
home_cams = home_quarter()
print("HOME rects", len(HOME_RECTS), "map extent", [round(f(r[i] for r in HOME_RECTS)) for f, i in ((min, 0), (min, 1), (max, 2), (max, 3))])
terrain_and_water(c_ter)
roads(c_road)
bridges(c_road)
st = housing(c_house, c_tree)
school(c_house)
na = avenues(c_tree)
nv = village_trees(c_tree)
parcels = fields(c_field, c_util)
nf = len(parcels)
nw = utilities(c_util)
nh = horizon(c_hor)
ng = groves(c_tree)
c_life = coll("home life", root)
nl = home_dressing(c_life)
c_scatter = coll("near-view scatter", root)
ns = scatter_near(c_scatter, parcels)
print("PASS2 grove trees", ng, "home props", nl, "scatter groups", ns)
dome = sky(sc)
cams = cameras(home_cams)
print("LAYOUT", st, "avenue trees", na, "village trees", nv, "fields", nf, "wire spans", nw, "objects", len(bpy.data.objects))
os.makedirs(RENDERS, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
if RENDER:
    want = list(cams) if RENDER == "all" else [w.replace("_", " ") for w in RENDER.split(",")]
    for n in want:
        cam = cams[n]
        sc.camera = cam
        dome.location = cam.location if cam.data.type != "ORTHO" else (cam.location.x, cam.location.y, 0)
        if n == "satellite":
            sc.render.resolution_x, sc.render.resolution_y = 1180, 1050
        sc.render.filepath = os.path.join(RENDERS, f"{n.replace(' ', '_')}_m{MONTH}{'_preview' if PREVIEW else ''}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)
