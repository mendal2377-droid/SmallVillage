"""SmallVillage kit batch 3: infrastructure.

Linear modules (roads, lanes, field paths, ditches, river banks) run along local +Y from y = 0 to y = L and
are centred on x = 0, so the layout phase can chain them end to end. Ground level is z = 0. Ditches and
the river are cut below ground: the layout terrain must be lowered or opened along their footprint
(their top flanges overlap the terrain edge to hide the seam).

From the photographs: concrete slab roads with dark expansion joints and hairline cracks, dirt shoulders,
herringbone brick alley paving, earth field paths with wheel ruts and a grass crown, drainage ditches,
white concrete culvert bridges with balustrades (photo 13), concrete utility poles with sagging wires,
small white irrigation well huts and white field stakes (photos 09-12).
"""
import math
import random

from mathutils import Vector

from kit_buildings import MeshWriter


def _meta(family, lod, length=None, width=None, extra=None):
    d = {"sv_kind": "infra", "sv_family": family, "sv_state": "module", "sv_lod": lod}
    if length is not None:
        d["sv_length"] = float(length)
    if width is not None:
        d["sv_width"] = float(width)
    d.update(extra or {})
    return d


def extrude_profile(m, profile, length, segs=1):
    """profile: list of (x, z, slot) cross-section points; slot colours the strip to the next point."""
    for k in range(segs):
        y0, y1 = length * k / segs, length * (k + 1) / segs
        for (x0, z0, slot), (x1, z1, _) in zip(profile, profile[1:]):
            m.poly([(x0, y0, z0), (x1, y0, z1), (x1, y1, z1), (x0, y1, z0)], slot)


# ---------------------------------------------------------------- roads and paths


def concrete_road(coll, width=4.5, length=5.0, lod=0, seed=0):
    """Village concrete road slab with a joint at y = 0, hairline cracks and sloping dirt shoulders."""
    rng = random.Random(seed + int(width * 10))
    m = MeshWriter(lod)
    top = 0.12
    m.box((0, length / 2, top / 2), (width, length, top), "concrete")
    if lod <= 1:
        m.box((0, 0.02, top / 2 + 0.001), (width, 0.04, top), "concrete_joint")
        sh = 0.8
        for s in (-1, 1):
            x0, x1 = s * width / 2, s * (width / 2 + sh)
            pts = [(x0, 0, top - 0.02), (x1, 0, 0.0), (x1, length, 0.0), (x0, length, top - 0.02)]
            m.poly(pts if s > 0 else pts[::-1], "dirt")
    if lod == 0:
        # two or three hairline cracks: thin zig-zag strips on the slab surface
        for c in range(rng.randint(2, 3)):
            x = rng.uniform(-width * 0.35, width * 0.35)
            y = rng.uniform(0.4, length - 1.6)
            ang = rng.uniform(-0.6, 0.6) + (math.pi / 2 if rng.random() < 0.5 else 0)
            for k in range(rng.randint(3, 5)):
                ln = rng.uniform(0.25, 0.6)
                ang += rng.uniform(-0.5, 0.5)
                dx, dy = math.cos(ang) * ln, math.sin(ang) * ln
                nx, ny = -math.sin(ang) * 0.012, math.cos(ang) * 0.012
                x1, y1 = max(-width / 2 + 0.05, min(width / 2 - 0.05, x + dx)), max(0.05, min(length - 0.05, y + dy))
                m.poly([(x - nx, y - ny, top + 0.002), (x1 - nx, y1 - ny, top + 0.002), (x1 + nx, y1 + ny, top + 0.002),
                        (x + nx, y + ny, top + 0.002)], "concrete_joint")
                x, y = x1, y1
    name = {4.5: "road main", 3.0: "road lane", 2.4: "road field"}.get(width, f"road {width}m")
    return m.finish(f"KIT {name} L{lod}", coll, _meta(name, lod, length, width))


def road_junction(coll, width=4.5, lod=0):
    m = MeshWriter(lod)
    m.box((0, width / 2, 0.06), (width, width, 0.12), "concrete")
    if lod == 0:
        m.box((0, 0.02, 0.0605), (width, 0.04, 0.12), "concrete_joint")
        m.box((0, width - 0.02, 0.0605), (width, 0.04, 0.12), "concrete_joint")
    return m.finish(f"KIT road junction L{lod}", coll, _meta("road junction", lod, width, width))


def brick_alley(coll, width=2.2, length=5.0, lod=0, seed=0):
    """Herringbone brick paving of the alley beside the house (video), with mossy edges."""
    rng = random.Random(seed + 31)
    m = MeshWriter(lod)
    m.box((0, length / 2, 0.025), (width, length, 0.05), "paving_brick_d")
    if lod == 0:
        bl, bw = 0.24, 0.115
        step = bw * 2 ** 0.5
        z = 0.052
        for ix in range(int(width / step) + 2):
            for iy in range(int(length / step) + 2):
                cx = -width / 2 + (ix + 0.5) * step
                cy = (iy + 0.5) * step
                ang = math.radians(45 if (ix + iy) % 2 == 0 else -45)
                ca, sa = math.cos(ang), math.sin(ang)
                hl, hw = bl / 2 - 0.006, bw / 2 - 0.006
                pts = []
                for px, py in ((-hl, -hw), (hl, -hw), (hl, hw), (-hl, hw)):
                    x, y = cx + px * ca - py * sa, cy + px * sa + py * ca
                    pts.append((max(-width / 2, min(width / 2, x)), max(0, min(length, y)), z))
                slot = "paving_brick" if rng.random() < 0.8 else ("moss" if abs(cx) > width * 0.35 else "paving_brick_d")
                m.poly(pts, slot)
    elif lod == 1:
        m.box((0, length / 2, 0.051), (width - 0.1, length, 0.002), "paving_brick")
    return m.finish(f"KIT brick alley L{lod}", coll, _meta("brick alley", lod, length, width))


def field_path(coll, width=2.6, length=5.0, lod=0):
    """Earth farm track: two wheel ruts and a grassy crown (photo 10)."""
    m = MeshWriter(lod)
    if lod >= 1:
        m.poly([(-width / 2, 0, 0.03), (width / 2, 0, 0.03), (width / 2, length, 0.03), (-width / 2, length, 0.03)], "dirt")
    else:
        prof = [(-width / 2 - 0.2, 0.0, "dirt"), (-width / 2, 0.03, "dirt"), (-0.75, 0.02, "dirt_dark"), (-0.45, 0.0, "dirt"),
                (-0.25, 0.04, "grass"), (0.25, 0.04, "dirt"), (0.45, 0.0, "dirt_dark"), (0.75, 0.02, "dirt"),
                (width / 2, 0.03, "dirt"), (width / 2 + 0.2, 0.0, "dirt")]
        extrude_profile(m, prof, length)
    return m.finish(f"KIT field path L{lod}", coll, _meta("field path", lod, length, width))


# ---------------------------------------------------------------- water


DITCH = [(-1.9, 0.0, "grass"), (-1.15, 0.0, "grass"), (-0.8, -0.38, "soil"), (-0.42, -0.72, "dirt_dark"),
         (0.42, -0.72, "soil"), (0.8, -0.38, "grass"), (1.15, 0.0, "grass"), (1.9, 0.0, "grass")]


def ditch(coll, length=5.0, water=True, lod=0):
    """Roadside drainage / irrigation ditch. Water strip uses slot 'water' (animated shader on the web)."""
    m = MeshWriter(lod)
    prof = DITCH if lod == 0 else [DITCH[1], (-0.42, -0.72, "soil"), (0.42, -0.72, "soil"), DITCH[-2]]
    # make each strip take the colour of its own point
    prof = [(x, z, s) for (x, z, s) in prof]
    extrude_profile(m, prof, length)
    if water:
        wz = -0.5
        m.poly([(-0.62, 0, wz), (0.62, 0, wz), (0.62, length, wz), (-0.62, length, wz)], "water")
    st = "wet" if water else "dry"
    return m.finish(f"KIT ditch {st} L{lod}", coll, _meta("ditch", lod, length, 3.8, {"sv_state": st}))


def river_bank(coll, length=10.0, water_width=7.4, lod=0):
    """Village stream / canal segment with grassy sloping banks (sketch: central river)."""
    m = MeshWriter(lod)
    hw = water_width / 2
    prof = [(-hw - 3.2, 0.0, "grass"), (-hw - 1.6, 0.0, "grass"), (-hw - 0.4, -0.9, "soil"), (-hw + 0.6, -1.5, "dirt_dark"),
            (hw - 0.6, -1.5, "soil"), (hw + 0.4, -0.9, "grass"), (hw + 1.6, 0.0, "grass"), (hw + 3.2, 0.0, "grass")]
    extrude_profile(m, prof, length, segs=1 if lod else 2)
    m.poly([(-hw, 0, -0.75), (hw, 0, -0.75), (hw, length, -0.75), (-hw, length, -0.75)], "water")
    return m.finish(f"KIT river L{lod}", coll, _meta("river", lod, length, water_width + 6.4))


def _balustrade(m, x0, x1, y, h=0.85, lod=0):
    """White concrete balustrade along X at y: posts with caps, rails, round balusters (photo 13)."""
    length = x1 - x0
    nposts = max(2, int(round(length / 1.8)) + 1)
    if lod >= 2:
        m.box(((x0 + x1) / 2, y, h / 2), (length, 0.16, h), "balustrade")
        return
    for k in range(nposts):
        x = x0 + length * k / (nposts - 1)
        m.box((x, y, h / 2), (0.22, 0.22, h), "balustrade")
        if lod == 0:
            m.box((x, y, h + 0.06), (0.28, 0.28, 0.12), "balustrade")
    m.box(((x0 + x1) / 2, y, h - 0.06), (length, 0.16, 0.12), "balustrade")
    if lod <= 1:
        m.box(((x0 + x1) / 2, y, 0.1), (length, 0.16, 0.12), "balustrade")
    if lod == 0:
        for k in range(nposts - 1):
            xa = x0 + length * k / (nposts - 1)
            xb = x0 + length * (k + 1) / (nposts - 1)
            for j in range(1, 4):
                x = xa + (xb - xa) * j / 4
                m.cyl((x, y, 0.16), (x, y, (h - 0.12) / 2 + 0.08), 0.03, 0.06, "balustrade", segs=6)
                m.cyl((x, y, (h - 0.12) / 2 + 0.08), (x, y, h - 0.12), 0.06, 0.03, "balustrade", segs=6)


def culvert_bridge(coll, lod=0):
    """Small concrete deck over a ditch (crosses along X, ditch runs along Y)."""
    m = MeshWriter(lod)
    span, width = 4.6, 3.2
    m.box((0, 0, 0.12), (span, width, 0.24), "concrete")
    for s in (-1, 1):
        m.push((0, s * (width / 2 - 0.1), 0.24))
        _balustrade(m, -span / 2 + 0.1, span / 2 - 0.1, 0, lod=lod)
        m.pop()
        if lod <= 1:
            # headwall with the dark culvert mouth
            m.box((0, s * (width / 2 + 0.05), -0.36), (1.6, 0.1, 0.72), "concrete")
            if lod == 0:
                m.cyl((0, s * (width / 2 + 0.09), -0.4), (0, s * (width / 2 + 0.11), -0.4), 0.32, 0.32, "steel_dark", segs=12)
    return m.finish(f"KIT culvert bridge L{lod}", coll, _meta("culvert bridge", lod, width, span))


def river_bridge(coll, lod=0):
    """Concrete slab bridge over the village stream with balustrades and two piers."""
    m = MeshWriter(lod)
    span, width = 14.0, 4.6
    m.box((0, 0, 0.2), (span, width, 0.4), "concrete")
    for x in (-2.4, 2.4):
        m.box((x, 0, -0.8), (0.6, width - 0.6, 1.6), "concrete")
    for s in (-1, 1):
        m.push((0, s * (width / 2 - 0.12), 0.4))
        _balustrade(m, -span / 2 + 0.1, span / 2 - 0.1, 0, lod=lod)
        m.pop()
    return m.finish(f"KIT river bridge L{lod}", coll, _meta("river bridge", lod, width, span))


# ---------------------------------------------------------------- utilities


POLE_H = 9.0
WIRE_ATTACH = [(-0.7, POLE_H - 0.3), (-0.25, POLE_H - 0.3), (0.25, POLE_H - 0.3), (0.7, POLE_H - 0.3)]  # (x, z) local


def utility_pole(coll, lod=0, lamp=False):
    """Concrete distribution pole with crossarm and insulators; optional street lamp arm."""
    m = MeshWriter(lod)
    segs = {0: 8, 1: 5, 2: 4}[lod]
    m.cyl((0, 0, 0), (0, 0, POLE_H), 0.15, 0.09, "pole", segs=segs)
    if lod <= 1:
        m.box((0, 0, POLE_H - 0.5), (1.7, 0.1, 0.1), "pole")
    if lod == 0:
        for x, z in WIRE_ATTACH:
            m.cyl((x, 0, z - 0.2), (x, 0, z), 0.04, 0.03, "insulator", segs=6)
        m.cyl((0, 0, 0), (0, 0, 1.2), 0.165, 0.16, "whitewash", segs=segs)  # painted base band
        m.box((0, 0.2, 2.2), (0.35, 0.18, 0.45), "pipe_white")  # meter box
    if lamp:
        m.cyl((0, 0, 6.2), (1.4, 0, 6.6), 0.035, 0.03, "steel_dark", segs=5)
        m.box((1.55, 0, 6.55), (0.45, 0.18, 0.1), "steel_dark")
        m.box((1.55, 0, 6.49), (0.36, 0.14, 0.02), "lamp")
    return m.finish(f"KIT utility pole{' lamp' if lamp else ''} L{lod}", coll,
                    _meta("utility pole lamp" if lamp else "utility pole", lod,
                          extra={"sv_wire_attach": ";".join(f"{x},{z}" for x, z in WIRE_ATTACH)}))


def solar_lamp(coll, lod=0):
    """Solar street lamp now common along village roads."""
    m = MeshWriter(lod)
    m.cyl((0, 0, 0), (0, 0, 6.0), 0.07, 0.045, "rail_steel", segs={0: 8, 1: 5, 2: 4}[lod])
    m.box((0, 0, 0.15), (0.4, 0.4, 0.3), "concrete")
    m.push((0, 0, 6.05))
    m.box((0, -0.1, 0.25), (0.9, 0.55, 0.03), "solar")
    if lod == 0:
        m.box((0, -0.1, 0.23), (0.94, 0.59, 0.02), "rail_steel")
    m.pop()
    if lod <= 1:
        m.cyl((0, 0, 5.5), (0.9, 0, 5.75), 0.03, 0.025, "rail_steel", segs=5)
        m.box((1.05, 0, 5.72), (0.55, 0.22, 0.08), "rail_steel")
        m.box((1.05, 0, 5.67), (0.45, 0.17, 0.02), "lamp")
    return m.finish(f"KIT solar lamp L{lod}", coll, _meta("solar lamp", lod))


def transformer(coll, lod=0):
    """Village transformer on a two-pole platform."""
    m = MeshWriter(lod)
    for x in (-1.3, 1.3):
        m.cyl((x, 0, 0), (x, 0, POLE_H), 0.15, 0.09, "pole", segs={0: 8, 1: 5, 2: 4}[lod])
    m.box((0, 0, 3.0), (3.2, 0.9, 0.12), "steel_dark")
    m.box((0, 0, 3.65), (1.1, 0.75, 1.2), "transformer")
    if lod == 0:
        for k in range(6):
            m.box((-0.45 + k * 0.18, 0.42, 3.6), (0.05, 0.12, 0.9), "transformer")
        for x in (-0.3, 0.0, 0.3):
            m.cyl((x, 0, 4.25), (x, 0, 4.6), 0.05, 0.04, "insulator", segs=6)
        m.box((0, 0, POLE_H - 0.5), (3.4, 0.1, 0.1), "pole")
        m.box((0, 0.3, 1.2), (0.6, 0.25, 0.8), "transformer")  # switch box
    return m.finish(f"KIT transformer L{lod}", coll, _meta("transformer", lod))


def well_hut(coll, lod=0, variant=0):
    """Small white irrigation well hut with a peaked roof and steel door (photos 09-12)."""
    rng = random.Random(70 + variant)
    m = MeshWriter(lod)
    w = rng.uniform(0.95, 1.2)
    h = rng.uniform(1.25, 1.5)
    m.box((0, 0, h / 2), (w, w, h), "whitewash")
    r = w / 2 + 0.12
    apex = (0, 0, h + 0.5)
    corners = [(-r, -r, h), (r, -r, h), (r, r, h), (-r, r, h)]
    for k in range(4):
        m.poly([corners[k], corners[(k + 1) % 4], apex], "roof_grey" if variant % 2 else "whitewash")
    if lod <= 1:
        m.box((0, -w / 2 - 0.01, 0.55), (0.48, 0.03, 0.85), "steel_dark")
    if lod == 0:
        m.box((0, -w / 2 - 0.03, 0.6), (0.04, 0.02, 0.06), "rail_steel")
        m.cyl((w / 2, 0, 0.25), (w / 2 + 0.45, 0, 0.2), 0.06, 0.06, "steel_dark", segs=6)  # outlet pipe
    return m.finish(f"KIT well hut {variant} L{lod}", coll, _meta("well hut", lod, extra={"sv_variant": variant}))


def wellhead(coll, lod=0):
    """Low capped wellhead with outlet pipe and a meter box on a short post."""
    m = MeshWriter(lod)
    m.cyl((0, 0, 0), (0, 0, 0.55), 0.3, 0.28, "concrete", segs=10 if lod == 0 else 6)
    m.cyl((0, 0, 0.55), (0, 0, 0.62), 0.32, 0.32, "steel_dark", segs=10 if lod == 0 else 6)
    if lod == 0:
        m.cyl((0.25, 0, 0.4), (0.9, 0, 0.3), 0.07, 0.07, "steel_dark", segs=6)
        m.box((-0.8, 0, 0.6), (0.08, 0.08, 1.2), "pole")
        m.box((-0.8, -0.1, 1.05), (0.35, 0.16, 0.42), "pipe_white")
    return m.finish(f"KIT wellhead L{lod}", coll, _meta("wellhead", lod))


def field_stake(coll, variant=0):
    """White concrete field marker stake; variant 1 has a red-painted top."""
    m = MeshWriter(0)
    m.box((0, 0, 0.22), (0.12, 0.12, 0.44), "whitewash")
    m.poly([(-0.06, -0.06, 0.44), (0.06, -0.06, 0.44), (0.0, 0.0, 0.5)], "whitewash")
    m.poly([(0.06, -0.06, 0.44), (0.06, 0.06, 0.44), (0.0, 0.0, 0.5)], "whitewash")
    m.poly([(0.06, 0.06, 0.44), (-0.06, 0.06, 0.44), (0.0, 0.0, 0.5)], "whitewash")
    m.poly([(-0.06, 0.06, 0.44), (-0.06, -0.06, 0.44), (0.0, 0.0, 0.5)], "whitewash")
    if variant == 1:
        m.box((0, 0, 0.38), (0.125, 0.125, 0.1), "couplet")
    return m.finish(f"KIT field stake {variant}", coll, _meta("field stake", 0, extra={"sv_variant": variant}))


# ---------------------------------------------------------------- wires (for the layout phase and the web)


def catenary(p0, p1, sag=0.7, n=12):
    """Points of a sagging wire between two attachment points (parabolic approximation)."""
    p0, p1 = Vector(p0), Vector(p1)
    span = (p1 - p0).length
    s = sag * min(1.0, span / 40.0) * 1.4
    return [p0.lerp(p1, t) - Vector((0, 0, 4 * s * t * (1 - t))) for t in (i / (n - 1) for i in range(n))]
