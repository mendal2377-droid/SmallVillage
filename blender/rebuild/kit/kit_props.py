"""SmallVillage kit batch 4: courtyard and farm props, and vehicles.

Everyday objects from the house photographs and videos: plastic stools and basins, the twin-tub washing
machine, laundry, umbrellas, potted plants, chilli strings, drying corn, bean-stalk and straw stacks,
brooms, the electric tricycle with its green canopy and the green e-scooter in the alley. Farm vehicles
(walking tractor, small tractor, combine harvester) are generic regional types, not specific models.

Vehicles tag their wheel vertices in a 'wheels' vertex group and store wheel centres/radii in
`sv_wheels` ("x,y,z,r;...") so the web build can split and spin them.
"""
import math
import random

from mathutils import Vector

from kit_buildings import MeshWriter


def _meta(family, lod, kind="prop", extra=None):
    d = {"sv_kind": kind, "sv_family": family, "sv_state": "standing", "sv_lod": lod}
    d.update(extra or {})
    return d


def _ring_y(m, center, r_out, width, slot, segs=12):
    """Cylinder whose axis is X (wheel / roller) centred at center."""
    c = Vector(center)
    return m.cyl(c - Vector((width / 2, 0, 0)), c + Vector((width / 2, 0, 0)), r_out, r_out, slot, segs=segs)


def wheel(m, center, r, width, lod, hub=True):
    vs = m.tag(_ring_y(m, center, r, width, "tyre", segs={0: 14, 1: 8}.get(lod, 6)), "wheels")
    if hub and lod == 0:
        m.tag(_ring_y(m, center, r * 0.55, width + 0.02, "hub", segs=10), "wheels")
    return vs


# ---------------------------------------------------------------- courtyard props


def stool(coll, slot="plastic_red", kid_chair=False):
    m = MeshWriter(0)
    s = 0.3 if not kid_chair else 0.28
    h = 0.27 if not kid_chair else 0.24
    m.box((0, 0, h), (s, s, 0.04), slot)
    for x in (-s * 0.4, s * 0.4):
        for y in (-s * 0.4, s * 0.4):
            m.cyl((x, y, 0), (x * 0.9, y * 0.9, h), 0.022, 0.02, slot, segs=5)
    if kid_chair:
        m.box((0, s * 0.45, h + 0.17), (s, 0.03, 0.3), slot)
        for x in (-s * 0.4, s * 0.4):
            m.box((x, s * 0.45, h + 0.1), (0.03, 0.03, 0.2), slot)
    nm = "kid chair" if kid_chair else "stool"
    return m.finish(f"KIT {nm} {slot.split('_')[-1]}", coll, _meta(nm, 0))


def basin(coll, slot="plastic_red", r=0.28, h=0.14):
    m = MeshWriter(0)
    m.cyl((0, 0, 0), (0, 0, h), r * 0.75, r, slot, segs=16)
    m.cyl((0, 0, h - 0.01), (0, 0, h + 0.015), r + 0.02, r + 0.02, slot, segs=16)
    m.cyl((0, 0, h - 0.02), (0, 0, h + 0.001), r - 0.02, r - 0.02, "water_light", segs=12)  # a little water
    return m.finish(f"KIT basin {slot.split('_')[-1]}", coll, _meta("basin", 0, extra={"sv_variant": slot}))


def bucket(coll, slot="plastic_red"):
    m = MeshWriter(0)
    m.cyl((0, 0, 0), (0, 0, 0.32), 0.12, 0.16, slot, segs=14)
    for k in range(6):
        a0, a1 = math.pi * k / 6, math.pi * (k + 1) / 6
        m.cyl((math.cos(a0) * 0.15, 0, 0.32 + math.sin(a0) * 0.12), (math.cos(a1) * 0.15, 0, 0.32 + math.sin(a1) * 0.12), 0.006, 0.006, "steel_dark", segs=3)
    return m.finish(f"KIT bucket {slot.split('_')[-1]}", coll, _meta("bucket", 0))


def washing_machine(coll):
    """Twin-tub washing machine standing under the eaves (courtyard photos)."""
    m = MeshWriter(0)
    m.box((0, 0, 0.42), (0.78, 0.46, 0.84), "ac_white")
    m.box((0, 0, 0.86), (0.8, 0.48, 0.04), "glass_light")
    m.box((0, -0.18, 0.78), (0.76, 0.12, 0.12), "ac_white")
    for x in (-0.25, 0.0, 0.25):
        m.cyl((x, -0.245, 0.78), (x, -0.255, 0.78), 0.035, 0.035, "plastic_blue", segs=8)
    m.box((0, -0.235, 0.05), (0.7, 0.02, 0.08), "frame_dark")
    return m.finish("KIT washing machine", coll, _meta("washing machine", 0))


def laundry_line(coll):
    """Two steel poles, a line, a floral sheet, shirt and towel (courtyard video)."""
    m = MeshWriter(0)
    for x in (-1.8, 1.8):
        m.cyl((x, 0, 0), (x, 0, 1.95), 0.025, 0.02, "rail_steel", segs=6)
    m.cyl((-1.8, 0, 1.9), (1.8, 0, 1.9), 0.006, 0.006, "steel_dark", segs=3)
    # floral sheet as two layers so the pattern stripes read: cream with pink bands
    m.box((-0.45, 0, 1.3), (1.7, 0.015, 1.15), "cloth_cream")
    for k in range(4):
        m.box((-0.45, -0.012, 0.85 + k * 0.28), (1.7, 0.012, 0.06), "flower_pink")
    m.box((0.85, 0, 1.55), (0.5, 0.015, 0.65), "cloth_blue")  # shirt body
    m.box((0.85, 0, 1.78), (0.85, 0.015, 0.18), "cloth_blue")  # sleeves
    m.box((1.4, 0, 1.6), (0.32, 0.015, 0.55), "plastic_red")  # towel
    return m.finish("KIT laundry line", coll, _meta("laundry line", 0))


def umbrella(coll, open_=True, slot_a="umbrella_navy", slot_b="cloth_check"):
    """Folding umbrella: open canopy with alternating panels, or closed."""
    m = MeshWriter(0)
    if not open_:
        m.cyl((0, 0, 0), (0, 0, 0.85), 0.006, 0.006, "steel_dark", segs=4)
        m.cyl((0, 0, 0.12), (0, 0, 0.75), 0.05, 0.015, slot_a, segs=8)
        return m.finish("KIT umbrella closed", coll, _meta("umbrella", 0, extra={"sv_state": "closed"}))
    r, h = 0.55, 0.32
    ribs = 8
    m.cyl((0, 0, 0), (0, 0, 0.9), 0.008, 0.008, "steel_dark", segs=4)
    for k in range(ribs):
        a0, a1 = 2 * math.pi * k / ribs, 2 * math.pi * (k + 1) / ribs
        tip = (0, 0, 0.9)
        p0 = (math.cos(a0) * r, math.sin(a0) * r, 0.9 - h)
        p1 = (math.cos(a1) * r, math.sin(a1) * r, 0.9 - h)
        mid0 = (math.cos(a0) * r * 0.6, math.sin(a0) * r * 0.6, 0.9 - h * 0.25)
        mid1 = (math.cos(a1) * r * 0.6, math.sin(a1) * r * 0.6, 0.9 - h * 0.25)
        slot = slot_a if k % 2 == 0 else slot_b
        m.poly([tip, mid0, mid1], slot)
        m.poly([mid0, p0, p1, mid1], slot)
    return m.finish("KIT umbrella open", coll, _meta("umbrella", 0, extra={"sv_state": "open"}))


def potted_plant(coll, variant=0):
    rng = random.Random(40 + variant)
    m = MeshWriter(0)
    m.cyl((0, 0, 0), (0, 0, 0.3), 0.14, 0.19, "pot_clay", segs=12)
    m.cyl((0, 0, 0.28), (0, 0, 0.33), 0.2, 0.2, "pot_clay", segs=12)
    for k in range(7 if variant == 0 else 5):
        m.blob((rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 0.42 + rng.uniform(0, 0.25)), rng.uniform(0.1, 0.17),
               "hedge_l" if k % 2 else "hedge_d", rng, sub=1, jitter=0.2)
    if variant == 1:
        for k in range(6):
            m.blob((rng.uniform(-0.13, 0.13), rng.uniform(-0.13, 0.13), 0.62 + rng.uniform(0, 0.1)), 0.035, "plastic_red", rng, sub=1, jitter=0.1)
    return m.finish(f"KIT potted plant {variant}", coll, _meta("potted plant", 0, extra={"sv_variant": variant}))


def chilli_string(coll):
    rng = random.Random(77)
    m = MeshWriter(0)
    m.cyl((0, 0, 0), (0, 0, 1.1), 0.004, 0.004, "straw_d", segs=3)
    for j in range(22):
        z = 1.05 - j * 0.045
        a = rng.uniform(0, 6.28)
        m.blob((math.cos(a) * 0.04, math.sin(a) * 0.04, z), 0.035, "plastic_red", rng, sub=1, squash=(0.7, 0.7, 1.7), jitter=0.1)
    return m.finish("KIT chilli string", coll, _meta("chilli string", 0, extra={"sv_months": "9,10,11,12,1,2"}))


def corn_drying(coll, w=2.4, d=1.6):
    """Shelled corn spread to dry on a mat, with a small heap (corridor and yard, Sep-Oct)."""
    rng = random.Random(91)
    m = MeshWriter(0)
    m.box((0, 0, 0.005), (w + 0.2, d + 0.2, 0.01), "cloth_blue")
    m.box((0, 0, 0.02), (w, d, 0.02), "cob")
    for k in range(18):
        m.blob((rng.uniform(-w / 2 + 0.15, w / 2 - 0.15), rng.uniform(-d / 2 + 0.15, d / 2 - 0.15), 0.03), rng.uniform(0.06, 0.12),
               "cob" if k % 3 else "combine_yellow", rng, sub=1, squash=(1, 1, 0.3), jitter=0.2)
    m.blob((w * 0.32, 0, 0.0), 0.32, "cob", rng, sub=2, squash=(1.3, 1, 0.5), jitter=0.08)
    return m.finish("KIT corn drying", coll, _meta("corn drying", 0, extra={"sv_months": "9,10"}))


def corn_cob_pile(coll):
    rng = random.Random(92)
    m = MeshWriter(0)
    for k in range(26):
        layer = k // 10
        a = rng.uniform(0, 6.28)
        r = rng.uniform(0, 0.45 - layer * 0.14)
        c = Vector((math.cos(a) * r, math.sin(a) * r, 0.05 + layer * 0.08))
        d = Vector((math.cos(a + 1.5), math.sin(a + 1.5), 0)) * 0.09
        m.cyl(c - d, c + d, 0.035, 0.03, "cob", segs=6)
    return m.finish("KIT corn cob pile", coll, _meta("corn cob pile", 0, extra={"sv_months": "9,10,11"}))


def broom(coll):
    """Bamboo yard broom leaning, as in the courtyard photos."""
    rng = random.Random(5)
    m = MeshWriter(0)
    m.cyl((0, 0, 0.35), (0.15, 0, 1.45), 0.015, 0.012, "bamboo", segs=5)
    for k in range(12):
        a = rng.uniform(-0.6, 0.6)
        m.cyl((0.0, 0, 0.42), (math.sin(a) * 0.3, rng.uniform(-0.08, 0.08), 0.02), 0.012, 0.004, "straw_d", segs=3)
    return m.finish("KIT bamboo broom", coll, _meta("broom", 0))


def drying_rack(coll):
    """X-stand clothes rack (courtyard video)."""
    m = MeshWriter(0)
    for s in (-1, 1):
        m.cyl((-0.5, s * 0.35, 0), (0.5, -s * 0.35, 1.6), 0.015, 0.015, "rail_steel", segs=5)
        m.cyl((0.5, s * 0.35, 0), (-0.5, -s * 0.35, 1.6), 0.015, 0.015, "rail_steel", segs=5)
    m.cyl((0, -0.55, 1.6), (0, 0.55, 1.6), 0.012, 0.012, "rail_steel", segs=5)
    m.box((0, 0.2, 1.3), (0.02, 0.4, 0.6), "cloth_blue")
    return m.finish("KIT drying rack", coll, _meta("drying rack", 0))


def low_table(coll):
    m = MeshWriter(0)
    m.box((0, 0, 0.42), (0.9, 0.6, 0.04), "plastic_red")
    for x in (-0.4, 0.4):
        for y in (-0.25, 0.25):
            m.box((x, y, 0.2), (0.04, 0.04, 0.4), "wood_d")
    return m.finish("KIT low table", coll, _meta("low table", 0))


def urns(coll):
    """Glazed storage urns on the roof terrace."""
    rng = random.Random(6)
    m = MeshWriter(0)
    for k, (x, r) in enumerate(((-0.35, 0.2), (0.05, 0.16), (0.4, 0.22))):
        m.cyl((x, 0, 0), (x, 0, r * 1.1), r * 0.7, r, "urn", segs=12)
        m.cyl((x, 0, r * 1.1), (x, 0, r * 1.6), r, r * 0.55, "urn", segs=12)
        m.cyl((x, 0, r * 1.6), (x, 0, r * 1.7), r * 0.5, r * 0.5, "urn", segs=12)
    return m.finish("KIT urns", coll, _meta("urns", 0))


def satellite_dish(coll):
    m = MeshWriter(0)
    m.cyl((0, 0, 0), (0, 0, 0.6), 0.025, 0.02, "steel_dark", segs=5)
    m.push((0, 0, 0.75), 0.4)
    m.cyl((0, -0.05, 0), (0, 0.15, 0.25), 0.42, 0.05, "hub", segs=14)
    m.cyl((0, 0.15, 0.25), (0, -0.3, -0.05), 0.01, 0.01, "steel_dark", segs=3)
    m.pop()
    return m.finish("KIT satellite dish", coll, _meta("satellite dish", 0))


def trash_bin(coll):
    m = MeshWriter(0)
    m.box((0, 0, 0.5), (0.55, 0.6, 1.0), "bin_green")
    m.box((0, 0.02, 1.03), (0.6, 0.66, 0.06), "bin_green")
    for x in (-0.22, 0.22):
        m.tag(m.cyl((x - 0.03, 0.32, 0.1), (x + 0.03, 0.32, 0.1), 0.1, 0.1, "tyre", segs=8), "wheels")
    return m.finish("KIT trash bin", coll, _meta("trash bin", 0))


# ---------------------------------------------------------------- farm props


def straw_stack(coll, variant=0):
    """Wheat-straw stack (草垛): a beehive dome on a short drum, rough with tufts and a twisted cap."""
    rng = random.Random(60 + variant)
    m = MeshWriter(0)
    r, h = rng.uniform(1.1, 1.5), rng.uniform(0.7, 1.0)
    m.cyl((0, 0, 0), (0, 0, h), r * 0.95, r, "straw", segs=16)
    m.blob((0, 0, h - 0.05), r * 1.0, "straw", rng, sub=2, squash=(1, 1, 1.25), jitter=0.06)
    m.blob((0, 0, h + r * 1.2), r * 0.28, "straw_d", rng, sub=1, squash=(1, 1, 0.8), jitter=0.2)
    for k in range(14):
        a = rng.uniform(0, 6.28)
        t = rng.uniform(0.0, 1.0)
        z = t * (h + r * 0.9)
        rr = r * (1.0 if z < h else max(0.3, math.cos(math.asin(min(0.99, (z - h) / (r * 1.25))))))
        m.blob((math.cos(a) * rr, math.sin(a) * rr, z), rng.uniform(0.12, 0.24), "straw_d", rng, sub=1, squash=(1, 1, 0.5), jitter=0.3)
    return m.finish(f"KIT straw stack {variant}", coll, _meta("straw stack", 0, extra={"sv_variant": variant, "sv_months": "6,7,8,9,10,11,12,1,2,3"}))


def stalk_pile(coll, slot="husk", variant=0):
    """Pile of bean or corn stalks drying in a corner (photos)."""
    rng = random.Random(70 + variant)
    m = MeshWriter(0)
    for k in range(40):
        a = rng.uniform(0, 6.28)
        r = rng.uniform(0, 0.6)
        c = Vector((math.cos(a) * r, math.sin(a) * r * 0.7, rng.uniform(0.05, 0.4) * (1 - r)))
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.2, 0.3))).normalized() * rng.uniform(0.25, 0.5)
        m.cyl(c - d, c + d, 0.012, 0.008, slot if k % 3 else "straw_d", segs=3)
    for k in range(5):
        m.blob((rng.uniform(-0.3, 0.3), rng.uniform(-0.2, 0.2), 0.1), rng.uniform(0.15, 0.25), slot, rng, sub=1, squash=(1, 1, 0.5), jitter=0.35)
    return m.finish(f"KIT stalk pile {variant}", coll, _meta("stalk pile", 0, extra={"sv_variant": variant}))


def firewood_bundle(coll):
    rng = random.Random(81)
    m = MeshWriter(0)
    for k in range(18):
        y, z = rng.uniform(-0.18, 0.18), rng.uniform(0.04, 0.34)
        m.cyl((-0.7 + rng.uniform(-0.1, 0.1), y, z), (0.7 + rng.uniform(-0.1, 0.1), y + rng.uniform(-0.05, 0.05), z), 0.025, 0.02, "bark", segs=4)
    for x in (-0.35, 0.35):
        m.cyl((x, -0.22, 0.2), (x, 0.22, 0.2), 0.2, 0.2, "straw_d", segs=8)
    return m.finish("KIT firewood bundle", coll, _meta("firewood", 0))


def brick_stack(coll):
    """Neat stack of spare bricks, courses laid crosswise."""
    m = MeshWriter(0)
    for z in range(6):
        zc = 0.03 + z * 0.058
        for i in (-1, 1):
            for j in (-1.5, -0.5, 0.5, 1.5):
                if z % 2 == 0:
                    m.box((i * 0.12, j * 0.118, zc), (0.235, 0.113, 0.053), "brick_red")
                else:
                    m.box((j * 0.118, i * 0.12, zc), (0.113, 0.235, 0.053), "brick_red")
    return m.finish("KIT brick stack", coll, _meta("brick stack", 0))


def bamboo_basket(coll):
    m = MeshWriter(0)
    m.cyl((0, 0, 0), (0, 0, 0.35), 0.18, 0.26, "bamboo", segs=14)
    for z in (0.1, 0.22, 0.34):
        m.cyl((0, 0, z), (0, 0, z + 0.015), 0.19 + z * 0.22, 0.19 + z * 0.22, "straw_d", segs=14)
    return m.finish("KIT bamboo basket", coll, _meta("basket", 0))


def handcart(coll, lod=0):
    """Two-wheeled wooden farm handcart (架子车) with long shafts."""
    m = MeshWriter(lod)
    m.box((0, 0, 0.62), (1.1, 1.9, 0.05), "wood")
    if lod == 0:
        for x in (-0.55, 0.55):
            m.box((x, 0, 0.75), (0.05, 1.9, 0.22), "wood_d")
        m.box((0, -0.95, 0.75), (1.1, 0.05, 0.22), "wood_d")
    for x in (-0.48, 0.48):
        m.box((x, 1.85, 0.55), (0.06, 2.0, 0.06), "wood_d")
    m.cyl((-0.68, 0, 0.36), (0.68, 0, 0.36), 0.025, 0.025, "steel_dark", segs=5)
    for x in (-0.7, 0.7):
        wheel(m, (x, 0, 0.36), 0.36, 0.09, lod)
    return m.finish(f"KIT handcart L{lod}", coll, _meta("handcart", lod, "vehicle", {"sv_wheels": "-0.7,0,0.36,0.36;0.7,0,0.36,0.36"}))


# ---------------------------------------------------------------- vehicles


def tricycle(coll, lod=0):
    """Electric cargo tricycle with a green canopy (seen in the courtyard and on the field path)."""
    m = MeshWriter(lod)
    m.box((0, -0.25, 0.5), (1.05, 1.35, 0.08), "trike_teal")
    for x in (-0.52, 0.52):
        m.box((x, -0.25, 0.68), (0.04, 1.35, 0.32), "trike_teal")
    m.box((0, -0.92, 0.68), (1.05, 0.04, 0.32), "trike_teal")
    m.box((0, 0.75, 0.62), (0.62, 0.75, 0.42), "trike_teal")  # cab body
    m.box((0, 0.82, 0.95), (0.46, 0.38, 0.12), "seat_black")
    # canopy on four posts
    for x in (-0.52, 0.52):
        for y in (-0.15, 1.25):
            m.cyl((x, y, 0.6), (x, y, 1.75), 0.018, 0.018, "steel_dark", segs=5)
    m.box((0, 0.55, 1.78), (1.15, 1.65, 0.05), "canopy_green")
    if lod == 0:
        for x in (-0.58, 0.58):
            m.box((x, 0.55, 1.55), (0.02, 1.6, 0.42), "canopy_green")
        m.cyl((0, 1.45, 0.4), (0, 1.32, 1.18), 0.03, 0.03, "steel_dark", segs=5)
        m.cyl((-0.33, 1.32, 1.18), (0.33, 1.32, 1.18), 0.018, 0.018, "steel_dark", segs=5)
        m.box((0, 1.5, 0.75), (0.2, 0.06, 0.12), "lamp")
    wheels = [(-0.56, -0.55, 0.26, 0.26), (0.56, -0.55, 0.26, 0.26), (0, 1.5, 0.26, 0.26)]
    for x, y, z, r in wheels:
        wheel(m, (x, y, z), r, 0.11, lod)
    return m.finish(f"KIT electric tricycle L{lod}", coll,
                    _meta("electric tricycle", lod, "vehicle", {"sv_wheels": ";".join(",".join(str(v) for v in w) for w in wheels)}))


def scooter(coll, lod=0):
    """Green-and-white electric scooter (parked in the alley video)."""
    m = MeshWriter(lod)
    m.box((0, 0, 0.42), (0.3, 0.9, 0.14), "scooter_green")
    m.box((0, -0.25, 0.62), (0.32, 0.6, 0.28), "scooter_green")
    m.box((0, -0.25, 0.8), (0.3, 0.55, 0.08), "seat_black")
    m.box((0, 0.45, 0.75), (0.32, 0.12, 0.6), "ac_white")
    m.cyl((0, 0.52, 0.3), (0, 0.45, 1.05), 0.025, 0.025, "steel_dark", segs=5)
    m.cyl((-0.32, 0.45, 1.05), (0.32, 0.45, 1.05), 0.016, 0.016, "steel_dark", segs=5)
    if lod == 0:
        m.box((0, 0.53, 0.98), (0.24, 0.06, 0.14), "lamp")
        m.box((0, -0.62, 0.7), (0.34, 0.3, 0.04), "plastic_blue")  # rear basket
    wheels = [(0, -0.48, 0.24, 0.24), (0, 0.6, 0.24, 0.24)]
    for x, y, z, r in wheels:
        wheel(m, (x, y, z), r, 0.09, lod)
    return m.finish(f"KIT e-scooter L{lod}", coll,
                    _meta("e-scooter", lod, "vehicle", {"sv_wheels": ";".join(",".join(str(v) for v in w) for w in wheels)}))


def walking_tractor(coll, lod=0):
    """Two-wheel walking tractor (手扶拖拉机) towing a small trailer, the classic village workhorse."""
    m = MeshWriter(lod)
    # engine unit
    m.box((0, 1.1, 0.7), (0.55, 0.9, 0.5), "tractor_red")
    m.box((0, 1.55, 0.85), (0.5, 0.25, 0.55), "engine_grey")  # radiator / water tank
    if lod == 0:
        m.cyl((0.18, 1.0, 0.95), (0.18, 1.0, 1.55), 0.04, 0.04, "steel_dark", segs=6)  # exhaust
        m.cyl((-0.35, 1.2, 0.7), (-0.42, 1.2, 0.7), 0.22, 0.22, "steel_dark", segs=10)  # flywheel
        for x in (-0.1, 0.1):
            m.box((x, 0.95, 0.45), (0.05, 0.9, 0.05), "steel_dark")
    # long handlebars reaching back to the driver
    for x in (-0.3, 0.3):
        m.cyl((x * 0.5, 0.75, 0.8), (x * 1.6, -0.6, 1.1), 0.02, 0.02, "steel_dark", segs=5)
    # trailer
    m.box((0, -1.4, 0.65), (1.35, 1.8, 0.06), "tractor_blue")
    for x in (-0.66, 0.66):
        m.box((x, -1.4, 0.85), (0.04, 1.8, 0.36), "tractor_blue")
    m.box((0, -2.3, 0.85), (1.35, 0.04, 0.36), "tractor_blue")
    m.box((0, -0.45, 0.85), (1.35, 0.04, 0.36), "tractor_blue")
    m.box((0, -0.25, 0.85), (0.5, 0.4, 0.06), "seat_black")
    wheels = [(-0.42, 1.05, 0.42, 0.42), (0.42, 1.05, 0.42, 0.42), (-0.75, -1.5, 0.32, 0.32), (0.75, -1.5, 0.32, 0.32)]
    for x, y, z, r in wheels:
        wheel(m, (x, y, z), r, 0.16 if r > 0.4 else 0.12, lod)
    return m.finish(f"KIT walking tractor L{lod}", coll,
                    _meta("walking tractor", lod, "vehicle", {"sv_wheels": ";".join(",".join(str(v) for v in w) for w in wheels)}))


def tractor(coll, lod=0):
    """Small four-wheel farm tractor."""
    m = MeshWriter(lod)
    m.box((0, 0.7, 0.85), (0.7, 1.5, 0.6), "tractor_red")  # bonnet
    m.box((0, 1.45, 0.8), (0.65, 0.08, 0.5), "engine_grey")
    m.box((0, -0.35, 0.75), (1.0, 0.9, 0.4), "tractor_red")
    m.box((0, -0.45, 1.05), (0.42, 0.4, 0.12), "seat_black")
    m.box((0, -0.7, 1.3), (0.4, 0.06, 0.5), "seat_black")
    # cab roof frame
    for x in (-0.5, 0.5):
        for y in (-0.8, 0.0):
            m.cyl((x, y, 0.95), (x, y, 2.15), 0.025, 0.025, "steel_dark", segs=5)
    m.box((0, -0.4, 2.18), (1.15, 1.0, 0.06), "tractor_red")
    if lod == 0:
        m.cyl((0.25, 0.9, 1.15), (0.25, 0.9, 1.9), 0.04, 0.04, "steel_dark", segs=6)
        m.cyl((0, 0.2, 1.2), (0, -0.1, 1.05), 0.12, 0.12, "steel_dark", segs=10)  # steering wheel
        for x in (-0.6, 0.6):
            m.box((x, -0.55, 1.25), (0.25, 0.9, 0.04), "tractor_red")  # rear mudguards
    wheels = [(-0.62, -0.55, 0.62, 0.62), (0.62, -0.55, 0.62, 0.62), (-0.48, 1.05, 0.36, 0.36), (0.48, 1.05, 0.36, 0.36)]
    for x, y, z, r in wheels:
        wheel(m, (x, y, z), r, 0.3 if r > 0.5 else 0.16, lod)
    return m.finish(f"KIT tractor L{lod}", coll,
                    _meta("tractor", lod, "vehicle", {"sv_wheels": ";".join(",".join(str(v) for v in w) for w in wheels)}))


def combine(coll, lod=0):
    """Generic wheat combine harvester (late-May harvest): header with reel, cab, grain tank, unloading auger."""
    m = MeshWriter(lod)
    m.box((0, 0, 1.5), (2.6, 4.6, 1.9), "combine_red")  # body
    m.box((0, 0.6, 2.85), (2.2, 2.0, 0.8), "combine_red")  # grain tank
    m.box((0, -1.55, 3.0), (1.6, 1.4, 1.3), "glass")  # cab glass
    m.box((0, -1.55, 3.72), (1.75, 1.55, 0.12), "combine_red")
    if lod == 0:
        for x in (-0.79, 0.79):
            m.box((x, -1.55, 3.0), (0.05, 1.4, 1.3), "combine_red")
        m.box((0, -2.24, 3.0), (1.6, 0.05, 0.05), "combine_red")
        m.box((0, 2.3, 1.3), (2.0, 0.06, 1.2), "engine_grey")  # rear grille
        m.box((1.31, 0.6, 1.8), (0.02, 1.4, 0.5), "combine_yellow")  # side stripe
        m.box((-1.31, 0.6, 1.8), (0.02, 1.4, 0.5), "combine_yellow")
    # header (cutting table) and reel
    m.box((0, -3.0, 0.6), (4.6, 1.3, 0.5), "combine_red")
    m.box((0, -3.62, 0.38), (4.6, 0.08, 0.06), "steel_dark")  # cutter bar
    m.box((0, -2.2, 1.0), (1.2, 0.9, 0.9), "combine_red")  # feeder house
    reel = m.cyl((-2.2, -3.25, 1.45), (2.2, -3.25, 1.45), 0.5 if lod == 0 else 0.45, 0.5 if lod == 0 else 0.45,
                 "combine_yellow", segs=8 if lod == 0 else 6)
    m.tag(reel, "reel")
    if lod == 0:
        for x in (-2.3, 2.3):
            m.box((x, -2.6, 1.3), (0.06, 1.4, 0.06), "combine_yellow")
    # unloading auger folded back along the side
    m.cyl((1.2, 1.5, 3.0), (1.6, -1.5, 3.4), 0.15, 0.15, "combine_red", segs=8 if lod == 0 else 5)
    wheels = [(-1.25, -0.9, 0.8, 0.8), (1.25, -0.9, 0.8, 0.8), (-1.1, 1.6, 0.5, 0.5), (1.1, 1.6, 0.5, 0.5)]
    for x, y, z, r in wheels:
        wheel(m, (x, y, z), r, 0.45 if r > 0.6 else 0.3, lod)
    return m.finish(f"KIT combine harvester L{lod}", coll,
                    _meta("combine harvester", lod, "vehicle", {"sv_wheels": ";".join(",".join(str(v) for v in w) for w in wheels),
                                                                "sv_months": "5,6"}))
