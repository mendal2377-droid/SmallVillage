"""SmallVillage kit: palette material, asset marking and batch-1 builders (trees, crops, ground cover).

Builders write faces with *slot* material indices; `finish()` turns those into palette UVs and gives the
mesh the single shared palette material.
"""
import math
import random
import uuid

import bmesh
import bpy
from mathutils import Vector

import palette as PAL
import style_lib as SL

add_cyl, add_blob, add_box = SL.add_cyl, SL.add_blob, SL.add_box

# ---------------------------------------------------------------- palette material


def palette_images():
    imgs = {}
    for season in PAL.SEASONS:
        name = f"SV palette {season}"
        img = bpy.data.images.get(name) or bpy.data.images.new(name, PAL.GRID, PAL.GRID, alpha=False, float_buffer=True)
        img.colorspace_settings.name = "Linear Rec.709"
        px = [0.0] * (PAL.GRID * PAL.GRID * 4)
        for i, slot in enumerate(PAL.SLOTS):
            r, g, b = PAL.color(slot, season)
            px[i * 4:i * 4 + 4] = [r, g, b, 1.0]
        img.pixels.foreach_set(px)
        img.pack()
        imgs[season] = img
    return imgs


def palette_material(season="summer"):
    m = bpy.data.materials.get("SV kit palette")
    if m:
        return m
    imgs = palette_images()
    m = bpy.data.materials.new("SV kit palette")
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.name = "palette"
    tex.image = imgs[season]
    tex.interpolation = "Closest"
    tex.extension = "EXTEND"
    g = nt.nodes.new("ShaderNodeGroup")
    g.node_tree = SL.toon_group()
    g.inputs["Shadow Tint"].default_value = SL.SHADOW_TINT
    g.inputs["Variation"].default_value = 0.6
    nt.links.new(tex.outputs["Color"], g.inputs["Base"])
    nt.links.new(g.outputs[0], out.inputs["Surface"])
    return m


def set_season(season):
    m = palette_material()
    m.node_tree.nodes["palette"].image = bpy.data.images[f"SV palette {season}"]


# ---------------------------------------------------------------- finishing


_SLOTMATS = {}


def slots(*names):
    """Placeholder materials whose names carry the palette slot; converted by finish()."""
    out = []
    for n in names:
        assert n in PAL.SLOTS, n
        m = _SLOTMATS.get(n) or bpy.data.materials.new("slot:" + n)
        _SLOTMATS[n] = m
        out.append(m)
    return out


def finish(name, bm, slot_names, coll, meta):
    """bmesh with face.material_index into slot_names -> palette-UV'd mesh object with metadata."""
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        u, v = PAL.uv(slot_names[min(f.material_index, len(slot_names) - 1)])
        for lp in f.loops:
            lp[uvl].uv = (u, v)
        f.material_index = 0
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(palette_material())
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    for k, v in meta.items():
        o[k] = v
    o["sv_tris"] = sum(len(p.vertices) - 2 for p in me.polygons)
    return o


# ---------------------------------------------------------------- asset library


CATALOGS = {}


def catalog(path):
    if path not in CATALOGS:
        CATALOGS[path] = str(uuid.uuid5(uuid.NAMESPACE_URL, "smallvillage/" + path))
    return CATALOGS[path]


def write_catalogs(blend_dir):
    import os
    lines = ["# Blender asset catalog definition file", "VERSION 1", ""]
    for path, cid in sorted(CATALOGS.items()):
        lines.append(f"{cid}:{path}:{path.replace('/', '-')}")
    with open(os.path.join(blend_dir, "blender_assets.cats.txt"), "w", encoding="utf8") as fh:
        fh.write("\n".join(lines) + "\n")


def mark(o, cat, tags=(), desc=""):
    o.asset_mark()
    o.asset_data.catalog_id = catalog(cat)
    o.asset_data.description = desc
    for t in tags:
        o.asset_data.tags.new(t, skip_if_exists=True)
    return o


# ---------------------------------------------------------------- branching skeleton


def _rot_toward(d, target, ang):
    """Rotate unit vector d toward target by angle (radians)."""
    axis = d.cross(target)
    if axis.length < 1e-5:
        return d.copy()
    from mathutils import Matrix
    return (Matrix.Rotation(ang, 3, axis.normalized()) @ d).normalized()


def branch(bm, p0, d, length, radius, depth, rng, mat, tips, segs=5, spread=0.5, up_pull=0.35, children=(2, 3)):
    p1 = p0 + d * length
    add_cyl(bm, p0, p1, radius, radius * 0.62, segs=max(3, segs), mat_index=mat)
    if depth <= 0:
        tips.append((p1, d, length))
        return
    for i in range(rng.randint(*children)):
        t = rng.uniform(0.45, 1.0)
        q = p0 + d * length * t
        a = rng.uniform(0, 6.28)
        side = Vector((math.cos(a), math.sin(a), rng.uniform(-0.2, 0.3))).normalized()
        nd = (d + side * spread).normalized()
        nd = _rot_toward(nd, Vector((0, 0, 1)), up_pull * rng.uniform(0.2, 1.0))
        branch(bm, q, nd, length * rng.uniform(0.5, 0.7), radius * 0.55, depth - 1, rng, mat, tips, segs - 1, spread, up_pull, children)
    tips.append((p1, d, length))


# ---------------------------------------------------------------- trees


def poplar(coll, variant, state="leafy", lod=0, nest=False):
    rng = random.Random(100 + variant)
    H = rng.uniform(15.5, 19.5)
    bm = bmesh.new()
    S = ["bark", "whitewash", "leaf_l", "leaf_d", "nest"]
    lean = Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 0))
    segs = {0: 8, 1: 6, 2: 4}[lod]
    add_cyl(bm, (0, 0, 0), Vector((0, 0, H)) + lean, 0.15, 0.03, segs=segs, mat_index=0)
    add_cyl(bm, (0, 0, -0.05), (lean.x * 0.07, lean.y * 0.07, 1.1), 0.162, 0.155, segs=segs, mat_index=1)
    tips = []
    nprim = {0: (34 if state == "bare" else 22), 1: (16 if state == "bare" else 12), 2: 5}[lod]
    depth = {0: (2 if state == "bare" else 1), 1: (1 if state == "bare" else 0), 2: 0}[lod]
    for i in range(nprim):
        z = rng.uniform(H * 0.3, H * 0.9)
        base = Vector((0, 0, z)) + lean * (z / H)
        a = rng.uniform(0, 6.28)
        d = Vector((math.cos(a) * 0.38, math.sin(a) * 0.38, 1)).normalized()
        branch(bm, base, d, rng.uniform(1.8, 3.6) * (1.15 - z / H) + 0.6, 0.05, depth, rng, 0, tips,
               segs={0: 5, 1: 4, 2: 3}[lod], spread=0.35, up_pull=0.25, children=(2, 3))
    if nest:
        hi = max(tips, key=lambda t: t[0].z * 0.6 + rng.random())
        add_blob(bm, Vector((0, 0, H * 0.72)) + lean * 0.72 + Vector((0.25, 0, 0)), 0.42, rng, sub=1, squash=(1, 1, 0.75), jitter=0.3, mat_index=4)
    if state == "leafy":
        n = {0: 76, 1: 26, 2: 5}[lod]
        sub = {0: 2, 1: 1, 2: 1}[lod]
        for i in range(n):
            if lod == 2:
                t = 0.45 + 0.5 * i / max(1, n - 1)
                cen = Vector((0, 0, H * t)) + lean * t
                r = 1.4 * math.sin(math.pi * min(1, (t - 0.3) / 0.75)) + 0.4
                add_blob(bm, cen, r, rng, sub=1, squash=(1, 1, 1.6), jitter=0.1, mat_index=2 + (i % 2))
                continue
            if rng.random() < 0.6 and tips:
                p, d, ln = rng.choice(tips)
                cen = p - d * ln * rng.uniform(0, 0.5) + Vector((rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), rng.uniform(-0.2, 0.5)))
            else:
                t = rng.uniform(0.42, 1.0)
                prof = math.sin(math.pi * min(1, max(0.0, (t - 0.36) / 0.68))) ** 0.8
                rad = 0.3 + 1.2 * prof
                a = rng.uniform(0, 6.28)
                cen = Vector((math.cos(a) * rad * rng.random(), math.sin(a) * rad * rng.random(), H * t)) + lean * t
            t = cen.z / H
            prof = math.sin(math.pi * min(1, max(0.05, (t - 0.36) / 0.68)))
            r = rng.uniform(0.38, 0.7) * (0.6 + 0.5 * prof) * (1.6 if lod == 1 else 1.0)
            mi = 2 if rng.random() < 0.5 else 3
            add_blob(bm, cen, r, rng, sub=sub, squash=(1, 1, 1.3), jitter=0.12, mat_index=mi)
            if lod == 0:
                for k in range(3):
                    d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.6, 1))).normalized()
                    add_blob(bm, cen + d * r * rng.uniform(0.85, 1.15), r * rng.uniform(0.25, 0.4), rng, sub=1,
                             squash=(1, 1, 1.2), jitter=0.15, mat_index=2 if rng.random() < 0.6 else 3)
    months = "4,5,6,7,8,9,10" if state == "leafy" else "11,12,1,2,3"
    nm = f"KIT poplar {variant} {state}{' nest' if nest else ''} L{lod}"
    return finish(nm, bm, S, coll, {"sv_kind": "tree", "sv_family": "poplar", "sv_variant": variant, "sv_state": state,
                                    "sv_lod": lod, "sv_months": months})


def broadleaf(coll, variant, state="leafy", lod=0):
    """Village yard tree (elm / paulownia / scholar tree silhouette): short trunk, spreading limbs, round crown."""
    rng = random.Random(300 + variant)
    H = rng.uniform(6.5, 9.0)
    spread = rng.uniform(2.6, 3.8)
    bm = bmesh.new()
    S = ["bark", "broad_l", "broad_d"]
    fork = Vector((rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), H * 0.4))
    segs = {0: 9, 1: 6, 2: 4}[lod]
    add_cyl(bm, (0, 0, 0), fork, 0.26, 0.18, segs=segs, mat_index=0)
    tips = []
    depth = {0: (3 if state == "bare" else 2), 1: 1, 2: 0}[lod]
    for i in range({0: 5, 1: 4, 2: 3}[lod]):
        a = i * 6.283 / 5 + rng.uniform(-0.3, 0.3)
        d = Vector((math.cos(a) * 0.8, math.sin(a) * 0.8, 1)).normalized()
        branch(bm, fork, d, rng.uniform(2.0, 2.8), 0.13, depth, rng, 0, tips, segs={0: 6, 1: 4, 2: 3}[lod],
               spread=0.6, up_pull=0.15, children=(2, 3))
    if state == "leafy":
        cc = fork + Vector((0, 0, H * 0.35))
        n = {0: 34, 1: 12, 2: 4}[lod]
        for i in range(n):
            if lod < 2 and tips and rng.random() < 0.7:
                p = rng.choice(tips)[0]
                cen = p + Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), rng.uniform(-0.2, 0.6)))
            else:
                a = rng.uniform(0, 6.28)
                cen = cc + Vector((math.cos(a) * spread * 0.6, math.sin(a) * spread * 0.6, rng.uniform(-0.5, 1.0)))
            r = rng.uniform(0.9, 1.5) * (1.5 if lod else 1.0)
            add_blob(bm, cen, r, rng, sub=2 if lod == 0 else 1, squash=(1, 1, 0.85), jitter=0.15, mat_index=1 if rng.random() < 0.5 else 2)
    months = "4,5,6,7,8,9,10" if state == "leafy" else "11,12,1,2,3"
    return finish(f"KIT broadleaf {variant} {state} L{lod}", bm, S, coll,
                  {"sv_kind": "tree", "sv_family": "broadleaf", "sv_variant": variant, "sv_state": state, "sv_lod": lod, "sv_months": months})


def willow(coll, variant, state="leafy", lod=0):
    rng = random.Random(400 + variant)
    H = rng.uniform(7.0, 8.5)
    bm = bmesh.new()
    S = ["bark", "willow_l", "willow_d", "bark_dark"]
    lean = Vector((rng.uniform(-1.2, 1.2), rng.uniform(0.4, 1.4), 0))
    fork = Vector((0, 0, H * 0.45)) + lean * 0.5
    add_cyl(bm, (0, 0, 0), fork, 0.42, 0.28, segs={0: 10, 1: 6, 2: 4}[lod], mat_index=0)
    crown = Vector((0, 0, H * 0.8)) + lean
    tips = []
    for i in range({0: 6, 1: 4, 2: 3}[lod]):
        a = rng.uniform(0, 6.28)
        d = (crown + Vector((math.cos(a) * 2.2, math.sin(a) * 2.2, rng.uniform(-0.4, 1.0))) - fork).normalized()
        branch(bm, fork, d, rng.uniform(2.6, 3.4), 0.2, {0: 1, 1: 0, 2: 0}[lod], rng, 0, tips, segs={0: 6, 1: 4, 2: 3}[lod],
               spread=0.5, up_pull=0.1, children=(2, 3))
    if state == "leafy":
        for i in range({0: 20, 1: 9, 2: 4}[lod]):
            a = rng.uniform(0, 6.28)
            rr = rng.uniform(0, 3.0)
            cen = crown + Vector((math.cos(a) * rr, math.sin(a) * rr, rng.uniform(-0.5, 1.2)))
            add_blob(bm, cen, rng.uniform(0.9, 1.5) * (1.3 if lod else 1), rng, sub=2 if lod == 0 else 1, squash=(1, 1, 0.8), jitter=0.2,
                     mat_index=1 if rng.random() < 0.5 else 2)
    # hanging strands: leafy green, or bare yellow-brown twigs in winter
    nstr = {0: 160, 1: 50, 2: 0}[lod]
    for i in range(nstr):
        a = rng.uniform(0, 6.28)
        rr = rng.uniform(1.6, 3.9)
        top = crown + Vector((math.cos(a) * rr, math.sin(a) * rr, rng.uniform(-0.6, 0.6)))
        ln = rng.uniform(1.8, 4.2) * (0.8 if state == "bare" else 1.0)
        w = (0.09 if state == "leafy" else 0.025) * (2 if lod else 1)
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-d.y, d.x, 0)) * w
        prev = None
        mi = (1 if rng.random() < 0.6 else 2) if state == "leafy" else 2
        for k in range(4):
            t = k / 3
            p = top + Vector((0, 0, -ln * t)) + d * 0.25 * t
            s = side * (1 - 0.7 * t)
            v1, v2 = bm.verts.new(p - s), bm.verts.new(p + s)
            if prev:
                bm.faces.new((prev[0], prev[1], v2, v1)).material_index = mi
            prev = (v1, v2)
    months = "3,4,5,6,7,8,9,10,11" if state == "leafy" else "12,1,2"
    return finish(f"KIT willow {variant} {state} L{lod}", bm, S, coll,
                  {"sv_kind": "tree", "sv_family": "willow", "sv_variant": variant, "sv_state": state, "sv_lod": lod, "sv_months": months})


def conifer(coll, variant, lod=0):
    """Young roadside conifer (photo 12)."""
    rng = random.Random(500 + variant)
    H = rng.uniform(2.0, 3.2)
    bm = bmesh.new()
    S = ["bark", "conifer_l", "conifer_d"]
    add_cyl(bm, (0, 0, 0), (0, 0, H * 0.3), 0.06, 0.05, segs=6, mat_index=0)
    tiers = {0: 5, 1: 3, 2: 2}[lod]
    for i in range(tiers):
        t = i / tiers
        z0 = H * (0.18 + 0.72 * t)
        r = H * 0.32 * (1 - t * 0.75)
        vs = add_cyl(bm, (0, 0, z0), (0, 0, z0 + H * 0.36), r, 0.02, segs={0: 10, 1: 7, 2: 5}[lod], mat_index=1 + (i % 2))
        for v in vs:
            v.co += Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), rng.uniform(-0.04, 0.04))) * H
    return finish(f"KIT conifer {variant} L{lod}", bm, S, coll,
                  {"sv_kind": "tree", "sv_family": "conifer", "sv_variant": variant, "sv_state": "evergreen", "sv_lod": lod, "sv_months": "1,2,3,4,5,6,7,8,9,10,11,12"})


def hedge_ball(coll, variant, lod=0):
    """Clipped photinia ball (roadside shrubs in photo 16; red new tips in spring)."""
    rng = random.Random(600 + variant)
    bm = bmesh.new()
    S = ["bark", "hedge_l", "hedge_d", "hedge_tip"]
    add_cyl(bm, (0, 0, 0), (0, 0, 0.5), 0.05, 0.04, segs=5, mat_index=0)
    for i in range({0: 22, 1: 7, 2: 2}[lod]):
        d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.3, 1))).normalized()
        cen = Vector((0, 0, 1.1)) + d * 0.55
        mi = 3 if (d.z > 0.55 and rng.random() < 0.6) else (1 if rng.random() < 0.55 else 2)
        add_blob(bm, cen, rng.uniform(0.32, 0.45) * (1.5 if lod else 1), rng, sub=2 if lod == 0 else 1, jitter=0.12, mat_index=mi)
    return finish(f"KIT hedge ball {variant} L{lod}", bm, S, coll,
                  {"sv_kind": "tree", "sv_family": "hedge", "sv_variant": variant, "sv_state": "evergreen", "sv_lod": lod, "sv_months": "1,2,3,4,5,6,7,8,9,10,11,12"})


# ---------------------------------------------------------------- crops


def _strap(bm, base, d, length, width, rise, droop, mat, segs=5, twist=0.0):
    """Arching strap leaf from base along horizontal dir d."""
    d = Vector((d.x, d.y, 0)).normalized()
    side = Vector((-d.y, d.x, 0))
    prev = None
    for i in range(segs + 1):
        t = i / segs
        p = base + d * length * t + Vector((0, 0, rise * t - droop * t * t))
        w = width * math.sin(math.pi * min(0.98, 0.15 + 0.85 * t)) if t < 1 else 0.002
        s = (side * math.cos(twist * t) + Vector((0, 0, 1)) * math.sin(twist * t)) * w
        v1, v2 = bm.verts.new(p - s), bm.verts.new(p + s)
        if prev:
            bm.faces.new((prev[0], prev[1], v2, v1)).material_index = mat
        prev = (v1, v2)


def _blade(bm, base, d, h, w, bend, mat, segs=3):
    side = Vector((-d.y, d.x, 0)) * w
    prev = None
    for i in range(segs + 1):
        t = i / segs
        p = base + d * bend * t * t + Vector((0, 0, h * t))
        s = side * (1 - t * 0.9)
        v1, v2 = bm.verts.new(p - s), bm.verts.new(p + s)
        if prev:
            bm.faces.new((prev[0], prev[1], v2, v1)).material_index = mat
        prev = (v1, v2)


WHEAT_STAGES = {
    # stage: (months, blade count, height, bend, slot, ears)
    "seedling": ("10,11", 8, 0.09, 0.03, "wheat_seedling", False),
    "winter": ("12,1,2", 11, 0.13, 0.08, "wheat_winter", False),
    "jointing": ("3,4", 12, 0.38, 0.10, "wheat_green", False),
    "heading": ("5", 9, 0.80, 0.08, "wheat_heading", True),
    "ripe": ("5,6", 9, 0.85, 0.12, "wheat_ripe", True),
    "stubble": ("6", 10, 0.16, 0.02, "stubble", False),
}


def wheat(coll, stage, lod=0):
    months, n, h, bend, slot, ears = WHEAT_STAGES[stage]
    rng = random.Random(sum(map(ord, stage)))
    bm = bmesh.new()
    S = [slot, "wheat_ear" if stage == "ripe" else "wheat_heading", "soil_dark"]
    if lod == 1:
        n = max(3, n // 3)
    for i in range(n):
        a = rng.uniform(0, 6.28)
        d = Vector((math.cos(a), math.sin(a), 0))
        base = Vector((rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), 0))
        hh = h * rng.uniform(0.8, 1.15)
        if ears:
            lean = d * bend * rng.uniform(0.2, 1.0)
            top = base + Vector((0, 0, hh)) + lean
            add_cyl(bm, base, top, 0.006, 0.004, segs=3, mat_index=0)
            if lod == 0:
                ear_d = (top - base).normalized()
                if stage == "ripe":
                    ear_d = (ear_d + d * 0.5).normalized()
                add_blob(bm, top + ear_d * 0.05, 0.022, rng, sub=1, squash=(0.8, 0.8, 2.8), jitter=0.05, mat_index=1)
                _strap(bm, base + Vector((0, 0, hh * 0.35)), -d, 0.22, 0.012, 0.1, 0.12, 0, segs=3)
            else:
                add_cyl(bm, top - Vector((0, 0, 0.02)), top + Vector((0, 0, 0.06)), 0.02, 0.006, segs=3, mat_index=1)
        elif stage == "stubble":
            add_cyl(bm, base, base + Vector((rng.uniform(-0.02, 0.02), rng.uniform(-0.02, 0.02), hh)), 0.006, 0.005, segs=3, mat_index=0)
        else:
            _blade(bm, base, d, hh, 0.012 if stage != "jointing" else 0.015, bend * rng.uniform(0.6, 1.3), 0, segs=3 if lod == 0 else 2)
    return finish(f"KIT wheat {stage} L{lod}", bm, S, coll,
                  {"sv_kind": "crop", "sv_family": "wheat", "sv_state": stage, "sv_lod": lod, "sv_months": months})


MAIZE_STAGES = {
    "seedling": ("6", 0.28, 4),
    "knee": ("7", 0.7, 7),
    "tall": ("7,8", 2.1, 12),
    "tasselled": ("8,9", 2.4, 13),
    "dry": ("9,10", 2.3, 11),
    "cut": ("10", 0.25, 0),
}


def maize(coll, stage, variant=0, lod=0):
    months, H, nleaf = MAIZE_STAGES[stage]
    rng = random.Random(700 + variant + sum(map(ord, stage)))
    bm = bmesh.new()
    dry = stage in ("dry", "cut")
    S = ["maize_dry" if dry else "maize_green", "maize_dry_d" if dry else "maize_dark", "tassel", "cob", "husk"]
    H *= rng.uniform(0.9, 1.1)
    add_cyl(bm, (0, 0, 0), (rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), H), 0.02 if H > 1 else 0.008, 0.008, segs=5 if lod == 0 else 3, mat_index=0)
    if lod == 1:
        nleaf = max(0, nleaf // 2)
    a0 = rng.uniform(0, 6.28)
    for i in range(nleaf):
        t = (i + 1) / (nleaf + 1)
        z = H * (0.08 + 0.82 * t) if H > 1 else H * 0.15 * t
        a = a0 + i * math.pi + rng.uniform(-0.35, 0.35)  # alternate sides like real maize
        d = Vector((math.cos(a), math.sin(a), 0))
        ln = (0.85 if H > 1 else 0.3 + H * 0.4) * (1.1 - 0.4 * abs(t - 0.45))
        droop = 0.9 if dry else 0.5
        _strap(bm, Vector((0, 0, z)), d, ln, 0.045 if H > 1 else 0.025, ln * (0.5 if not dry else 0.15), ln * droop,
               1 if i % 3 == 0 else 0, segs=5 if lod == 0 else 3, twist=0.3 if dry else 0.0)
    if stage in ("tasselled", "dry") and lod == 0:
        for k in range(7):
            a = rng.uniform(0, 6.28)
            d = Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 1)).normalized()
            add_cyl(bm, Vector((0, 0, H)), Vector((0, 0, H)) + d * 0.3, 0.004, 0.002, segs=3, mat_index=2)
        cob_z = H * 0.5
        add_blob(bm, Vector((0.07, 0, cob_z)), 0.045, rng, sub=1, squash=(1, 1, 3.4), jitter=0.0, mat_index=4 if stage == "tasselled" else 3)
    if stage == "cut":
        bm.clear()
        for k in range(3):
            add_cyl(bm, (k * 0.05 - 0.05, 0, 0), (k * 0.05 - 0.05, 0.01, 0.2 + 0.05 * k), 0.018, 0.016, segs=5, mat_index=0)
    return finish(f"KIT maize {stage} {variant} L{lod}", bm, S, coll,
                  {"sv_kind": "crop", "sv_family": "maize", "sv_variant": variant, "sv_state": stage, "sv_lod": lod, "sv_months": months})


def garlic(coll):
    rng = random.Random(800)
    bm = bmesh.new()
    for i in range(7):
        a = rng.uniform(0, 6.28)
        d = Vector((math.cos(a), math.sin(a), 0))
        _blade(bm, Vector((0, 0, 0)), d, rng.uniform(0.3, 0.42), 0.012, rng.uniform(0.05, 0.15), 0)
    return finish("KIT garlic L0", bm, ["garlic"], coll, {"sv_kind": "crop", "sv_family": "garlic", "sv_state": "growing", "sv_lod": 0, "sv_months": "10,11,12,1,2,3,4,5"})


def soybean(coll):
    """Low bushy soybean / peanut plant: stems with trifoliate leaves."""
    rng = random.Random(810)
    bm = bmesh.new()
    for i in range(6):
        a = rng.uniform(0, 6.28)
        top = Vector((math.cos(a) * 0.12, math.sin(a) * 0.12, rng.uniform(0.22, 0.4)))
        add_cyl(bm, (0, 0, 0), top, 0.006, 0.004, segs=3, mat_index=0)
        for k in range(3):
            la = a + (k - 1) * 0.9
            _strap(bm, top, Vector((math.cos(la), math.sin(la), 0)), 0.11, 0.035, 0.03, 0.05, 0, segs=2)
    return finish("KIT soybean L0", bm, ["bean"], coll, {"sv_kind": "crop", "sv_family": "soybean", "sv_state": "growing", "sv_lod": 0, "sv_months": "6,7,8,9"})


# ---------------------------------------------------------------- ground cover


def grass_tuft(coll, variant=0):
    rng = random.Random(900 + variant)
    bm = bmesh.new()
    for i in range(7):
        a = rng.uniform(0, 6.28)
        d = Vector((math.cos(a), math.sin(a), 0))
        _blade(bm, Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), 0)), d, rng.uniform(0.18, 0.34), 0.02, rng.uniform(0.04, 0.12),
               0 if rng.random() < 0.65 else 1, segs=2)
    return finish(f"KIT grass tuft {variant}", bm, ["grass", "grass_d"], coll, {"sv_kind": "ground", "sv_family": "grass", "sv_variant": variant, "sv_lod": 0})


def weed_rosette(coll):
    rng = random.Random(950)
    bm = bmesh.new()
    for i in range(8):
        a = i * 6.283 / 8 + rng.uniform(-0.2, 0.2)
        _strap(bm, Vector((0, 0, 0.01)), Vector((math.cos(a), math.sin(a), 0)), 0.16, 0.04, 0.06, 0.06, i % 2, segs=3)
    return finish("KIT weed rosette", bm, ["grass", "grass_d"], coll, {"sv_kind": "ground", "sv_family": "weed", "sv_lod": 0})


def wildflower(coll, colour):
    rng = random.Random(len(colour) * 31)
    bm = bmesh.new()
    for i in range(3):
        base = Vector((rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08), 0))
        hh = rng.uniform(0.22, 0.42)
        top = base + Vector((rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03), hh))
        add_cyl(bm, base, top, 0.005, 0.004, segs=3, mat_index=0)
        # flat painted flower head: petal disc plus a small centre
        add_cyl(bm, top, top + Vector((0, 0, 0.006)), 0.045, 0.04, segs=5, mat_index=1)
        add_cyl(bm, top + Vector((0, 0, 0.006)), top + Vector((0, 0, 0.014)), 0.014, 0.008, segs=3, mat_index=2)
    return finish(f"KIT wildflower {colour}", bm, ["stem", "flower_" + colour, "flower_center"], coll,
                  {"sv_kind": "ground", "sv_family": "wildflower", "sv_state": colour, "sv_lod": 0, "sv_months": "4,5,6,7,8,9"})


def reeds(coll, cattail=False):
    rng = random.Random(980 + cattail)
    bm = bmesh.new()
    for k in range(5):
        ox, oy = rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12)
        hh = rng.uniform(1.2, 1.9)
        lean = Vector((rng.uniform(-0.15, 0.15), rng.uniform(-0.15, 0.15), 0))
        add_cyl(bm, (ox, oy, 0), Vector((ox, oy, hh)) + lean, 0.012, 0.006, segs=3, mat_index=0)
        if cattail and rng.random() < 0.6:
            c0 = Vector((ox, oy, hh - 0.26)) + lean * 0.9
            add_cyl(bm, c0, c0 + Vector((0, 0, 0.24)), 0.032, 0.03, segs=5, mat_index=1)
        elif not cattail:
            add_cyl(bm, Vector((ox, oy, hh - 0.25)) + lean, Vector((ox, oy, hh + 0.05)) + lean, 0.05, 0.01, segs=4, mat_index=1)
        for j in range(2):
            a = rng.uniform(0, 6.28)
            _strap(bm, Vector((ox, oy, rng.uniform(0.1, 0.5))), Vector((math.cos(a), math.sin(a), 0)), 0.6, 0.025, 0.9, 0.5, 0, segs=3)
    nm = "KIT cattail clump" if cattail else "KIT reed clump"
    return finish(nm, bm, ["reed", "reed_head" if cattail else "stubble"], coll, {"sv_kind": "ground", "sv_family": "cattail" if cattail else "reed", "sv_lod": 0})
