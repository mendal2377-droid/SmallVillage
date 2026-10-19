"""Build the SmallVillage asset kit (batch 1: trees, crops, ground cover) into kit/sv_kit.blend.

  blender -b --factory-startup --python blender/rebuild/kit/build_kit.py -- [--sheet] [--preview]

--sheet renders a review line-up under each seasonal palette into kit/renders and writes
kit/renders/budget.json with triangle counts checked against KIT.md budgets.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.dirname(HERE)]
import kit_lib as K  # noqa: E402
import palette as PAL  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SHEET = "--sheet" in argv
PREVIEW = "--preview" in argv
OUT = os.path.join(HERE, "sv_kit.blend")
RENDERS = os.path.join(HERE, "renders")

BUDGET = {  # (kind/family, state-group, lod) -> max triangles
    ("tree", "leafy", 0): 12000, ("tree", "leafy", 1): 2000, ("tree", "leafy", 2): 300,
    ("tree", "bare", 0): 8000, ("tree", "bare", 1): 1500, ("tree", "bare", 2): 200,
    ("tree", "evergreen", 0): 12000, ("tree", "evergreen", 1): 2000, ("tree", "evergreen", 2): 300,
    ("crop", None, 0): 400, ("crop", None, 1): 60,
    ("ground", None, 0): 120,
}


def budget_for(o):
    kind, lod = o["sv_kind"], o["sv_lod"]
    if o["sv_family"] in ("reed", "cattail"):
        return 200
    if kind == "tree":
        return BUDGET.get((kind, o["sv_state"], lod))
    return BUDGET.get((kind, None, lod))


def coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = coll("SV kit")
    rows = {}
    # ---- trees
    trees = coll("KIT trees", root)
    row = []
    for v in range(3):
        for lod in (0, 1, 2):
            row.append(K.poplar(trees, v, "leafy", lod))
    for v in range(3):
        for lod in (0, 1, 2):
            row.append(K.poplar(trees, v, "bare", lod))
    row.append(K.poplar(trees, 1, "bare", 0, nest=True))
    rows["poplar"] = row
    row = []
    for v in range(3):
        for st in ("leafy", "bare"):
            for lod in (0, 1, 2):
                row.append(K.broadleaf(trees, v, st, lod))
    rows["broadleaf"] = row
    row = []
    for v in range(2):
        for st in ("leafy", "bare"):
            for lod in (0, 1, 2):
                row.append(K.willow(trees, v, st, lod))
    for v in range(2):
        for lod in (0, 1, 2):
            row.append(K.conifer(trees, v, lod))
    for v in range(2):
        for lod in (0, 1, 2):
            row.append(K.hedge_ball(trees, v, lod))
    rows["willow conifer hedge"] = row
    # ---- crops
    crops = coll("KIT crops", root)
    row = [K.wheat(crops, st, lod) for st in K.WHEAT_STAGES for lod in (0, 1)]
    row += [K.maize(crops, st, v, lod) for st in K.MAIZE_STAGES for v in range(2) for lod in (0, 1)]
    row += [K.garlic(crops), K.soybean(crops)]
    rows["crops"] = row
    # ---- ground cover
    ground = coll("KIT ground cover", root)
    row = [K.grass_tuft(ground, v) for v in range(3)] + [K.weed_rosette(ground)]
    row += [K.wildflower(ground, c) for c in ("white", "yellow", "purple", "pink", "blue")]
    row += [K.reeds(ground), K.reeds(ground, cattail=True)]
    rows["ground"] = row

    # ---- lay out, mark as assets
    y = 0.0
    for name, objs in rows.items():
        x = 0.0
        big = max(o.dimensions.x for o in objs)
        gap = max(0.6, big * 0.35)
        for o in objs:
            o.location = (x + o.dimensions.x / 2, y, 0)
            x += o.dimensions.x + gap
            fam = o["sv_family"]
            cat = {"tree": f"Trees/{fam}", "crop": f"Crops/{fam}", "ground": "Ground cover"}[o["sv_kind"]]
            tags = [o["sv_kind"], fam, str(o.get("sv_state", "")), f"LOD{o['sv_lod']}"]
            K.mark(o, "SmallVillage/" + cat, [t for t in tags if t], f"{fam} {o.get('sv_state', '')} LOD{o['sv_lod']}")
        y += max(o.dimensions.y for o in objs) + 12
    K.write_catalogs(HERE)
    for m in list(bpy.data.materials):
        if m.name.startswith("slot:"):
            bpy.data.materials.remove(m)
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    print("SAVED", OUT)
    return rows


def report(rows):
    out, over = [], []
    for name, objs in rows.items():
        for o in objs:
            b = budget_for(o)
            rec = {"asset": o.name, "tris": o["sv_tris"], "budget": b, "ok": b is None or o["sv_tris"] <= b}
            out.append(rec)
            if not rec["ok"]:
                over.append(rec)
    os.makedirs(RENDERS, exist_ok=True)
    with open(os.path.join(RENDERS, "budget.json"), "w", encoding="utf8") as fh:
        json.dump({"assets": out, "over_budget": over}, fh, indent=1)
    print("ASSETS", len(out), "OVER", len(over))
    for r in over:
        print("OVER", r)


# ---------------------------------------------------------------- review sheet


def sheet(rows):
    import style_lib as SL
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = (1280, 720) if PREVIEW else (2400, 1350)
    sc.view_settings.view_transform = "Standard"
    sc.eevee.taa_render_samples = 32 if PREVIEW else 64
    w = bpy.data.worlds.new("kit ambient")
    sc.world = w
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.80, 0.86, 0.92, 1)
    bg.inputs["Strength"].default_value = 0.5
    ld = bpy.data.lights.new("kit sun", "SUN")
    ld.energy = 4.5
    ld.color = (1.0, 0.92, 0.80)
    sun = bpy.data.objects.new("kit sun", ld)
    sc.collection.objects.link(sun)
    s = Vector((-0.55, -0.6, 0.62)).normalized()
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = s.to_track_quat("Z", "Y")
    ng = SL.toon_group()
    ng.nodes["global lit"].outputs[0].default_value = (1.12, 1.03, 0.9, 1)
    ground = SL.toon("kit ground", (0.66, 0.62, 0.54, 1), var=0.4)
    bpy.ops.mesh.primitive_plane_add(size=1)
    gp = bpy.context.object
    gp.scale = (900, 900, 1)
    gp.location = (200, 30, -0.01)
    gp.data.materials.append(ground)
    sc.world.color = (0.8, 0.85, 0.9)
    os.makedirs(RENDERS, exist_ok=True)
    # review groups: near-detail (LOD0) assets only, laid side by side close up
    allobjs = [o for objs in rows.values() for o in objs]
    groups = {
        "trees_poplar": lambda o: o["sv_family"] == "poplar",
        "trees_yard": lambda o: o["sv_family"] in ("broadleaf", "willow"),
        "trees_small": lambda o: o["sv_family"] in ("conifer", "hedge"),
        "crops_wheat": lambda o: o["sv_family"] in ("wheat", "garlic", "soybean"),
        "crops_maize": lambda o: o["sv_family"] == "maize",
        "ground": lambda o: o["sv_kind"] == "ground",
    }
    home = {o.name: o.location.copy() for o in allobjs}
    for gname, pick in groups.items():
        objs = [o for o in allobjs if o["sv_lod"] == 0 and pick(o)]
        for o in allobjs:
            o.hide_render = o not in objs
        x = 0.0
        gap = max(0.15, max(o.dimensions.x for o in objs) * 0.15)
        for o in objs:
            o.location = (x + o.dimensions.x / 2, 0, 0)
            x += o.dimensions.x + gap
        width, height = x - gap, max(o.dimensions.z for o in objs)
        cd = bpy.data.cameras.new("cam " + gname)
        cd.type = "ORTHO"
        cd.ortho_scale = max(width, height * 1.15 * 16 / 9) * 1.06
        cam = bpy.data.objects.new("cam " + gname, cd)
        sc.collection.objects.link(cam)
        cam.location = (width / 2, -200, height * 0.5 + 200 * math.tan(math.radians(6)))
        cam.rotation_euler = (math.radians(84), 0, 0)
        cd.clip_end = 1000
        sc.camera = cam
        for season in PAL.SEASONS:
            if gname.startswith("crops") and season != "summer":
                continue  # crop stages do not depend on the palette season
            K.set_season(season)
            sc.render.filepath = os.path.join(RENDERS, f"{gname}_{season}.png")
            bpy.ops.render.render(write_still=True)
            print("RENDERED", sc.render.filepath)
    for o in allobjs:
        o.location = home[o.name]
        o.hide_render = False


rows = build()
report(rows)
if SHEET:
    sheet(rows)
