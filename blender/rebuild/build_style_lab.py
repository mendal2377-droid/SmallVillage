"""SmallVillage 2.0 — Phase 1 style lab.

Builds four painterly style-frame vignettes into blender/rebuild/style_lab.blend and
optionally renders them. Run from the repository root:

  blender -b --factory-startup --python blender/rebuild/build_style_lab.py -- [--render all|avenue,pond,...] [--preview]

The authoritative village file is only read (the courtyard is appended from it); it is never saved.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import style_lib as L  # noqa: E402

REPO = os.path.dirname(os.path.dirname(HERE))
SOURCE = os.path.join(REPO, "blender", "video_revision", "Yanlaozhai_Video_House_and_Lane.blend")
OUT_BLEND = os.path.join(HERE, "style_lab.blend")
RENDER_DIR = os.path.join(HERE, "renders")

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER = None
if "--render" in argv:
    RENDER = argv[argv.index("--render") + 1].split(",")
PREVIEW = "--preview" in argv
ONLY = None
if "--only" in argv:
    ONLY = argv[argv.index("--only") + 1].split(",")

A = Vector((3000, 0, 0))  # poplar avenue
B = Vector((6000, 0, 0))  # pond
C = Vector((9000, 0, 0))  # village edge at harvest

# ---------------------------------------------------------------- palette (linear)
P = {
    "bark": (0.30, 0.29, 0.24, 1),
    "whitewash": (0.86, 0.86, 0.82, 1),
    "poplar_spring_l": (0.40, 0.58, 0.16, 1),
    "poplar_spring_d": (0.17, 0.36, 0.12, 1),
    "poplar_summer_l": (0.24, 0.42, 0.12, 1),
    "poplar_summer_d": (0.10, 0.24, 0.09, 1),
    "wheat_green": (0.20, 0.42, 0.10, 1),
    "wheat_green2": (0.27, 0.48, 0.12, 1),
    "wheat_gold": (0.72, 0.50, 0.16, 1),
    "wheat_gold2": (0.60, 0.40, 0.12, 1),
    "grass": (0.22, 0.45, 0.10, 1),
    "earth": (0.36, 0.25, 0.15, 1),
    "concrete": (0.58, 0.55, 0.50, 1),
    "plaster": (0.80, 0.78, 0.72, 1),
    "plaster_grey": (0.42, 0.43, 0.41, 1),
    "plinth": (0.30, 0.03, 0.04, 1),
    "brick": (0.42, 0.16, 0.09, 1),
    "roof_tile": (0.42, 0.15, 0.08, 1),
    "gate": (0.42, 0.05, 0.05, 1),
    "window": (0.16, 0.26, 0.32, 1),
    "frame": (0.55, 0.55, 0.52, 1),
    "rail": (0.75, 0.75, 0.72, 1),
    "white_tile": (0.82, 0.83, 0.80, 1),
    "pole": (0.55, 0.53, 0.50, 1),
    "wire": (0.03, 0.03, 0.03, 1),
    "cloud": (1.0, 0.98, 0.95, 1),
}

# ---------------------------------------------------------------- scene setup


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = "Style lab"
    r = sc.render
    r.engine = "BLENDER_EEVEE"
    r.resolution_x, r.resolution_y = (960, 540) if PREVIEW else (1920, 1080)
    r.resolution_percentage = 100
    r.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.eevee.taa_render_samples = 32 if PREVIEW else 96
    try:
        sc.eevee.use_shadows = True
        sc.eevee.use_raytracing = True
    except AttributeError:
        pass
    # soft ink outlines
    r.use_freestyle = "--noink" not in argv
    r.line_thickness_mode = "ABSOLUTE"
    r.line_thickness = 0.9 if PREVIEW else 1.3
    vl = sc.view_layers[0]
    fs = vl.freestyle_settings
    fs.crease_angle = math.radians(120)
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new("ink")
    ls.select_by_visibility = True
    ls.select_by_edge_types = True
    ls.select_silhouette = True
    ls.select_border = False
    ls.select_crease = False
    ls.select_by_collection = True
    ls.collection = L.coll("SV no ink")
    ls.collection_negation = "EXCLUSIVE"
    st = ls.linestyle or bpy.data.linestyles.new("SV ink")
    ls.linestyle = st
    st.color = (0.16, 0.13, 0.12)
    st.alpha = 0.55
    st.thickness = 1.0
    st.chaining = "PLAIN"
    return sc


def world():
    """Uniform cool ambient world for lighting + a separate painted sky dome for what the camera sees.

    EEVEE lights from the world shader itself, so a bright painted gradient would flood every
    shadow past the toon threshold. The dome keeps sky colour and ambient level independent."""
    w = bpy.data.worlds.new("SV ambient")
    bpy.context.scene.world = w
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.name = "ambient"
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    m = bpy.data.materials.new("SV sky dome")
    N, Ln = m.node_tree.nodes, m.node_tree.links
    N.clear()
    mo = N.new("ShaderNodeOutputMaterial")
    tc = N.new("ShaderNodeTexCoord")
    nrm = N.new("ShaderNodeVectorMath")
    nrm.operation = "NORMALIZE"
    Ln.new(tc.outputs["Object"], nrm.inputs[0])
    sep = N.new("ShaderNodeSeparateXYZ")
    Ln.new(nrm.outputs["Vector"], sep.inputs[0])
    ramp = N.new("ShaderNodeValToRGB")
    ramp.name = "sky ramp"
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements.new(0.5)
    Ln.new(sep.outputs["Z"], ramp.inputs[0])
    em = N.new("ShaderNodeEmission")
    Ln.new(ramp.outputs["Color"], em.inputs["Color"])
    Ln.new(em.outputs[0], mo.inputs["Surface"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=7500)
    dome = bpy.context.object
    dome.name = "SV sky dome"
    dome.data.materials.append(m)
    dome.visible_shadow = False
    for f in dome.data.polygons:
        f.use_smooth = True
    return dome


def set_tints(lit, shadow=(1, 1, 1, 1)):
    ng = L.toon_group()
    ng.nodes["global lit"].outputs[0].default_value = lit
    ng.nodes["global shadow"].inputs["B"].default_value = shadow


def set_sky(horizon, mid, zenith, ambient, amb_strength=0.6):
    e = bpy.data.materials["SV sky dome"].node_tree.nodes["sky ramp"].color_ramp.elements
    # dome object coordinates normalised: Z = 0 at the horizon, 1 at the zenith
    e[0].position, e[0].color = 0.0, horizon
    e[1].position, e[1].color = 0.12, mid
    e[2].position, e[2].color = 0.62, zenith
    nt = bpy.context.scene.world.node_tree
    nt.nodes["ambient"].inputs["Color"].default_value = ambient
    nt.nodes["ambient"].inputs["Strength"].default_value = amb_strength


def sun():
    ld = bpy.data.lights.new("SV sun", "SUN")
    ld.angle = math.radians(1.2)
    o = bpy.data.objects.new("SV sun", ld)
    bpy.context.scene.collection.objects.link(o)
    return o


def set_sun(o, elev, az, color, strength):
    s = Vector((math.sin(math.radians(az)) * math.cos(math.radians(elev)),
                math.cos(math.radians(az)) * math.cos(math.radians(elev)),
                math.sin(math.radians(elev))))
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = s.to_track_quat("Z", "Y")
    o.data.color = color
    o.data.energy = strength


def camera(name, loc, look_at, lens=28):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.1
    cd.clip_end = 8000
    o = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    d = Vector(look_at) - Vector(loc)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("-Z", "Y")
    return o


def plane(name, c, x0, y0, x1, y1, z, mat, subdiv=0):
    import bmesh
    bm = bmesh.new()
    vs = [bm.verts.new((x0, y0, z)), bm.verts.new((x1, y0, z)), bm.verts.new((x1, y1, z)), bm.verts.new((x0, y1, z))]
    bm.faces.new(vs)
    if subdiv:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=subdiv, use_grid_fill=True)
    o = L.obj_from_bm(name, bm, [mat], c)
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def ellipse(name, c, cx, cy, rx, ry, z, mat, segs=48, wobble=0.0, seed=0):
    import bmesh
    rng = random.Random(seed)
    bm = bmesh.new()
    vs = []
    ph = [rng.uniform(0, 6.28) for _ in range(3)]
    for i in range(segs):
        a = 2 * math.pi * i / segs
        k = 1 + wobble * (0.5 * math.sin(3 * a + ph[0]) + 0.3 * math.sin(5 * a + ph[1]) + 0.2 * math.sin(7 * a + ph[2]))
        vs.append(bm.verts.new((cx + rx * k * math.cos(a), cy + ry * k * math.sin(a), z)))
    bm.faces.new(vs)
    o = L.obj_from_bm(name, bm, [mat], c)
    for p in o.data.polygons:
        p.use_smooth = False
    return o


# ---------------------------------------------------------------- shared assets


def assets():
    lib = L.coll("SV asset library")
    lib.hide_render = False
    M = {k: L.toon("SV " + k, v, var=1.0 if "poplar" in k else 0.5) for k, v in P.items()}
    M["cloud"] = L.toon("SV cloud", P["cloud"], var=0.2, tint=(0.74, 0.78, 0.92, 1))
    M["grass_i"] = L.toon("SV grass inst", P["grass"], var=0.3, instancer_tint=True)
    M["wheat_green_i"] = L.toon("SV wheat green inst", P["wheat_green"], var=0.3, instancer_tint=True)
    M["wheat_gold_i"] = L.toon("SV wheat gold inst", P["wheat_gold"], var=0.3, instancer_tint=True)
    M["wheat_ear_i"] = L.toon("SV wheat ear inst", (0.80, 0.56, 0.18, 1), var=0.3, instancer_tint=True)
    M["stem"] = L.toon("SV flower stem", (0.15, 0.32, 0.08, 1))
    for nm, col in {"white": (0.9, 0.9, 0.85, 1), "yellow": (0.95, 0.70, 0.08, 1),
                    "blue": (0.25, 0.32, 0.85, 1), "pink": (0.9, 0.38, 0.55, 1),
                    "purple": (0.5, 0.25, 0.7, 1)}.items():
        M["flower_" + nm] = L.toon("SV flower " + nm, col, var=0.2)
    lib_objs = {}
    lib_objs["grass"] = L.make_blade("SV grass tuft", lib, M["grass_i"], h=0.32, w=0.025, n=6)
    lib_objs["wheat_green"] = L.make_blade("SV wheat spring clump", lib, M["wheat_green_i"], h=0.42, w=0.018, bend=0.12, n=7)
    lib_objs["wheat_gold"] = L.make_wheat_ear_plant("SV wheat ripe clump", lib, M["wheat_gold_i"], M["wheat_ear_i"], h=0.85, n=6)
    for nm in ("white", "yellow", "blue", "pink", "purple"):
        lib_objs["flower_" + nm] = L.make_flower("SV flower " + nm, lib, M["stem"], M["flower_" + nm], h=0.38)
    for o in lib_objs.values():
        o.location = (0, 0, -500)  # keep library objects out of every frame
    return M, lib_objs


def poplar_variants(M, season, n=5):
    lib = L.coll("SV asset library")
    key = {"spring": ("poplar_spring_l", "poplar_spring_d"), "summer": ("poplar_summer_l", "poplar_summer_d")}[season]
    mats = [M["bark"], M["whitewash"], M[key[0]], M[key[1]]]
    out = []
    for i in range(n):
        o = L.make_poplar(f"SV poplar {season} {i}", lib, mats, seed=100 + i + (50 if season == "summer" else 0),
                          height=random.Random(i).uniform(15.5, 19.5))
        o.location = (0, 0, -500)
        out.append(o)
    return out


def clouds(c, M, center, forward, n=9, seed=1, dist=(1400, 2600), height=(250, 520), spread=1800, scale=(2.2, 4.0)):
    rng = random.Random(seed)
    fw = Vector(forward).normalized()
    side = Vector((-fw.y, fw.x, 0))
    for i in range(n):
        p = Vector(center) + fw * rng.uniform(*dist) + side * rng.uniform(-spread, spread)
        p.z = rng.uniform(*height)
        o = L.make_cloud(f"SV cloud {seed}-{i}", c, M["cloud"], seed * 100 + i)
        o.location = p
        s = rng.uniform(*scale)
        o.scale = (s, s, s * rng.uniform(0.8, 1.1))
        o.rotation_euler = (0, 0, math.atan2(fw.y, fw.x) + math.pi / 2 + rng.uniform(-0.3, 0.3))
        L.coll("SV no ink").objects.link(o)


def distant_village(c, M, origin, length, depth, rng, facing=0.0, density=0.08):
    """Low grey-white strip of far houses and tree clumps for the horizon."""
    mats = {"plaster": M["plaster"], "plinth": M["plaster_grey"], "window": M["window"], "frame": M["frame"],
            "roof": M["roof_tile"], "brick": M["brick"], "gate": M["gate"], "rail": M["rail"], "tile": M["white_tile"],
            "side": M["plaster_grey"]}
    o = Vector(origin)
    ax = Vector((math.cos(facing), math.sin(facing), 0))
    ay = Vector((-ax.y, ax.x, 0))
    n = int(length * density)
    for i in range(n):
        p = o + ax * rng.uniform(0, length) + ay * rng.uniform(0, depth)
        style = rng.choice(["flat", "flat", "pitched", "tile"])
        h = L.make_house(f"SV far house {i}", c, mats, rng.uniform(8, 14), rng.uniform(7, 10), rng.choice([1, 2, 2, 3]), style, rng, gate=False)
        h.location = p
        h.rotation_euler = (0, 0, facing)


# ---------------------------------------------------------------- vignette: poplar avenue (spring, late afternoon)


def avenue(M, LIB):
    c = L.coll("SV 1 Poplar avenue")
    rng = random.Random(11)
    ox, oy = A.x, A.y
    field = L.striped_field_material("SV field spring", P["wheat_green"], P["wheat_green2"], stripe_scale=2.2, along="X")
    plane("SV avenue ground", c, ox - 2500, oy - 600, ox + 2500, oy + 3000, 0.0, field)
    road = L.concrete_road_material("SV road concrete", P["concrete"])
    plane("SV avenue road", c, ox - 2.2, oy - 40, ox + 2.2, oy + 1400, 0.10, road)
    plane("SV avenue shoulder L", c, ox - 3.9, oy - 40, ox - 2.2, oy + 1400, 0.05, M["earth"])
    plane("SV avenue shoulder R", c, ox + 2.2, oy - 40, ox + 4.2, oy + 1400, 0.05, M["earth"])
    water = L.water_material("SV ditch water", (0.10, 0.20, 0.20, 1), (0.40, 0.52, 0.55, 1))
    plane("SV avenue ditch", c, ox + 4.4, oy - 40, ox + 5.6, oy + 1400, 0.02, water)
    for o in c.objects:
        L.coll("SV no ink").objects.link(o)
    # verge grass and wildflowers near camera
    sc = L.coll("SV 1 scatter", c)
    for side, x0, x1 in (("L", -3.9, -2.25), ("R", 2.25, 4.35)):
        g = plane(f"SV verge {side}", sc, ox + x0, oy - 25, ox + x1, oy + 160, 0.05, M["grass"])
        L.scatter(g, LIB["grass"], 70, seed=3 if side == "L" else 4, scale=(0.7, 1.4))
        for k, (fl, dens) in enumerate((("white", 0.9), ("yellow", 0.6), ("purple", 0.15))):
            f = plane(f"SV flowers {side} {fl}", sc, ox + x0, oy - 25, ox + x1, oy + 120, 0.05, M["grass"])
            L.scatter(f, LIB["flower_" + fl], dens, seed=20 + k + (10 if side == "R" else 0), scale=(0.7, 1.3))
    for side, x0, x1 in (("L", -45, -3.9), ("R", 5.7, 45)):
        w = plane(f"SV wheat near {side}", sc, ox + x0, oy - 25, ox + x1, oy + 70, 0.02, M["wheat_green"])
        L.scatter(w, LIB["wheat_green"], 30, seed=40 if side == "L" else 41, scale=(0.8, 1.2), tilt=0.1)
    for o in sc.objects:
        L.coll("SV no ink").objects.link(o)
    # poplars both sides
    pv = poplar_variants(M, "spring")
    tc = L.coll("SV 1 poplars", c)
    y = -30.0
    while y < 1350:
        for sx in (-3.05, 3.15):
            L.link_dup(rng.choice(pv), tc, (ox + sx + rng.uniform(-0.15, 0.15), oy + y + rng.uniform(-0.4, 0.4), 0.05),
                       rng.uniform(0, 6.28), rng.uniform(0.9, 1.1))
        y += rng.uniform(3.8, 4.6)
    # second row on the left like the photographs
    y = -30.0
    while y < 600:
        L.link_dup(rng.choice(pv), tc, (ox - 6.6 + rng.uniform(-0.3, 0.3), oy + y, 0.05), rng.uniform(0, 6.28), rng.uniform(0.85, 1.0))
        y += rng.uniform(4.0, 5.0)
    # utility poles and wires on the far left
    pole = L.make_pole("SV pole", L.coll("SV asset library"), [M["pole"], M["whitewash"]])
    pole.location = (0, 0, -500)
    prev = None
    for i in range(14):
        p = Vector((ox - 9.5, oy + 8 + i * 48, 0))
        L.link_dup(pole, c, p)
        if prev:
            for dx in (-0.7, -0.25, 0.25, 0.7):
                L.wire(f"SV wire {i} {dx}", c, M["wire"], prev + Vector((dx, 0, 8.7)), p + Vector((dx, 0, 8.7)), sag=0.9)
        prev = p
    # horizon: distant villages and shelterbelts
    hz = L.coll("SV 1 horizon", c)
    distant_village(hz, M, (ox - 1400, oy + 1500, 0), 1000, 120, rng)
    distant_village(hz, M, (ox + 500, oy + 1900, 0), 1300, 140, rng)
    for k in range(10):
        cx = ox + rng.uniform(-1800, 1800)
        cy = oy + rng.uniform(700, 2400)
        if abs(cx - ox) < 30:
            continue
        for j in range(rng.randint(5, 14)):
            L.link_dup(rng.choice(pv), hz, (cx + j * rng.uniform(3, 5), cy + rng.uniform(-3, 3), 0), rng.uniform(0, 6), rng.uniform(0.9, 1.2))
    clouds(c, M, (ox, oy, 0), (0, 1, 0), n=11, seed=1)
    cam = camera("CAM avenue", (ox + 0.5, oy - 16, 1.55), (ox + 0.2, oy + 200, 6.0), lens=26)
    return cam


def house_mats(M):
    return {"plaster": M["plaster"], "plinth": M["plinth"], "window": M["window"], "frame": M["frame"],
            "roof": M["roof_tile"], "brick": M["brick"], "gate": M["gate"], "rail": M["rail"], "tile": M["white_tile"],
            "side": M["plaster_grey"]}


WALLS = {"white": (0.80, 0.78, 0.72, 1), "tile": (0.82, 0.83, 0.80, 1), "render": (0.55, 0.56, 0.52, 1),
         "pink": (0.74, 0.56, 0.50, 1), "cream": (0.80, 0.71, 0.56, 1)}


def varied_house_mats(M, rng):
    hm = dict(house_mats(M))
    name = rng.choice(["white", "white", "tile", "render", "render", "pink", "cream"])
    hm["plaster"] = L.toon("SV wall " + name, WALLS[name], var=1.2)
    return hm


def village_row(c, M, x0, y0, length, rng, trees, depth_rows=2, prefix="row"):
    """A believable village edge: mixed 1-3 storey houses, gaps with broadleaf trees and poplars behind."""
    for row in range(depth_rows):
        x = x0
        y = y0 + row * 16
        i = 0
        while x < x0 + length:
            w = rng.uniform(8, 13)
            style = rng.choice(["flat", "flat", "flat", "tile", "tile", "pitched", "brick"])
            floors = {"brick": 1, "pitched": rng.choice([1, 2])}.get(style, rng.choice([2, 2, 3]))
            h = L.make_house(f"SV {prefix} house {row}-{i}", c, varied_house_mats(M, rng), w, rng.uniform(8, 11), floors, style, rng, gate=row == 0)
            h.location = (x, y + rng.uniform(-1.5, 1.5), 0)
            if rng.random() < 0.8:
                t = rng.choice(trees["round"])
                L.link_dup(t, c, (x + w + 1.8, y + rng.uniform(2, 9), 0), rng.uniform(0, 6.28), rng.uniform(0.8, 1.2))
            x += w + rng.uniform(1.0, 4.5)
            i += 1
    x = x0 - 10
    while x < x0 + length + 10:
        L.link_dup(rng.choice(trees["poplar"]), c, (x, y0 + depth_rows * 16 + rng.uniform(4, 14), 0), rng.uniform(0, 6.28), rng.uniform(0.85, 1.15))
        x += rng.uniform(4, 9)


_KITS = {}


def tree_kit(M, season):
    if season in _KITS:
        return _KITS[season]
    lib = L.coll("SV asset library")
    leaf = {"spring": (M["poplar_spring_l"], M["poplar_spring_d"]), "summer": (M["poplar_summer_l"], M["poplar_summer_d"])}[season]
    rounds = []
    for i in range(3):
        o = L.make_round_tree(f"SV round tree {season} {i}", lib, [M["bark"], leaf[0], leaf[1]], seed=300 + i,
                              height=random.Random(i).uniform(6, 9), spread=random.Random(i + 9).uniform(2.4, 3.6))
        o.location = (0, 0, -500)
        rounds.append(o)
    willows = []
    for i in range(2):
        o = L.make_willow(f"SV willow {season} {i}", lib, [M["bark"], leaf[0], leaf[1]], seed=400 + i)
        o.location = (0, 0, -500)
        willows.append(o)
    _KITS[season] = {"poplar": poplar_variants(M, season), "round": rounds, "willow": willows}
    return _KITS[season]


def horizon(c, M, kit, ox, oy, rng):
    distant_village(c, M, (ox - 1500, oy + 1300, 0), 1100, 120, rng)
    distant_village(c, M, (ox + 400, oy + 1800, 0), 1100, 120, rng)
    for k in range(12):
        cx, cy = ox + rng.uniform(-1600, 1600), oy + rng.uniform(350, 2200)
        for j in range(rng.randint(5, 12)):
            L.link_dup(rng.choice(kit["poplar"]), c, (cx + j * rng.uniform(3, 5), cy, 0), rng.uniform(0, 6), rng.uniform(0.9, 1.2))


# ---------------------------------------------------------------- vignette: north pond (summer morning)


def pond(M, LIB):
    c = L.coll("SV 2 Pond")
    rng = random.Random(22)
    ox, oy = B.x, B.y
    kit = tree_kit(M, "summer")
    field = L.striped_field_material("SV field summer", (0.16, 0.36, 0.08, 1), (0.24, 0.44, 0.10, 1), stripe_scale=1.4, along="Y")
    plane("SV pond ground", c, ox - 2500, oy - 600, ox + 2500, oy + 3000, 0.0, field)
    grass_m = L.toon("SV meadow", (0.24, 0.46, 0.10, 1), var=0.6)
    ellipse("SV pond meadow", c, ox, oy + 18, 62, 38, 0.01, grass_m, wobble=0.1, seed=3)
    ellipse("SV pond bank", c, ox, oy + 18, 37, 17.5, 0.02, M["earth"], wobble=0.12, seed=5)
    water = L.water_material("SV pond water", (0.06, 0.20, 0.17, 1), (0.30, 0.48, 0.45, 1),
                             algae=(0.30, 0.52, 0.12, 1), algae_amount=0.35)
    ellipse("SV pond water", c, ox, oy + 18, 35, 16, 0.04, water, wobble=0.12, seed=5)
    sc_ = L.coll("SV 2 scatter", c)
    reed_m = L.toon("SV reed", (0.30, 0.46, 0.12, 1), var=0.6, instancer_tint=True)
    reed_head = L.toon("SV reed head", (0.30, 0.18, 0.09, 1))
    reed = L.make_reed("SV reed clump", L.coll("SV asset library"), reed_m, reed_head)
    reed.location = (0, 0, -500)
    for k, (a0, a1) in enumerate(((3.6, 4.4), (5.3, 6.6), (1.2, 2.3))):
        r = L.annulus(f"SV reeds {k}", sc_, ox, oy + 18, 34, 15, 2.8, 0.03, M["grass"], a0=a0, a1=a1, wobble=0.12, seed=5)
        L.scatter(r, reed, 6, seed=60 + k, scale=(0.7, 1.3), tilt=0.12)
    g = L.annulus("SV bank grass", sc_, ox, oy + 18, 36, 17, 9, 0.03, M["grass"], wobble=0.12, seed=5)
    L.scatter(g, LIB["grass"], 22, seed=70, scale=(0.8, 1.5))
    near = plane("SV near grass", sc_, ox - 18, oy - 30, ox + 18, oy - 4, 0.02, M["grass"])
    L.scatter(near, LIB["grass"], 34, seed=71, scale=(0.6, 1.1))
    for k, (fl, dens) in enumerate((("white", 0.6), ("yellow", 0.9), ("purple", 0.2))):
        f = plane(f"SV pond flowers {fl}", sc_, ox - 18, oy - 30, ox + 18, oy - 3, 0.02, M["grass"])
        L.scatter(f, LIB["flower_" + fl], dens, seed=80 + k, scale=(0.7, 1.2))
    # willows leaning over the water, broadleaf trees around
    L.link_dup(kit["willow"][0], c, (ox - 20, oy + 2.5, 0), math.radians(-30), 1.0)
    L.link_dup(kit["willow"][1], c, (ox + 27, oy + 9, 0), math.radians(160), 1.1)
    L.link_dup(kit["round"][0], c, (ox - 32, oy + 22, 0), 0.3, 1.2)
    L.link_dup(kit["round"][1], c, (ox + 40, oy + 26, 0), 1.3, 1.1)
    village_row(c, M, ox - 70, oy + 44, 150, rng, kit, depth_rows=3, prefix="pond")
    props = L.make_stool_and_rod("SV fishing spot", c, [L.toon("SV red plastic", (0.70, 0.04, 0.05, 1)),
                                                         L.toon("SV bamboo", (0.62, 0.50, 0.22, 1)), M["wire"]])
    props.location = (ox + 3.5, oy + 0.3, 0.02)
    props.rotation_euler = (0, 0, math.radians(-12))
    duck = L.make_duck("SV duck", L.coll("SV asset library"), [L.toon("SV duck white", (0.92, 0.92, 0.88, 1)), L.toon("SV beak", (0.95, 0.45, 0.05, 1))])
    duck.location = (0, 0, -500)
    for dx, dy, a in ((-6, 20, 0.4), (-4.5, 21.5, 0.9), (-7.5, 22.8, 0.1), (9, 26, 2.6)):
        L.link_dup(duck, c, (ox + dx, oy + dy, 0.04), a, 1.0)
    horizon(L.coll("SV 2 horizon", c), M, kit, ox, oy, rng)
    clouds(c, M, (ox, oy, 0), (0, 1, 0), n=10, seed=2)
    return camera("CAM pond", (ox - 2.0, oy - 8.5, 1.9), (ox + 2.5, oy + 40, 2.2), lens=28)


def frame_pond(sun_o):
    set_tints((1.08, 1.05, 0.96, 1))
    set_sun(sun_o, 34, 115, (1.0, 0.92, 0.78), 4.5)
    set_sky((0.93, 0.88, 0.78, 1), (0.60, 0.74, 0.90, 1), (0.14, 0.36, 0.80, 1), (0.55, 0.64, 0.82, 1), 0.45)


# ---------------------------------------------------------------- vignette: village edge at wheat harvest (sunset)


def edge(M, LIB):
    import bmesh
    c = L.coll("SV 3 Village edge")
    rng = random.Random(33)
    ox, oy = C.x, C.y
    kit = tree_kit(M, "summer")
    field = L.striped_field_material("SV field gold", (0.70, 0.48, 0.15, 1), (0.58, 0.40, 0.12, 1), stripe_scale=1.8, along="X")
    plane("SV edge ground", c, ox - 2500, oy - 600, ox + 2500, oy + 3000, 0.0, field)
    path_m = L.toon("SV dirt path", (0.48, 0.36, 0.22, 1), var=0.8)
    bm = bmesh.new()
    prev = None
    for x, y in ((-2, -40), (0, -10), (4, 20), (9, 50), (12, 78)):
        v1, v2 = bm.verts.new((ox + x - 1.4, oy + y, 0.03)), bm.verts.new((ox + x + 1.4, oy + y, 0.03))
        if prev:
            bm.faces.new((prev[0], prev[1], v2, v1))
        prev = (v1, v2)
    L.obj_from_bm("SV field path", bm, [path_m], c)
    road = L.concrete_road_material("SV village road", P["concrete"])
    plane("SV village road", c, ox - 300, oy + 78, ox + 300, oy + 83, 0.06, road)
    sc_ = L.coll("SV 3 scatter", c)
    for side, x0, x1 in (("L", -40, -3.4), ("R", 3.4, 45)):
        w = plane(f"SV gold wheat {side}", sc_, ox + x0, oy - 28, ox + x1, oy + 12, 0.0, M["wheat_gold"])
        L.scatter(w, LIB["wheat_gold"], 20, seed=90 if side == "L" else 91, scale=(0.85, 1.15), tilt=0.12)
    for k, (x0, x1) in enumerate(((-4.0, -2.3), (2.0, 4.6))):
        gp = plane(f"SV path verge {k}", sc_, ox + x0, oy - 30, ox + x1, oy + 12, 0.02, M["earth"])
        L.scatter(gp, LIB["grass"], 18, seed=92 + k, scale=(0.6, 1.2))
    stub = L.toon("SV stubble", (0.62, 0.50, 0.30, 1), var=0.8)
    plane("SV stubble", c, ox + 45, oy + 14, ox + 160, oy + 70, 0.015, stub)
    comb = L.make_combine("SV combine", c, [L.toon("SV combine red", (0.62, 0.06, 0.04, 1)), L.toon("SV cab glass", (0.25, 0.38, 0.42, 1)),
                                             L.toon("SV tyre", (0.04, 0.04, 0.04, 1)), M["wheat_gold"]])
    comb.location = (ox + 52, oy + 40, 0)
    comb.rotation_euler = (0, 0, math.radians(100))
    tri = L.make_tricycle("SV tricycle", c, [L.toon("SV trike teal", (0.10, 0.36, 0.38, 1)), L.toon("SV trike canopy", (0.12, 0.40, 0.22, 1)),
                                              L.toon("SV trike black", (0.03, 0.03, 0.03, 1)), L.toon("SV trike seat", (0.15, 0.10, 0.08, 1))])
    tri.location = (ox + 5.5, oy + 24, 0.03)
    tri.rotation_euler = (0, 0, math.radians(195))
    hut = L.make_well_hut("SV well hut", c, [M["whitewash"], L.toon("SV hut roof", (0.62, 0.62, 0.60, 1)), M["gate"]])
    hut.location = (ox - 16, oy + 30, 0)
    stake = L.toon("SV stake", (0.9, 0.9, 0.88, 1))
    for k in range(8):
        bm = bmesh.new()
        L.add_box(bm, (0, 0, 0.25), (0.12, 0.12, 0.5))
        o = L.obj_from_bm(f"SV stake {k}", bm, [stake], c)
        o.location = (ox + rng.uniform(-35, 35), oy + rng.uniform(-5, 60), 0)
    village_row(c, M, ox - 120, oy + 86, 240, rng, kit, depth_rows=3, prefix="edge")
    pole = L.make_pole("SV pole edge", L.coll("SV asset library"), [M["pole"], M["whitewash"]])
    pole.location = (0, 0, -500)
    prev = None
    for i in range(8):
        p = Vector((ox - 110 + i * 34, oy + 76, 0))
        L.link_dup(pole, c, p)
        if prev:
            for dx in (-0.7, 0.7):
                L.wire(f"SV edge wire {i} {dx}", c, M["wire"], prev + Vector((dx, 0, 8.7)), p + Vector((dx, 0, 8.7)), sag=0.8)
        prev = p
    for j in range(7):
        L.link_dup(rng.choice(kit["poplar"]), c, (ox - 30 + j * 4.5, oy + 60 + rng.uniform(-1, 1), 0), rng.uniform(0, 6), 1.0)
    horizon(L.coll("SV 3 horizon", c), M, kit, ox, oy, rng)
    clouds(c, M, (ox, oy, 0), (0, 1, 0), n=9, seed=3, height=(180, 420))
    return camera("CAM edge", (ox - 3.0, oy - 26, 1.6), (ox + 6.0, oy + 90, 7.0), lens=30)


def frame_edge(sun_o):
    set_tints((1.28, 0.92, 0.66, 1), (0.92, 0.84, 1.0, 1))
    set_sun(sun_o, 9, 282, (1.0, 0.62, 0.36), 5.5)
    set_sky((1.0, 0.70, 0.42, 1), (0.92, 0.72, 0.62, 1), (0.30, 0.42, 0.72, 1), (0.62, 0.58, 0.72, 1), 0.5)


# ---------------------------------------------------------------- vignette: the family courtyard (summer afternoon)

COURTYARD_COLLECTIONS = [
    "VIDEO 00 | Filmed house - architecture",
    "VIDEO 01 | Brick alley and neighboring walls",
    "VIDEO 03 | Ivy weeds and cut branches",
    "VIDEO 05 | Clean interiors and walkable stairs",
    "MAP | Photo roofscape",
]


def ramp_average(node):
    cs = [e.color for e in node.color_ramp.elements]
    return tuple(sum(c[i] for c in cs) / len(cs) for i in range(3)) + (1,)


def toonify(m):
    """Convert an appended photo-reconstruction material to the painted toon look, keeping its colour."""
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
        col = ramp_average(bc.links[0].from_node)
    # lift the dark, photo-measured values into the brighter painted palette
    col = tuple(min(1.0, (v ** 0.85) * 1.15) for v in col[:3]) + (1,)
    if alpha < 0.6 or trans > 0.05:
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        g = nt.nodes.new("ShaderNodeGroup")
        g.node_tree = L.toon_group()
        g.inputs["Base"].default_value = (0.40, 0.58, 0.60, 1)
        g.inputs["Shadow Tint"].default_value = L.SHADOW_TINT
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
        L.build_toon_nodes(m, col, var=1.2)
    m["sv_toon"] = True


def courtyard(M, LIB):
    with bpy.data.libraries.load(SOURCE, link=False) as (src, dst):
        dst.collections = [n for n in COURTYARD_COLLECTIONS if n in src.collections]
        dst.objects = [n for n in src.objects if n.startswith("VIDEO A |")]
    root = L.coll("SV 4 Courtyard")
    for cl in dst.collections:
        root.children.link(cl)
    cam = None
    for o in dst.objects:
        if o and o.type == "CAMERA":
            root.objects.link(o)
            cam = o
    mats = {m for cl in dst.collections for o in cl.all_objects if o.type == "MESH" for m in o.data.materials if m}
    for m in mats:
        toonify(m)
    rng = random.Random(44)
    kit = tree_kit(M, "summer")
    hx, hy = -37.0, -109.0
    plane("SV courtyard surroundings", root, hx - 600, hy - 600, hx + 600, hy + 600, -0.02, L.toon("SV yard ground", (0.40, 0.40, 0.36, 1), var=0.6))
    L.link_dup(kit["round"][0], root, (hx + 14, hy + 13, 0), 0.4, 1.3)
    L.link_dup(kit["round"][2], root, (hx - 16, hy + 18, 0), 2.0, 1.2)
    for j in range(6):
        L.link_dup(rng.choice(kit["poplar"]), root, (hx - 30 + j * 9, hy + 40 + rng.uniform(-4, 4), 0), rng.uniform(0, 6), 1.0)
    clouds(root, M, (hx, hy, 0), (0.3, 1, 0), n=8, seed=4, dist=(900, 1800), height=(220, 460))
    if cam:
        cam.data.clip_end = 8000
        courtyard_life(root, M, cam)
    return cam


def floor_at(x, y, top=2.6):
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, *_ = bpy.context.scene.ray_cast(dg, Vector((x, y, top)), Vector((0, 0, -1)))
    return loc.z if hit else 0.0


def floral_sheet():
    """Cream cotton with scattered pink and blue flowers, like the bed sheet drying in the courtyard video."""
    m = bpy.data.materials.new("SV floral sheet")
    nt = m.node_tree
    nt.nodes.clear()
    N, Ln = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    tc = N.new("ShaderNodeTexCoord")
    vor = N.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 9.0
    Ln.new(tc.outputs["Object"], vor.inputs["Vector"])
    lt = N.new("ShaderNodeMath")
    lt.operation = "LESS_THAN"
    lt.inputs[1].default_value = 0.22
    Ln.new(vor.outputs["Distance"], lt.inputs[0])
    pick = N.new("ShaderNodeMix")
    pick.data_type = "RGBA"
    pick.inputs["A"].default_value = (0.92, 0.40, 0.55, 1)
    pick.inputs["B"].default_value = (0.35, 0.50, 0.85, 1)
    gt = N.new("ShaderNodeMath")
    gt.operation = "GREATER_THAN"
    gt.inputs[1].default_value = 0.6
    Ln.new(vor.outputs["Color"], gt.inputs[0])
    Ln.new(gt.outputs[0], pick.inputs["Factor"])
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (0.93, 0.90, 0.82, 1)
    Ln.new(lt.outputs[0], mix.inputs["Factor"])
    Ln.new(pick.outputs["Result"], mix.inputs["B"])
    g = N.new("ShaderNodeGroup")
    g.node_tree = L.toon_group()
    g.inputs["Shadow Tint"].default_value = L.SHADOW_TINT
    g.inputs["Variation"].default_value = 0.2
    Ln.new(mix.outputs["Result"], g.inputs["Base"])
    Ln.new(g.outputs[0], out.inputs["Surface"])
    return m


def courtyard_life(root, M, cam):
    """Everyday courtyard objects seen in the photographs and videos (placed procedurally, tidy but lived-in)."""
    import bmesh
    c = L.coll("SV 4 courtyard life", root)
    bpy.context.view_layer.update()
    fw = cam.matrix_world.to_3x3() @ Vector((0, 0, -1))
    fw.z = 0
    fw.normalize()
    rt = Vector((fw.y, -fw.x, 0))
    base = cam.location.copy()
    red = L.toon("SV red plastic", (0.70, 0.04, 0.05, 1))
    green = L.toon("SV green plastic", (0.30, 0.62, 0.40, 1))
    pink = L.toon("SV pink basin", (0.92, 0.42, 0.52, 1))
    blue = L.toon("SV umbrella blue", (0.10, 0.20, 0.55, 1))
    sheet = floral_sheet()
    soil = L.toon("SV pot", (0.42, 0.20, 0.12, 1))
    leaf = M["poplar_summer_l"]
    chili = L.toon("SV chili", (0.75, 0.05, 0.03, 1))
    stalk = L.toon("SV bean stalks", (0.42, 0.42, 0.16, 1), var=1.0)

    def put(o, d_fw, d_rt, rot=0.0):
        p = base + fw * d_fw + rt * d_rt
        o.location = (p.x, p.y, floor_at(p.x, p.y))
        o.rotation_euler = (0, 0, math.atan2(fw.y, fw.x) + rot)
        return o

    def stool(name, mat):
        bm = bmesh.new()
        L.add_box(bm, (0, 0, 0.27), (0.3, 0.3, 0.05))
        for x in (-0.12, 0.12):
            for y in (-0.12, 0.12):
                L.add_box(bm, (x, y, 0.13), (0.04, 0.04, 0.26))
        return L.obj_from_bm(name, bm, [mat], c)

    def basin(name, mat, r=0.28):
        bm = bmesh.new()
        L.add_cyl(bm, (0, 0, 0), (0, 0, 0.14), r * 0.75, r, segs=18)
        return L.obj_from_bm(name, bm, [mat], c)

    put(stool("SV stool red", red), 4.2, -1.6, 0.3)
    put(stool("SV stool green", green), 4.6, -0.9, 0.9)
    put(basin("SV basin red", red), 5.2, -2.2)
    put(basin("SV basin pink", pink, 0.24), 5.6, -1.7)
    bm = bmesh.new()
    L.add_cyl(bm, (-1.6, 0, 0), (-1.6, 0, 1.9), 0.03, 0.03, segs=6, mat_index=0)
    L.add_cyl(bm, (1.6, 0, 0), (1.6, 0, 1.9), 0.03, 0.03, segs=6, mat_index=0)
    L.add_cyl(bm, (-1.6, 0, 1.85), (1.6, 0, 1.85), 0.008, 0.008, segs=4, mat_index=0)
    L.add_box(bm, (-0.3, 0, 1.3), (1.6, 0.02, 1.1), mat_index=1)
    L.add_box(bm, (0.95, 0, 1.55), (0.45, 0.02, 0.6), mat_index=2)
    put(L.obj_from_bm("SV laundry", bm, [M["frame"], sheet, red], c), 5.5, 2.6, math.pi / 2)
    rng = random.Random(5)
    for k in range(4):
        bm = bmesh.new()
        L.add_cyl(bm, (0, 0, 0), (0, 0, 0.32), 0.15, 0.2, segs=12, mat_index=0)
        for j in range(5):
            L.add_blob(bm, (rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 0.45 + rng.uniform(0, 0.25)), rng.uniform(0.12, 0.2), rng, sub=1, mat_index=1)
        put(L.obj_from_bm(f"SV pot {k}", bm, [soil, leaf], c), 7.4 + k * 0.05, -2.8 + k * 0.6)
    bm = bmesh.new()
    for j in range(16):
        L.add_blob(bm, (rng.uniform(-0.5, 0.5), rng.uniform(-0.4, 0.4), rng.uniform(0, 0.3)), rng.uniform(0.2, 0.35), rng, sub=1, jitter=0.3)
    put(L.obj_from_bm("SV stalk pile", bm, [stalk], c), 5.0, 3.6)
    tri = L.make_tricycle("SV yard tricycle", c, [L.toon("SV trike teal", (0.10, 0.36, 0.38, 1)), L.toon("SV trike canopy", (0.12, 0.40, 0.22, 1)),
                                                   L.toon("SV trike black", (0.03, 0.03, 0.03, 1)), L.toon("SV trike seat", (0.15, 0.10, 0.08, 1))])
    put(tri, 8.0, 4.2, 2.6)


def frame_courtyard(sun_o):
    set_tints((1.12, 1.02, 0.86, 1))
    set_sun(sun_o, 40, 228, (1.0, 0.88, 0.70), 4.5)
    set_sky((0.94, 0.88, 0.78, 1), (0.62, 0.75, 0.90, 1), (0.15, 0.37, 0.80, 1), (0.56, 0.64, 0.82, 1), 0.5)


FRAMES = {}


def frame_avenue(sun_o):
    set_tints((1.14, 1.03, 0.88, 1))
    set_sun(sun_o, 38, 245, (1.0, 0.88, 0.70), 4.5)
    set_sky((0.95, 0.80, 0.60, 1), (0.62, 0.72, 0.85, 1), (0.16, 0.38, 0.78, 1), (0.55, 0.62, 0.80, 1), 0.45)


# ---------------------------------------------------------------- main

sc = reset()
dome = world()
sun_o = sun()
M, LIB = assets()
cams = {}
if not ONLY or "avenue" in ONLY:
    cams["avenue"] = (avenue(M, LIB), frame_avenue)
    frame_avenue(sun_o)
if not ONLY or "pond" in ONLY:
    cams["pond"] = (pond(M, LIB), frame_pond)
if not ONLY or "edge" in ONLY:
    cams["edge"] = (edge(M, LIB), frame_edge)
if not ONLY or "courtyard" in ONLY:
    cams["courtyard"] = (courtyard(M, LIB), frame_courtyard)

os.makedirs(RENDER_DIR, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print("SAVED", OUT_BLEND)

if RENDER:
    for name, (cam, light) in cams.items():
        if "all" not in RENDER and name not in RENDER:
            continue
        sc.camera = cam
        dome.location = cam.location
        light(sun_o)
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(RENDER_DIR, f"{name}{'_preview' if PREVIEW else ''}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)
