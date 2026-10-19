"""SmallVillage kit batch 6: painted cloud set and horizon strips.

Clouds are sculpted lumps of soft blobs with flattened bases and a cooler underside band, sized in real
metres (place them 1-3 km away, 250-600 m up). Horizon strips are very light meshes for the flat skyline
in the photographs: thin grey-white distant villages, poplar shelterbelts and isolated poplar clumps.
Strips run along local +X from 0 to `sv_length`, with their front facing -Y (turn them toward the village).
"""
import math
import random

from mathutils import Vector

from kit_buildings import MeshWriter


def _meta(family, extra=None):
    d = {"sv_kind": "sky", "sv_family": family, "sv_state": "standing", "sv_lod": 0}
    d.update(extra or {})
    return d


def _cloud_base(m, base_z, height):
    """Flatten everything below the base and paint the lower band in the cooler underside colour."""
    under = m.i("cloud_base")
    for v in m.bm.verts:
        if v.co.z < base_z:
            v.co.z = base_z + (v.co.z - base_z) * 0.15
    for f in m.bm.faces:
        if f.calc_center_median().z < base_z + height * 0.16:
            f.material_index = under


def cumulus(coll, variant=0, width=420.0, height=200.0, tower=False):
    rng = random.Random(1000 + variant + (500 if tower else 0))
    m = MeshWriter(0)
    n = 30 if tower else 24
    for i in range(n):
        x = rng.uniform(-width / 2, width / 2)
        prof = 1 - (2 * x / width) ** 2
        top = height * (prof ** (0.6 if tower else 1.0))
        z = rng.uniform(0.15, 1.0) * top
        r = rng.uniform(0.2, 0.32) * height * (0.55 + prof)
        if tower and abs(x) < width * 0.2:
            r *= 1.2
        m.blob((x, rng.uniform(-width * 0.12, width * 0.12), z), r, "cloud", rng, sub=2, squash=(1, 0.8, 0.85), jitter=0.05)
    _cloud_base(m, 0.0, height)
    nm = f"KIT cloud {'tower' if tower else 'cumulus'} {variant}"
    return m.finish(nm, coll, _meta("cumulus tower" if tower else "cumulus", {"sv_variant": variant, "sv_size": f"{width},{height}"}), smooth=True)


def cumulus_small(coll, variant=0):
    """Fair-weather puff for clear spring days."""
    return _small(coll, variant)


def _small(coll, variant):
    rng = random.Random(1100 + variant)
    m = MeshWriter(0)
    w, h = rng.uniform(120, 180), rng.uniform(45, 65)
    for i in range(9):
        x = rng.uniform(-w / 2, w / 2)
        prof = 1 - (2 * x / w) ** 2
        m.blob((x, rng.uniform(-10, 10), rng.uniform(0.1, 0.8) * h * prof), rng.uniform(0.3, 0.45) * h * (0.6 + prof), "cloud", rng, sub=2,
               squash=(1.2, 0.9, 0.8), jitter=0.05)
    _cloud_base(m, 0.0, h)
    return m.finish(f"KIT cloud small {variant}", coll, _meta("cumulus small", {"sv_variant": variant, "sv_size": f"{w:.0f},{h:.0f}"}), smooth=True)


def thunderhead(coll):
    """Summer cumulonimbus: dark tall tower with a flattened anvil top."""
    rng = random.Random(1200)
    m = MeshWriter(0)
    W, H = 900.0, 1400.0
    for i in range(26):
        t = rng.uniform(0, 0.85)
        r = W * (0.18 + 0.12 * (1 - t)) * rng.uniform(0.8, 1.15)
        m.blob((rng.uniform(-W * 0.22, W * 0.22) * (1 - t * 0.4), rng.uniform(-W * 0.1, W * 0.1), H * t), r, "cloud_storm" if t < 0.35 else "cloud",
               rng, sub=2, squash=(1, 0.85, 0.9), jitter=0.05)
    for i in range(9):
        m.blob((rng.uniform(-W * 0.6, W * 0.75), rng.uniform(-W * 0.2, W * 0.2), H * rng.uniform(0.86, 0.95)), W * rng.uniform(0.18, 0.28), "cloud",
               rng, sub=2, squash=(1.6, 1.2, 0.35), jitter=0.04)
    _cloud_base(m, 0.0, H * 0.4)
    for f in m.bm.faces:
        if f.calc_center_median().z < H * 0.1:
            f.material_index = m.i("cloud_storm")
    return m.finish("KIT cloud thunderhead", coll, _meta("thunderhead", {"sv_size": f"{W:.0f},{H:.0f}"}), smooth=True)


def stratus(coll, variant=0):
    """Low lumpy grey layer for overcast, snow and storm skies (seen from below)."""
    rng = random.Random(1300 + variant)
    m = MeshWriter(0)
    W, D = 2400.0, 1600.0
    for i in range(40):
        m.blob((rng.uniform(-W / 2, W / 2), rng.uniform(-D / 2, D / 2), rng.uniform(-20, 20)), rng.uniform(160, 300), "cloud_base", rng, sub=2,
               squash=(1.6, 1.3, 0.22), jitter=0.06)
    return m.finish(f"KIT cloud stratus {variant}", coll, _meta("stratus", {"sv_variant": variant, "sv_size": f"{W:.0f},{D:.0f}"}), smooth=True)


def cirrus(coll, variant=0):
    """High wispy streaks (thin curved ribbons, seen from below) for hazy winter and dusk skies."""
    rng = random.Random(1400 + variant)
    m = MeshWriter(0)
    for s in range(7):
        y0 = rng.uniform(-300, 300)
        x0 = rng.uniform(-500, 0)
        ln = rng.uniform(500, 1100)
        bend = rng.uniform(-120, 120)
        w = rng.uniform(10, 26)
        prev = None
        for k in range(9):
            t = k / 8
            x = x0 + ln * t
            y = y0 + bend * math.sin(math.pi * t)
            ww = w * math.sin(math.pi * min(0.98, 0.08 + 0.9 * t))
            a = (Vector((x, y - ww, 0)), Vector((x, y + ww, 0)))
            if prev:
                # wound so the face points down toward the viewer below
                m.poly([tuple(prev[1]), tuple(a[1]), tuple(a[0]), tuple(prev[0])], "cloud")
            prev = a
    return m.finish(f"KIT cloud cirrus {variant}", coll, _meta("cirrus", {"sv_variant": variant}), smooth=False)


# ---------------------------------------------------------------- horizon strips


def _far_poplar(m, x, y, h, rng, leafy):
    m.box((x, y, h * 0.3), (0.35, 0.35, h * 0.6), "bark")
    if leafy:
        m.blob((x, y, h * 0.66), h * 0.17, "leaf_l" if rng.random() < 0.5 else "leaf_d", rng, sub=1, squash=(1, 1, 2.1), jitter=0.12)
    else:
        for k in range(3):
            a = rng.uniform(-0.35, 0.35)
            top = Vector((x + math.sin(a) * h * 0.18, y + rng.uniform(-0.4, 0.4), h))
            m.cyl((x, y, h * 0.35), top, 0.18, 0.05, "bark", segs=3)


def shelterbelt(coll, length=300.0, rows=2, leafy=True, variant=0):
    """Poplar windbreak along field edges, the long tree lines on every horizon in the photos."""
    rng = random.Random(1500 + variant + (50 if leafy else 0))
    m = MeshWriter(0)
    for r in range(rows):
        x = rng.uniform(0, 3)
        while x < length:
            _far_poplar(m, x, r * 4.5 + rng.uniform(-0.6, 0.6), rng.uniform(15, 20), rng, leafy)
            x += rng.uniform(3.5, 5.5)
    st = "leafy" if leafy else "bare"
    return m.finish(f"KIT shelterbelt {st} {variant}", coll,
                    _meta("shelterbelt", {"sv_state": st, "sv_variant": variant, "sv_length": length,
                                          "sv_months": "4,5,6,7,8,9,10" if leafy else "11,12,1,2,3"}))


def poplar_clump(coll, leafy=True, variant=0):
    """Isolated clump of poplars standing in the open wheat (photos 09, 14, 15, 16)."""
    rng = random.Random(1600 + variant + (50 if leafy else 0))
    m = MeshWriter(0)
    n = rng.randint(6, 11)
    for k in range(n):
        _far_poplar(m, rng.gauss(0, 4.0), rng.gauss(0, 2.0), rng.uniform(14, 20), rng, leafy)
    st = "leafy" if leafy else "bare"
    return m.finish(f"KIT poplar clump {st} {variant}", coll,
                    _meta("poplar clump", {"sv_state": st, "sv_variant": variant, "sv_months": "4,5,6,7,8,9,10" if leafy else "11,12,1,2,3"}))


def distant_village(coll, length=400.0, variant=0, leafy=True):
    """Low grey-white strip of a neighbouring village: mostly flat-roofed 2-3 storey blocks with trees."""
    rng = random.Random(1700 + variant)
    m = MeshWriter(0)
    for row in range(3):
        x = rng.uniform(0, 8)
        y = row * 14
        while x < length:
            w = rng.uniform(8, 14)
            d = rng.uniform(7, 10)
            h = rng.choice([3.4, 6.6, 6.6, 9.8]) if row < 2 else rng.choice([3.4, 6.6])
            slot = rng.choice(["far_house", "far_house", "far_house_d"])
            m.box((x + w / 2, y + d / 2, h / 2), (w, d, h), slot)
            if rng.random() < 0.3:
                # pitched roof
                rh = d * 0.3
                m.poly([(x - 0.3, y - 0.3, h), (x + w + 0.3, y - 0.3, h), (x + w + 0.3, y + d / 2, h + rh), (x - 0.3, y + d / 2, h + rh)], "far_roof")
                m.poly([(x + w + 0.3, y + d + 0.3, h), (x - 0.3, y + d + 0.3, h), (x - 0.3, y + d / 2, h + rh), (x + w + 0.3, y + d / 2, h + rh)], "far_roof")
            elif rng.random() < 0.5:
                m.box((x + w / 2, y + 0.1, h + 0.4), (w, 0.2, 0.8), "far_house_d")
            if rng.random() < 0.55:
                tx = x + w + rng.uniform(0.5, 2.5)
                m.blob((tx, y + rng.uniform(2, 8), rng.uniform(4, 7)), rng.uniform(3, 4.5), "leaf_d" if leafy else "bark", rng, sub=1,
                       squash=(1, 1, 0.85), jitter=0.2)
            x += w + rng.uniform(1.0, 6.0)
    # poplars rising behind the roofs
    x = 0.0
    while x < length:
        _far_poplar(m, x, 44 + rng.uniform(-3, 3), rng.uniform(16, 21), rng, leafy)
        x += rng.uniform(6, 16)
    st = "leafy" if leafy else "bare"
    return m.finish(f"KIT distant village {variant} {st}", coll,
                    _meta("distant village", {"sv_state": st, "sv_variant": variant, "sv_length": length}))
