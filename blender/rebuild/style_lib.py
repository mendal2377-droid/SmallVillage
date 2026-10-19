"""Shared painterly materials and asset builders for the SmallVillage 2.0 style lab.

Everything is procedural and original. Imported by build_style_lab.py inside Blender.
"""
import math
import random

import bmesh
import bpy
from mathutils import Vector

# ---------------------------------------------------------------- helpers


def coll(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    p = parent or bpy.context.scene.collection
    if c.name not in [ch.name for ch in p.children]:
        p.children.link(c)
    return c


def obj_from_bm(name, bm, mats, c):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    c.objects.link(o)
    return o


def link_dup(src, c, loc, rot_z=0.0, scale=1.0):
    o = bpy.data.objects.new(src.name + " i", src.data)
    o.location = loc
    o.rotation_euler = (0, 0, rot_z)
    o.scale = (scale, scale, scale)
    c.objects.link(o)
    return o


def add_box(bm, center, size, mat_index=0, rot_z=0.0):
    r = bmesh.ops.create_cube(bm, size=1.0)
    verts = r["verts"]
    bmesh.ops.scale(bm, vec=Vector(size), verts=verts)
    if rot_z:
        bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=_rotz(rot_z), verts=verts)
    bmesh.ops.translate(bm, vec=Vector(center), verts=verts)
    for f in {f for v in verts for f in v.link_faces}:
        f.material_index = mat_index
    return verts


def _rotz(a):
    from mathutils import Matrix
    return Matrix.Rotation(a, 3, "Z")


def add_cyl(bm, p0, p1, r0, r1, segs=8, mat_index=0):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1, depth=d.length)
    verts = r["verts"]
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=q.to_matrix(), verts=verts)
    bmesh.ops.translate(bm, vec=(p0 + p1) / 2, verts=verts)
    for f in {f for v in verts for f in v.link_faces}:
        f.material_index = mat_index
    return verts


def add_blob(bm, center, radius, rng, sub=2, squash=(1, 1, 1), jitter=0.18, mat_index=0):
    r = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=radius)
    verts = r["verts"]
    for v in verts:
        n = v.co.normalized()
        v.co = Vector((v.co.x * squash[0], v.co.y * squash[1], v.co.z * squash[2])) + n * radius * rng.uniform(-jitter, jitter)
    bmesh.ops.translate(bm, vec=Vector(center), verts=verts)
    for f in {f for v in verts for f in v.link_faces}:
        f.material_index = mat_index
    return verts


# ---------------------------------------------------------------- materials

_TOON = None


def toon_group():
    """Diffuse light -> soft two-tone ramp -> warm-lit / cool-shadow mix with brush noise."""
    global _TOON
    if _TOON and _TOON.name in bpy.data.node_groups:
        return _TOON
    ng = bpy.data.node_groups.new("SV Painted Toon", "ShaderNodeTree")
    io = ng.interface
    io.new_socket("Base", in_out="INPUT", socket_type="NodeSocketColor")
    io.new_socket("Shadow Tint", in_out="INPUT", socket_type="NodeSocketColor")
    io.new_socket("Variation", in_out="INPUT", socket_type="NodeSocketFloat")
    io.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
    N, L = ng.nodes, ng.links
    gi = N.new("NodeGroupInput")
    go = N.new("NodeGroupOutput")
    dif = N.new("ShaderNodeBsdfDiffuse")
    dif.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = N.new("ShaderNodeShaderToRGB")
    bw = N.new("ShaderNodeRGBToBW")
    ramp = N.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.22, (0, 0, 0, 1)
    e[1].position, e[1].color = 0.38, (1, 1, 1, 1)
    # cool shadow = base * tint
    shadow = N.new("ShaderNodeMix")
    shadow.data_type = "RGBA"
    shadow.blend_type = "MULTIPLY"
    shadow.inputs["Factor"].default_value = 1.0
    # warm lit = base * warm
    lit = N.new("ShaderNodeMix")
    lit.data_type = "RGBA"
    lit.blend_type = "MULTIPLY"
    lit.inputs["Factor"].default_value = 1.0
    lit.inputs["B"].default_value = (1.12, 1.04, 0.92, 1)
    # per-frame light colour (sunset orange, noon white) set through these two shared nodes
    glit = N.new("ShaderNodeRGB")
    glit.name = "global lit"
    glit.outputs[0].default_value = (1.12, 1.04, 0.92, 1)
    L.new(glit.outputs[0], lit.inputs["B"])
    gshadow = N.new("ShaderNodeMix")
    gshadow.name = "global shadow"
    gshadow.data_type = "RGBA"
    gshadow.blend_type = "MULTIPLY"
    gshadow.inputs["Factor"].default_value = 1.0
    gshadow.inputs["B"].default_value = (1, 1, 1, 1)
    mix = N.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    # soft grime / ground occlusion: everything darkens a little toward its foot
    geo = N.new("ShaderNodeNewGeometry")
    sepz = N.new("ShaderNodeSeparateXYZ")
    L.new(geo.outputs["Position"], sepz.inputs[0])
    grime = N.new("ShaderNodeMapRange")
    grime.inputs["From Min"].default_value = 0.0
    grime.inputs["From Max"].default_value = 1.2
    grime.inputs["To Min"].default_value = 0.80
    grime.inputs["To Max"].default_value = 1.0
    L.new(sepz.outputs["Z"], grime.inputs["Value"])
    gmul = N.new("ShaderNodeMix")
    gmul.data_type = "RGBA"
    gmul.blend_type = "MULTIPLY"
    gmul.inputs["Factor"].default_value = 1.0
    gcol = N.new("ShaderNodeCombineColor")
    for k in ("Red", "Green", "Blue"):
        L.new(grime.outputs[0], gcol.inputs[k])
    L.new(gcol.outputs[0], gmul.inputs["B"])
    # brush variation
    tc = N.new("ShaderNodeTexCoord")
    noise = N.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.35
    noise.inputs["Detail"].default_value = 3.0
    noise2 = N.new("ShaderNodeTexNoise")
    noise2.inputs["Scale"].default_value = 6.0
    noise2.inputs["Detail"].default_value = 2.0
    add = N.new("ShaderNodeMath")
    add.operation = "ADD"
    sub = N.new("ShaderNodeMath")
    sub.operation = "SUBTRACT"
    sub.inputs[1].default_value = 1.0
    scl = N.new("ShaderNodeMath")
    scl.operation = "MULTIPLY"
    vary = N.new("ShaderNodeMix")
    vary.data_type = "RGBA"
    vary.blend_type = "OVERLAY"
    em = N.new("ShaderNodeEmission")

    L.new(dif.outputs[0], s2r.inputs[0])
    L.new(s2r.outputs["Color"], bw.inputs[0])
    L.new(bw.outputs[0], ramp.inputs[0])
    L.new(gi.outputs["Base"], shadow.inputs["A"])
    L.new(gi.outputs["Shadow Tint"], shadow.inputs["B"])
    L.new(gi.outputs["Base"], lit.inputs["A"])
    L.new(ramp.outputs["Color"], mix.inputs["Factor"])
    L.new(shadow.outputs["Result"], gshadow.inputs["A"])
    L.new(gshadow.outputs["Result"], mix.inputs["A"])
    L.new(lit.outputs["Result"], mix.inputs["B"])
    L.new(tc.outputs["Object"], noise.inputs["Vector"])
    L.new(tc.outputs["Object"], noise2.inputs["Vector"])
    L.new(noise.outputs["Fac"], add.inputs[0])
    L.new(noise2.outputs["Fac"], add.inputs[1])
    L.new(add.outputs[0], sub.inputs[0])
    L.new(sub.outputs[0], scl.inputs[0])
    L.new(gi.outputs["Variation"], scl.inputs[1])
    scl2 = N.new("ShaderNodeMath")
    scl2.operation = "MULTIPLY"
    scl2.inputs[1].default_value = 1.8
    L.new(scl.outputs[0], scl2.inputs[0])
    L.new(scl2.outputs[0], vary.inputs["Factor"])
    L.new(mix.outputs["Result"], vary.inputs["A"])
    vary.inputs["B"].default_value = (0.75, 0.75, 0.75, 1)
    L.new(vary.outputs["Result"], gmul.inputs["A"])
    L.new(gmul.outputs["Result"], em.inputs["Color"])
    L.new(em.outputs[0], go.inputs["Shader"])
    _TOON = ng
    return ng


SHADOW_TINT = (0.50, 0.55, 0.78, 1)


def toon(name, base, var=0.5, tint=SHADOW_TINT, instancer_tint=False):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    build_toon_nodes(m, base, var, tint, instancer_tint)
    return m


def build_toon_nodes(m, base, var=0.5, tint=SHADOW_TINT, instancer_tint=False):
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    g = nt.nodes.new("ShaderNodeGroup")
    g.node_tree = toon_group()
    base = tuple(base[:3]) + (1,)
    g.inputs["Shadow Tint"].default_value = tint
    g.inputs["Variation"].default_value = var
    if instancer_tint:
        # per-instance hue/value variation from geometry nodes attribute "tint"
        at = nt.nodes.new("ShaderNodeAttribute")
        at.attribute_type = "INSTANCER"
        at.attribute_name = "tint"
        hsv = nt.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Color"].default_value = base
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 0.8
        mr.inputs["To Max"].default_value = 1.2
        nt.links.new(at.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs[0], hsv.inputs["Value"])
        hu = nt.nodes.new("ShaderNodeMapRange")
        hu.inputs["To Min"].default_value = 0.47
        hu.inputs["To Max"].default_value = 0.53
        nt.links.new(at.outputs["Fac"], hu.inputs["Value"])
        nt.links.new(hu.outputs[0], hsv.inputs["Hue"])
        nt.links.new(hsv.outputs[0], g.inputs["Base"])
    else:
        g.inputs["Base"].default_value = base
    nt.links.new(g.outputs[0], out.inputs["Surface"])
    return m


def water_material(name, deep, shallow, algae=None, algae_amount=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    lw = N.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.35
    mixc = N.new("ShaderNodeMix")
    mixc.data_type = "RGBA"
    mixc.inputs["A"].default_value = deep
    mixc.inputs["B"].default_value = shallow
    L.new(lw.outputs["Facing"], mixc.inputs["Factor"])
    col = mixc.outputs["Result"]
    if algae:
        tc = N.new("ShaderNodeTexCoord")
        nz = N.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 0.08
        nz.inputs["Detail"].default_value = 6
        L.new(tc.outputs["Object"], nz.inputs["Vector"])
        rp = N.new("ShaderNodeValToRGB")
        rp.color_ramp.elements[0].position = 0.62 - algae_amount * 0.3
        rp.color_ramp.elements[1].position = 0.66 - algae_amount * 0.3
        L.new(nz.outputs["Fac"], rp.inputs[0])
        ma = N.new("ShaderNodeMix")
        ma.data_type = "RGBA"
        L.new(rp.outputs["Color"], ma.inputs["Factor"])
        L.new(col, ma.inputs["A"])
        ma.inputs["B"].default_value = algae
        col = ma.outputs["Result"]
        algae_mask = rp.outputs["Color"]
    em = N.new("ShaderNodeEmission")
    L.new(col, em.inputs["Color"])
    gl = N.new("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.04
    gl.inputs["Color"].default_value = (0.9, 0.95, 1.0, 1)
    # gentle ripple normals
    tc2 = N.new("ShaderNodeTexCoord")
    wv = N.new("ShaderNodeTexNoise")
    wv.inputs["Scale"].default_value = 1.6
    L.new(tc2.outputs["Object"], wv.inputs["Vector"])
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.06
    L.new(wv.outputs["Fac"], bump.inputs["Height"])
    L.new(bump.outputs[0], gl.inputs["Normal"])
    fr = N.new("ShaderNodeLayerWeight")
    fr.inputs["Blend"].default_value = 0.25
    mul = N.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = 0.85
    L.new(fr.outputs["Fresnel"], mul.inputs[0])
    if algae:
        inv = N.new("ShaderNodeInvert")
        L.new(algae_mask, inv.inputs["Color"])
        bwm = N.new("ShaderNodeRGBToBW")
        L.new(inv.outputs[0], bwm.inputs[0])
        mul2 = N.new("ShaderNodeMath")
        mul2.operation = "MULTIPLY"
        L.new(mul.outputs[0], mul2.inputs[0])
        L.new(bwm.outputs[0], mul2.inputs[1])
        fac = mul2.outputs[0]
    else:
        fac = mul.outputs[0]
    ms = N.new("ShaderNodeMixShader")
    L.new(fac, ms.inputs["Fac"])
    L.new(em.outputs[0], ms.inputs[1])
    L.new(gl.outputs[0], ms.inputs[2])
    L.new(ms.outputs[0], out.inputs["Surface"])
    return m


def striped_field_material(name, a, b, stripe_scale=1.6, along="X"):
    """Distant field: crop rows as painted stripes plus large patch variation."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    tc = N.new("ShaderNodeTexCoord")
    wave = N.new("ShaderNodeTexWave")
    wave.bands_direction = along
    wave.inputs["Scale"].default_value = stripe_scale
    wave.inputs["Distortion"].default_value = 0.6
    L.new(tc.outputs["Object"], wave.inputs["Vector"])
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 0.02
    nz.inputs["Detail"].default_value = 5
    nz.inputs["Roughness"].default_value = 0.6
    L.new(tc.outputs["Object"], nz.inputs["Vector"])
    m1 = N.new("ShaderNodeMix")
    m1.data_type = "RGBA"
    m1.inputs["A"].default_value = a
    m1.inputs["B"].default_value = b
    L.new(nz.outputs["Fac"], m1.inputs["Factor"])
    m2 = N.new("ShaderNodeMix")
    m2.data_type = "RGBA"
    m2.blend_type = "MULTIPLY"
    m2.inputs["Factor"].default_value = 0.25
    L.new(m1.outputs["Result"], m2.inputs["A"])
    L.new(wave.outputs["Color"], m2.inputs["B"])
    g = N.new("ShaderNodeGroup")
    g.node_tree = toon_group()
    g.inputs["Shadow Tint"].default_value = SHADOW_TINT
    g.inputs["Variation"].default_value = 0.4
    L.new(m2.outputs["Result"], g.inputs["Base"])
    L.new(g.outputs[0], out.inputs["Surface"])
    return m


def concrete_road_material(name, base, joint_every=6.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new("ShaderNodeOutputMaterial")
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Object"], sep.inputs[0])
    md = N.new("ShaderNodeMath")
    md.operation = "PINGPONG"
    md.inputs[1].default_value = joint_every / 2
    L.new(sep.outputs["Y"], md.inputs[0])
    lt = N.new("ShaderNodeMath")
    lt.operation = "LESS_THAN"
    lt.inputs[1].default_value = 0.03
    L.new(md.outputs[0], lt.inputs[0])
    nz = N.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 0.6
    L.new(tc.outputs["Object"], nz.inputs["Vector"])
    m1 = N.new("ShaderNodeMix")
    m1.data_type = "RGBA"
    m1.inputs["A"].default_value = base
    m1.inputs["B"].default_value = tuple(c * 0.86 for c in base[:3]) + (1,)
    L.new(nz.outputs["Fac"], m1.inputs["Factor"])
    m2 = N.new("ShaderNodeMix")
    m2.data_type = "RGBA"
    L.new(lt.outputs[0], m2.inputs["Factor"])
    L.new(m1.outputs["Result"], m2.inputs["A"])
    m2.inputs["B"].default_value = tuple(c * 0.6 for c in base[:3]) + (1,)
    g = N.new("ShaderNodeGroup")
    g.node_tree = toon_group()
    g.inputs["Shadow Tint"].default_value = SHADOW_TINT
    g.inputs["Variation"].default_value = 0.25
    L.new(m2.outputs["Result"], g.inputs["Base"])
    L.new(g.outputs[0], out.inputs["Surface"])
    return m


# ---------------------------------------------------------------- scatter (geometry nodes)


def scatter(surface, instance_obj, density, seed=0, scale=(0.8, 1.2), tilt=0.15, align_up=True):
    """Scatter instance_obj over surface faces; stores per-instance 'tint' for colour variation."""
    ng = bpy.data.node_groups.new(f"scatter {instance_obj.name}", "GeometryNodeTree")
    ng.is_modifier = True
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N, L = ng.nodes, ng.links
    gi = N.new("NodeGroupInput")
    go = N.new("NodeGroupOutput")
    dist = N.new("GeometryNodeDistributePointsOnFaces")
    dist.inputs["Density"].default_value = density
    dist.inputs["Seed"].default_value = seed
    oi = N.new("GeometryNodeObjectInfo")
    oi.inputs["Object"].default_value = instance_obj
    oi.inputs["As Instance"].default_value = True
    inst = N.new("GeometryNodeInstanceOnPoints")
    rs = N.new("FunctionNodeRandomValue")
    rs.data_type = "FLOAT"
    rs.inputs["Min"].default_value = scale[0]
    rs.inputs["Max"].default_value = scale[1]
    rs.inputs["Seed"].default_value = seed + 1
    rz = N.new("FunctionNodeRandomValue")
    rz.data_type = "FLOAT"
    rz.inputs["Min"].default_value = 0
    rz.inputs["Max"].default_value = 6.283
    rz.inputs["Seed"].default_value = seed + 2
    rt = N.new("FunctionNodeRandomValue")
    rt.data_type = "FLOAT"
    rt.inputs["Min"].default_value = -tilt
    rt.inputs["Max"].default_value = tilt
    rt.inputs["Seed"].default_value = seed + 3
    cx = N.new("ShaderNodeCombineXYZ")
    L.new(rt.outputs["Value"], cx.inputs["X"])
    L.new(rz.outputs["Value"], cx.inputs["Z"])
    e2r = N.new("FunctionNodeEulerToRotation")
    L.new(cx.outputs[0], e2r.inputs[0])
    tint = N.new("FunctionNodeRandomValue")
    tint.data_type = "FLOAT"
    tint.inputs["Seed"].default_value = seed + 4
    store = N.new("GeometryNodeStoreNamedAttribute")
    store.data_type = "FLOAT"
    store.domain = "INSTANCE"
    store.inputs["Name"].default_value = "tint"
    L.new(gi.outputs[0], dist.inputs["Mesh"])
    L.new(dist.outputs["Points"], inst.inputs["Points"])
    L.new(oi.outputs["Geometry"], inst.inputs["Instance"])
    L.new(rs.outputs["Value"], inst.inputs["Scale"])
    L.new(e2r.outputs[0], inst.inputs["Rotation"])
    L.new(inst.outputs[0], store.inputs["Geometry"])
    L.new(tint.outputs["Value"], store.inputs["Value"])
    L.new(store.outputs[0], go.inputs[0])
    mod = surface.modifiers.new("scatter", "NODES")
    mod.node_group = ng
    return mod


# ---------------------------------------------------------------- assets


def make_blade(name, c, mat, h=0.35, w=0.03, bend=0.08, n=1):
    bm = bmesh.new()
    rng = random.Random(len(name))
    for k in range(n):
        a = rng.uniform(0, 6.28)
        ox, oy = rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04)
        hh = h * rng.uniform(0.75, 1.15)
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-d.y, d.x, 0)) * w
        segs = 3
        prev = None
        for i in range(segs + 1):
            t = i / segs
            p = Vector((ox, oy, 0)) + d * bend * t * t + Vector((0, 0, hh * t))
            s = side * (1 - t * 0.9)
            v1, v2 = bm.verts.new(p - s), bm.verts.new(p + s)
            if prev:
                bm.faces.new((prev[0], prev[1], v2, v1))
            prev = (v1, v2)
    return obj_from_bm(name, bm, [mat], c)


def make_wheat_ear_plant(name, c, mat_stem, mat_ear, h=0.85, n=4):
    bm = bmesh.new()
    rng = random.Random(7)
    for k in range(n):
        ox, oy = rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05)
        hh = h * rng.uniform(0.85, 1.1)
        lean = Vector((rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08), 0))
        top = Vector((ox, oy, hh)) + lean
        add_cyl(bm, (ox, oy, 0), top, 0.006, 0.004, segs=4, mat_index=0)
        add_blob(bm, top + Vector((0, 0, 0.05)) + lean * 0.3, 0.025, rng, sub=1, squash=(0.7, 0.7, 2.6), jitter=0.05, mat_index=1)
    # a couple of leaves
    return obj_from_bm(name, bm, [mat_stem, mat_ear], c)


def make_flower(name, c, mat_stem, mat_head, h=0.35, head=0.045, n=3):
    bm = bmesh.new()
    rng = random.Random(len(name) * 3)
    for k in range(n):
        ox, oy = rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08)
        hh = h * rng.uniform(0.6, 1.2)
        add_cyl(bm, (ox, oy, 0), (ox, oy, hh), 0.005, 0.004, segs=4, mat_index=0)
        add_blob(bm, (ox, oy, hh), head, rng, sub=1, squash=(1, 1, 0.45), jitter=0.1, mat_index=1)
    return obj_from_bm(name, bm, [mat_stem, mat_head], c)


def make_poplar(name, c, mats, seed, height=17.0, leafy=True):
    """mats: bark, whitewash, leaf-light, leaf-dark. Slim trunk, high narrow airy crown of small clumps."""
    rng = random.Random(seed)
    bm = bmesh.new()
    lean = Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 0))
    top = Vector((0, 0, height)) + lean
    add_cyl(bm, (0, 0, 0), top, 0.15, 0.03, segs=8, mat_index=0)
    add_cyl(bm, (0, 0, -0.05), (lean.x * 0.07, lean.y * 0.07, 1.1), 0.162, 0.155, segs=8, mat_index=1)
    # steep upward branches (visible through the gaps)
    branches = []
    for i in range(18):
        z = rng.uniform(height * 0.38, height * 0.9)
        base = Vector((0, 0, z)) + lean * (z / height)
        a = rng.uniform(0, 6.28)
        ln = rng.uniform(1.4, 3.0) * (1.15 - z / height)
        tip = base + Vector((math.cos(a) * ln * 0.45, math.sin(a) * ln * 0.45, ln))
        add_cyl(bm, base, tip, 0.04, 0.012, segs=5, mat_index=0)
        branches.append((base, tip))
    if leafy:
        for i in range(110):
            if rng.random() < 0.55 and branches:
                b0, b1 = rng.choice(branches)
                cen = b0.lerp(b1, rng.uniform(0.3, 1.0))
                cen += Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), rng.uniform(-0.3, 0.6)))
                t = cen.z / height
            else:
                t = rng.uniform(0.4, 1.02)
                prof = math.sin(math.pi * min(1, max(0.0, (t - 0.36) / 0.68))) ** 0.8
                rad = 0.3 + 1.25 * prof
                a = rng.uniform(0, 6.28)
                off = rng.uniform(0.0, 1.0) * rad
                cen = Vector((math.cos(a) * off, math.sin(a) * off, height * t)) + lean * t
            prof = math.sin(math.pi * min(1, max(0.05, (t - 0.36) / 0.68)))
            r = rng.uniform(0.32, 0.62) * (0.6 + 0.5 * prof)
            mi = 2 if rng.random() < 0.5 else 3
            add_blob(bm, cen, r, rng, sub=2, squash=(1, 1, 1.3), jitter=0.12, mat_index=mi)
            # small leaf clusters breaking up the silhouette
            for k in range(5):
                d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.6, 1))).normalized()
                add_blob(bm, cen + d * r * rng.uniform(0.85, 1.15), r * rng.uniform(0.22, 0.38), rng, sub=1,
                         squash=(1, 1, 1.2), jitter=0.15, mat_index=2 if rng.random() < 0.6 else 3)
    return obj_from_bm(name, bm, mats, c)


def make_willow(name, c, mats, seed, height=7.5):
    """mats: bark, leaf-light, leaf-dark. Leaning trunk, rounded crown, hanging strands."""
    rng = random.Random(seed)
    bm = bmesh.new()
    lean = Vector((rng.uniform(-1.2, 1.2), rng.uniform(0.4, 1.4), 0))
    fork = Vector((0, 0, height * 0.45)) + lean * 0.5
    add_cyl(bm, (0, 0, 0), fork, 0.42, 0.28, segs=10, mat_index=0)
    crown_c = Vector((0, 0, height * 0.8)) + lean
    for i in range(5):
        a = rng.uniform(0, 6.28)
        tip = crown_c + Vector((math.cos(a) * 2.2, math.sin(a) * 2.2, rng.uniform(-0.4, 1.0)))
        add_cyl(bm, fork, tip, 0.2, 0.06, segs=6, mat_index=0)
    for i in range(22):
        a = rng.uniform(0, 6.28)
        rr = rng.uniform(0, 3.0)
        cen = crown_c + Vector((math.cos(a) * rr, math.sin(a) * rr, rng.uniform(-0.5, 1.2)))
        add_blob(bm, cen, rng.uniform(0.9, 1.5), rng, sub=2, squash=(1, 1, 0.8), jitter=0.2, mat_index=1 if rng.random() < 0.5 else 2)
    # hanging strands
    for i in range(170):
        a = rng.uniform(0, 6.28)
        rr = rng.uniform(1.6, 3.9)
        top = crown_c + Vector((math.cos(a) * rr, math.sin(a) * rr, rng.uniform(-0.6, 0.6)))
        ln = rng.uniform(1.8, 4.2)
        w = 0.09
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-d.y, d.x, 0)) * w
        prev = None
        for k in range(4):
            t = k / 3
            p = top + Vector((0, 0, -ln * t)) + d * 0.25 * t
            s = side * (1 - 0.7 * t)
            v1, v2 = bm.verts.new(p - s), bm.verts.new(p + s)
            if prev:
                f = bm.faces.new((prev[0], prev[1], v2, v1))
                f.material_index = 1 if rng.random() < 0.6 else 2
            prev = (v1, v2)
    return obj_from_bm(name, bm, mats, c)


def make_round_tree(name, c, mats, seed, height=6.5, spread=3.0):
    """Generic courtyard / village broadleaf (paulownia, elm, toon)."""
    rng = random.Random(seed)
    bm = bmesh.new()
    top = Vector((rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), height * 0.55))
    add_cyl(bm, (0, 0, 0), top, 0.22, 0.14, segs=8, mat_index=0)
    cc = top + Vector((0, 0, height * 0.25))
    for i in range(16):
        a = rng.uniform(0, 6.28)
        rr = rng.uniform(0, spread)
        cen = cc + Vector((math.cos(a) * rr, math.sin(a) * rr, rng.uniform(-0.6, 1.5)))
        add_blob(bm, cen, rng.uniform(0.9, 1.6), rng, sub=2, squash=(1, 1, 0.85), jitter=0.2, mat_index=1 if rng.random() < 0.5 else 2)
    return obj_from_bm(name, bm, mats, c)


def make_cloud(name, c, mat, seed, w=120, h=55):
    rng = random.Random(seed)
    bm = bmesh.new()
    n = 26
    for i in range(n):
        x = rng.uniform(-w / 2, w / 2)
        prof = 1 - (2 * x / w) ** 2
        z = rng.uniform(0, h * prof)
        r = rng.uniform(0.18, 0.32) * h * (0.5 + prof)
        add_blob(bm, (x, rng.uniform(-w * 0.12, w * 0.12), z), r, rng, sub=3, squash=(1, 0.8, 0.85), jitter=0.05)
    # flat-ish base
    for v in bm.verts:
        if v.co.z < 0:
            v.co.z *= 0.25
    o = obj_from_bm(name, bm, [mat], c)
    o.visible_shadow = False
    return o


def make_pole(name, c, mats, h=9.0):
    bm = bmesh.new()
    add_cyl(bm, (0, 0, 0), (0, 0, h), 0.14, 0.09, segs=8, mat_index=0)
    add_box(bm, (0, 0, h - 0.5), (1.6, 0.1, 0.1), mat_index=0)
    for x in (-0.7, -0.25, 0.25, 0.7):
        add_cyl(bm, (x, 0, h - 0.45), (x, 0, h - 0.3), 0.03, 0.03, segs=5, mat_index=1)
    return obj_from_bm(name, bm, mats, c)


def wire(name, c, mat, p0, p1, sag=0.6, r=0.012):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 1
    sp = cu.splines.new("POLY")
    n = 12
    sp.points.add(n - 1)
    p0, p1 = Vector(p0), Vector(p1)
    for i in range(n):
        t = i / (n - 1)
        p = p0.lerp(p1, t) - Vector((0, 0, sag * 4 * t * (1 - t)))
        sp.points[i].co = (p.x, p.y, p.z, 1)
    cu.materials.append(mat)
    o = bpy.data.objects.new(name, cu)
    c.objects.link(o)
    return o


def make_house(name, c, M, w, d, floors, style, rng, gate=True):
    """Village house. M: dict of materials. style: 'flat', 'pitched', 'brick'.
    Front faces -Y. Origin at front-left ground."""
    bm = bmesh.new()
    mats = [M["plaster"], M["plinth"], M["window"], M["frame"], M["roof"], M["brick"], M["gate"], M["rail"], M["tile"], M.get("side", M["plaster"])]
    fh = 3.2
    H = floors * fh
    body = 5 if style == "brick" else (8 if style == "tile" else 0)
    add_box(bm, (w / 2, d / 2, H / 2), (w, d, H), mat_index=body)
    if style != "brick":
        add_box(bm, (w / 2, d / 2 - 0.01, 0.45), (w + 0.04, d + 0.04, 0.9), mat_index=1)
    else:
        add_box(bm, (w / 2, d / 2 - 0.01, 0.55), (w + 0.04, d + 0.04, 1.1), mat_index=0)  # whitewashed band
    # unfinished grey cement gable walls, very common in the village photographs
    if style in ("flat", "tile") and rng.random() < 0.7:
        for x in (-0.03, w + 0.03):
            add_box(bm, (x, d / 2, H / 2 + 0.2), (0.04, d - 0.1, H + 0.4), mat_index=9)
    # windows
    for f in range(floors):
        nwin = max(1, int(w / 3.2))
        for i in range(nwin):
            x = (i + 0.5) * w / nwin
            if f == 0 and gate and i == nwin // 2:
                add_box(bm, (x, -0.06, 1.25), (1.7, 0.14, 2.5), mat_index=6)
                add_box(bm, (x, -0.1, 2.75), (2.1, 0.2, 0.25), mat_index=1)
                continue
            z = f * fh + 1.75
            add_box(bm, (x, -0.04, z), (1.5, 0.1, 1.35), mat_index=3)
            add_box(bm, (x, -0.07, z), (1.32, 0.1, 1.18), mat_index=2)
    if style in ("flat", "tile"):
        add_box(bm, (w / 2, d / 2, H + 0.12), (w + 0.3, d + 0.3, 0.24), mat_index=0)
        if rng.random() < 0.6:
            for i in range(int(w / 0.5)):
                add_box(bm, (0.25 + i * 0.5, -0.05, H + 0.55), (0.05, 0.05, 0.7), mat_index=7)
            add_box(bm, (w / 2, -0.05, H + 0.92), (w, 0.08, 0.08), mat_index=7)
        else:
            add_box(bm, (w / 2, 0.0, H + 0.45), (w + 0.3, 0.22, 0.7), mat_index=0)
    else:
        # pitched red tile roof along x
        ov = 0.45
        rh = d * 0.32
        verts = [
            bm.verts.new((-ov, -ov, H)), bm.verts.new((w + ov, -ov, H)),
            bm.verts.new((w + ov, d + ov, H)), bm.verts.new((-ov, d + ov, H)),
            bm.verts.new((-ov, d / 2, H + rh)), bm.verts.new((w + ov, d / 2, H + rh)),
        ]
        f1 = bm.faces.new((verts[0], verts[1], verts[5], verts[4]))
        f2 = bm.faces.new((verts[2], verts[3], verts[4], verts[5]))
        f3 = bm.faces.new((verts[0], verts[4], verts[3]))
        f4 = bm.faces.new((verts[1], verts[2], verts[5]))
        for f in (f1, f2):
            f.material_index = 4
        for f in (f3, f4):
            f.material_index = body
        gv = [bm.verts.new((0, 0, H)), bm.verts.new((0, d, H)), bm.verts.new((0, d / 2, H + rh - 0.2))]
        bm.faces.new(gv).material_index = body
        gv = [bm.verts.new((w, d, H)), bm.verts.new((w, 0, H)), bm.verts.new((w, d / 2, H + rh - 0.2))]
        bm.faces.new(gv).material_index = body
    o = obj_from_bm(name, bm, mats, c)
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def annulus(name, c, cx, cy, rx, ry, width, z, mat, a0=0.0, a1=6.2832, segs=64, wobble=0.0, seed=0):
    """Band around an ellipse (for reeds / bank grass), optionally only an arc."""
    rng = random.Random(seed)
    ph = [rng.uniform(0, 6.28) for _ in range(3)]
    bm = bmesh.new()
    prev = None
    for i in range(segs + 1):
        a = a0 + (a1 - a0) * i / segs
        k = 1 + wobble * (0.5 * math.sin(3 * a + ph[0]) + 0.3 * math.sin(5 * a + ph[1]) + 0.2 * math.sin(7 * a + ph[2]))
        ci, sn = math.cos(a), math.sin(a)
        v1 = bm.verts.new((cx + rx * k * ci, cy + ry * k * sn, z))
        v2 = bm.verts.new((cx + (rx * k + width) * ci, cy + (ry * k + width) * sn, z))
        if prev:
            bm.faces.new((prev[0], prev[1], v2, v1))
        prev = (v1, v2)
    return obj_from_bm(name, bm, [mat], c)


def make_reed(name, c, mat_leaf, mat_head, h=1.7, n=6):
    bm = bmesh.new()
    rng = random.Random(len(name) * 5)
    for k in range(n):
        ox, oy = rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12)
        hh = h * rng.uniform(0.7, 1.15)
        lean = Vector((rng.uniform(-0.15, 0.15), rng.uniform(-0.15, 0.15), 0))
        add_cyl(bm, (ox, oy, 0), Vector((ox, oy, hh)) + lean, 0.012, 0.006, segs=4, mat_index=0)
        if rng.random() < 0.45:
            add_blob(bm, Vector((ox, oy, hh - 0.1)) + lean * 0.95, 0.03, rng, sub=1, squash=(1, 1, 4.5), jitter=0.05, mat_index=1)
        # two long arching leaves
        for j in range(2):
            a = rng.uniform(0, 6.28)
            d = Vector((math.cos(a), math.sin(a), 0))
            side = Vector((-d.y, d.x, 0)) * 0.025
            base = Vector((ox, oy, rng.uniform(0.1, 0.5)))
            prev = None
            for i in range(5):
                t = i / 4
                p = base + d * 0.6 * t + Vector((0, 0, 0.9 * t - 0.5 * t * t))
                sv = side * (1 - 0.8 * t)
                v1, v2 = bm.verts.new(p - sv), bm.verts.new(p + sv)
                if prev:
                    bm.faces.new((prev[0], prev[1], v2, v1)).material_index = 0
                prev = (v1, v2)
    return obj_from_bm(name, bm, [mat_leaf, mat_head], c)


def make_duck(name, c, mats):
    """mats: white body, orange beak."""
    rng = random.Random(3)
    bm = bmesh.new()
    add_blob(bm, (0, 0, 0.12), 0.18, rng, sub=2, squash=(1.5, 1, 0.8), jitter=0.02)
    add_blob(bm, (0.24, 0, 0.32), 0.09, rng, sub=2, jitter=0.02)
    add_blob(bm, (0.34, 0, 0.3), 0.04, rng, sub=1, squash=(1.6, 1, 0.5), jitter=0.0, mat_index=1)
    add_blob(bm, (-0.27, 0, 0.2), 0.06, rng, sub=1, squash=(1.4, 1, 0.6), jitter=0.0)
    return obj_from_bm(name, bm, mats, c)


def make_stool_and_rod(name, c, mats):
    """mats: red plastic, bamboo, dark line. A low stool, a rod resting on a forked stick, a basin."""
    bm = bmesh.new()
    rng = random.Random(9)
    add_box(bm, (0, 0, 0.26), (0.32, 0.32, 0.04), mat_index=0)
    for x in (-0.13, 0.13):
        for y in (-0.13, 0.13):
            add_box(bm, (x, y, 0.12), (0.04, 0.04, 0.24), mat_index=0)
    add_cyl(bm, (0.5, 0.3, 0.0), (0.5, 0.3, 0.55), 0.015, 0.012, segs=5, mat_index=1)
    add_cyl(bm, (0.1, 0.45, 0.12), (0.6, 4.6, 1.5), 0.02, 0.006, segs=5, mat_index=1)
    add_cyl(bm, (0.6, 4.6, 1.5), (0.62, 4.75, -0.05), 0.002, 0.002, segs=3, mat_index=2)
    add_cyl(bm, (-0.45, 0.2, 0.0), (-0.45, 0.2, 0.16), 0.2, 0.24, segs=16, mat_index=0)
    return obj_from_bm(name, bm, mats, c)


def make_well_hut(name, c, mats):
    """Small white irrigation well hut with peaked roof (photos 09-12). mats: white, roof, door."""
    bm = bmesh.new()
    add_box(bm, (0, 0, 0.7), (1.0, 1.0, 1.4), mat_index=0)
    v = [bm.verts.new(p) for p in ((-0.6, -0.6, 1.4), (0.6, -0.6, 1.4), (0.6, 0.6, 1.4), (-0.6, 0.6, 1.4), (0, 0, 1.9))]
    for f in ((0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)):
        bm.faces.new([v[i] for i in f]).material_index = 1
    add_box(bm, (0, -0.51, 0.55), (0.5, 0.04, 0.9), mat_index=2)
    return obj_from_bm(name, bm, mats, c)


def make_tricycle(name, c, mats):
    """Electric cargo tricycle with green canopy (courtyard photos). mats: body teal, canopy green, black, seat."""
    bm = bmesh.new()
    rng = random.Random(4)
    add_box(bm, (0, -0.2, 0.55), (1.0, 1.3, 0.12), mat_index=0)
    add_box(bm, (0, -0.2, 0.75), (1.0, 1.3, 0.3), mat_index=0)
    add_box(bm, (0, 0.85, 0.75), (0.7, 0.8, 0.5), mat_index=0)
    add_box(bm, (0, 0.95, 1.05), (0.5, 0.4, 0.12), mat_index=3)
    add_box(bm, (0, 0.6, 1.75), (1.1, 1.6, 0.06), mat_index=1)
    for x in (-0.5, 0.5):
        add_cyl(bm, (x, 1.3, 0.6), (x, 1.3, 1.75), 0.02, 0.02, segs=5, mat_index=2)
        add_cyl(bm, (x, -0.1, 0.9), (x, -0.1, 1.75), 0.02, 0.02, segs=5, mat_index=2)
    add_cyl(bm, (0, 1.6, 0.3), (0, 1.45, 1.2), 0.03, 0.03, segs=5, mat_index=2)
    add_box(bm, (0, 1.42, 1.2), (0.7, 0.04, 0.04), mat_index=2)
    for x, y in ((-0.55, -0.5), (0.55, -0.5), (0, 1.6)):
        bmesh.ops.create_circle  # noqa: B018
        add_cyl(bm, (x - 0.06, y, 0.25), (x + 0.06, y, 0.25), 0.25, 0.25, segs=14, mat_index=2)
    return obj_from_bm(name, bm, mats, c)


def make_combine(name, c, mats):
    """Combine harvester for the wheat harvest. mats: red body, glass, dark, gold reel."""
    bm = bmesh.new()
    add_box(bm, (0, 0, 1.6), (2.8, 5.0, 2.2), mat_index=0)
    add_box(bm, (0, -2.0, 3.3), (1.6, 1.4, 1.3), mat_index=1)
    add_box(bm, (0, -2.0, 4.0), (1.8, 1.6, 0.1), mat_index=0)
    add_box(bm, (0, -3.6, 0.9), (4.6, 1.2, 0.6), mat_index=0)
    add_cyl(bm, (-2.3, -4.0, 1.4), (2.3, -4.0, 1.4), 0.55, 0.55, segs=12, mat_index=3)
    add_cyl(bm, (1.2, 1.5, 2.6), (3.6, 0.5, 3.6), 0.15, 0.15, segs=8, mat_index=0)
    for x, y, r in ((-1.45, -1.2, 0.85), (1.45, -1.2, 0.85), (-1.45, 1.8, 0.55), (1.45, 1.8, 0.55)):
        add_cyl(bm, (x - 0.25, y, r), (x + 0.25, y, r), r, r, segs=14, mat_index=2)
    o = obj_from_bm(name, bm, mats, c)
    for p in o.data.polygons:
        p.use_smooth = False
    return o
