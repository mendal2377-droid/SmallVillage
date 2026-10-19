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
import kit_buildings as KB  # noqa: E402
import kit_infra as KI  # noqa: E402
import kit_props as KP  # noqa: E402
import kit_lib as K  # noqa: E402
import palette as PAL  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SHEET = "--sheet" in argv
PREVIEW = "--preview" in argv
GROUPS = argv[argv.index("--groups") + 1].split(",") if "--groups" in argv else None
OUT = os.path.join(HERE, "sv_kit.blend")
RENDERS = os.path.join(HERE, "renders")

BUDGET = {  # (kind/family, state-group, lod) -> max triangles
    ("tree", "leafy", 0): 12000, ("tree", "leafy", 1): 2000, ("tree", "leafy", 2): 300,
    ("tree", "bare", 0): 8000, ("tree", "bare", 1): 1500, ("tree", "bare", 2): 200,
    ("tree", "evergreen", 0): 12000, ("tree", "evergreen", 1): 2000, ("tree", "evergreen", 2): 300,
    ("crop", None, 0): 400, ("crop", None, 1): 60,
    ("ground", None, 0): 120,
    ("building", None, 0): 3000, ("building", None, 1): 600, ("building", None, 2): 60,
    ("plot", None, 0): 8000, ("plot", None, 1): 1500, ("plot", None, 2): 200,
    ("infra", None, 0): 1500, ("infra", None, 1): 300, ("infra", None, 2): 60,
    ("bridge", None, 0): 3000, ("bridge", None, 1): 600, ("bridge", None, 2): 120,
    ("prop", None, 0): 2000,
    ("vehicle", None, 0): 2000, ("vehicle", None, 1): 400,
    ("large vehicle", None, 0): 4000, ("large vehicle", None, 1): 800,
}
FARM_PROPS = ("straw stack", "stalk pile", "firewood", "brick stack", "basket", "corn cob pile", "corn drying")


def budget_for(o):
    kind, lod = o["sv_kind"], o["sv_lod"]
    if o["sv_family"] in ("reed", "cattail"):
        return 200
    if o["sv_family"] == "combine harvester":
        return BUDGET.get(("large vehicle", None, lod))
    if o["sv_family"] in ("culvert bridge", "river bridge"):
        return BUDGET.get(("bridge", None, lod))
    if o["sv_family"] in ("courtyard plot", "school"):
        return BUDGET.get(("plot", None, lod))
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
    # ---- buildings (batch 2)
    bld = coll("KIT buildings", root)
    rows["plots"] = [KB.courtyard_plot(bld, v, lod) for v in KB.PLOTS for lod in (0, 1, 2)]
    rows["school"] = [KB.school(bld, lod) for lod in (0, 1, 2)]
    row = []
    for lod in (0, 1, 2):
        row.append(KB.module(bld, "gate tiled", KB.gate, lod, style="tiled"))
        row.append(KB.module(bld, "gate brick", KB.gate, lod, style="brick"))
        for mat in ("brick", "plaster", "grey", "old"):
            row.append(KB.module(bld, f"wall {mat} 4m", KB.wall_run, lod, length=4.0, material=mat))
        row.append(KB.module(bld, "blue shed", KB.shed, lod))
        row.append(KB.module(bld, "wing flat", KB.wing, lod, length=7.0, facade="white", roof="flat"))
        row.append(KB.module(bld, "wing tiled", KB.wing, lod, length=7.0, facade="old_brick", roof="tile"))
        for fac, fl, rf, gz in (("white_tile", 2, "flat", True), ("grey", 2, "flat", False), ("white", 3, "flat", False),
                                ("brick", 1, "tile", False), ("pink", 1, "tile", False), ("cream", 2, "flat", False)):
            row.append(KB.module(bld, f"house {fac} {fl}F {rf}", KB.house_block, lod, w=11.0, d=8.0, floors=fl, facade=fac, roof=rf, glazed=gz))
    rows["building modules"] = row
    # ---- infrastructure (batch 3)
    inf = coll("KIT infrastructure", root)
    row = []
    for lod in (0, 1, 2):
        for w in (4.5, 3.0, 2.4):
            row.append(KI.concrete_road(inf, width=w, lod=lod))
        row += [KI.road_junction(inf, lod=lod), KI.brick_alley(inf, lod=lod), KI.field_path(inf, lod=lod)]
        row += [KI.ditch(inf, water=True, lod=lod), KI.ditch(inf, water=False, lod=lod), KI.river_bank(inf, lod=lod)]
        row += [KI.culvert_bridge(inf, lod=lod), KI.river_bridge(inf, lod=lod)]
        row += [KI.utility_pole(inf, lod=lod), KI.utility_pole(inf, lod=lod, lamp=True), KI.solar_lamp(inf, lod=lod),
                KI.transformer(inf, lod=lod), KI.well_hut(inf, lod=lod, variant=0), KI.well_hut(inf, lod=lod, variant=1),
                KI.wellhead(inf, lod=lod)]
    row += [KI.field_stake(inf, 0), KI.field_stake(inf, 1)]
    rows["infrastructure"] = row
    # ---- props and vehicles (batch 4)
    pr = coll("KIT props", root)
    row = [KP.stool(pr, "plastic_red"), KP.stool(pr, "plastic_green"), KP.stool(pr, "plastic_green", kid_chair=True),
           KP.basin(pr, "plastic_red"), KP.basin(pr, "plastic_pink", 0.24), KP.basin(pr, "plastic_blue", 0.3), KP.bucket(pr),
           KP.washing_machine(pr), KP.laundry_line(pr), KP.umbrella(pr, True), KP.umbrella(pr, True, "plastic_blue", "cloth_cream"),
           KP.umbrella(pr, False), KP.potted_plant(pr, 0), KP.potted_plant(pr, 1), KP.chilli_string(pr), KP.broom(pr),
           KP.drying_rack(pr), KP.low_table(pr), KP.urns(pr), KP.satellite_dish(pr), KP.trash_bin(pr),
           KP.corn_drying(pr), KP.corn_cob_pile(pr), KP.straw_stack(pr, 0), KP.straw_stack(pr, 1), KP.stalk_pile(pr, "husk", 0),
           KP.stalk_pile(pr, "maize_dry", 1), KP.firewood_bundle(pr), KP.brick_stack(pr), KP.bamboo_basket(pr)]
    rows["props"] = row
    vh = coll("KIT vehicles", root)
    rows["vehicles"] = [f(vh, lod) for f in (KP.tricycle, KP.scooter, KP.walking_tractor, KP.tractor, KP.combine, KP.handcart) for lod in (0, 1)]

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
            cat = {"tree": f"Trees/{fam}", "crop": f"Crops/{fam}", "ground": "Ground cover",
                   "building": "Buildings/" + ("Plots" if fam == "courtyard plot" else "School" if fam == "school" else "Modules"),
                   "prop": "Props/" + ("Farm" if fam in FARM_PROPS else "Courtyard"),
                   "vehicle": "Vehicles",
                   "infra": "Infrastructure/" + ("Roads" if fam.startswith("road") or fam in ("brick alley", "field path") else
                                                 "Water" if fam in ("ditch", "river", "culvert bridge", "river bridge") else "Utilities")}[o["sv_kind"]]
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


def fit_camera(cam, objs, aspect=16 / 9, margin=1.08):
    """Orthographic fit: project every bounding-box corner into the camera frame."""
    bpy.context.view_layer.update()
    rot = cam.rotation_euler.to_matrix()
    inv = rot.inverted()
    pts = [inv @ (o.matrix_world @ Vector(c)) for o in objs for c in o.bound_box]
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    cam.data.ortho_scale = max(max(xs) - min(xs), (max(ys) - min(ys)) * aspect) * margin
    cam.location = rot @ Vector((cx, cy, max(zs) + 400))


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
        "buildings_plots": lambda o: o["sv_family"] == "courtyard plot",
        "buildings_houses": lambda o: o["sv_family"].startswith("house"),
        "buildings_parts": lambda o: o["sv_kind"] == "building" and not o["sv_family"].startswith("house")
        and o["sv_family"] not in ("courtyard plot", "school"),
        "infra_roads": lambda o: o["sv_kind"] == "infra" and (o["sv_family"].startswith("road") or o["sv_family"] in ("brick alley", "field path")),
        "infra_water": lambda o: o["sv_family"] in ("ditch", "river", "culvert bridge", "river bridge"),
        "infra_utilities": lambda o: o["sv_kind"] == "infra" and o["sv_family"] in ("utility pole", "utility pole lamp", "solar lamp",
                                                                                   "transformer", "well hut", "wellhead", "field stake"),
        "props_courtyard": lambda o: o["sv_kind"] == "prop" and o["sv_family"] not in FARM_PROPS,
        "props_farm": lambda o: o["sv_kind"] == "prop" and o["sv_family"] in FARM_PROPS,
        "vehicles": lambda o: o["sv_kind"] == "vehicle",
        "buildings_lod": lambda o: o["sv_family"] in ("courtyard plot", "school") and o.get("sv_variant", "home_like") == "home_like",
    }
    home = {o.name: o.location.copy() for o in allobjs}
    for gname, pick in groups.items():
        if GROUPS and gname not in GROUPS:
            continue
        gp.hide_render = gname == "infra_water"  # channels sit below ground; show them against the backdrop
        lod_any = gname == "buildings_lod"
        objs = [o for o in allobjs if (lod_any or o["sv_lod"] == 0) and pick(o)]
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
        angled = gname.startswith(("buildings", "infra", "props", "vehicles"))
        cam.rotation_euler = (math.radians(62 if angled else 84), 0, math.radians(-28 if angled else 0))
        cd.clip_end = 2000
        fit_camera(cam, objs)
        sc.camera = cam
        for season in PAL.SEASONS:
            if (gname.startswith(("crops", "buildings", "infra_roads", "infra_utilities", "vehicles"))) and season != "summer":
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
