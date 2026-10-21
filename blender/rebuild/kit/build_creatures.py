"""SmallVillage kit batch 5: the village child, the small dog and the animals, as part rigs.

  blender -b --factory-startup --python blender/rebuild/kit/build_creatures.py -- [--sheet]

Each creature is an empty "RIG <name>" with rigid mesh parts parented at their joints (pivot = part origin),
so the browser animates gaits by rotating parts (no skinning). All parts use the shared palette material.
Creatures face +Y in Blender (-Z in three.js, the walk controller's forward). Generic, not portraits.
Writes kit/creatures.blend, public/models/v2/creatures.glb and (with --sheet) kit/renders/creatures.png.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE, os.path.dirname(HERE)]
import kit_lib as K  # noqa: E402
import style_lib as SL  # noqa: E402
from kit_buildings import MeshWriter  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT_GLB = os.path.join(REPO, "public", "models", "v2", "creatures.glb")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


class Rig:
    def __init__(self, name, coll, height):
        self.name, self.coll = name, coll
        self.root = bpy.data.objects.new(f"RIG {name}", None)
        self.root.empty_display_size = 0.2
        self.root["sv_kind"] = "creature"
        self.root["sv_height"] = height
        coll.objects.link(self.root)
        self.parts, self.pivots = {}, {}

    def part(self, pname, pivot, build, parent=None):
        rng = random.Random(sum(map(ord, self.name + pname)))
        m = MeshWriter(0)
        build(m, rng)
        o = m.finish(f"{self.name}:{pname}", self.coll, {"sv_kind": "creature part", "sv_family": self.name, "sv_part": pname})
        for p in o.data.polygons:
            p.use_smooth = True
        pv = Vector(pivot)
        o.parent = self.parts[parent] if parent else self.root
        o.location = pv - (self.pivots[parent] if parent else Vector((0, 0, 0)))
        self.parts[pname], self.pivots[pname] = o, pv
        return o


def blob(m, c, r, slot, rng, sq=(1, 1, 1), sub=2, j=0.04):
    m.blob(c, r, slot, rng, sub=sub, squash=sq, jitter=j)


# ---------------------------------------------------------------- the village child (~1.36 m)

def child(coll):
    """A village child of about eight: striped short-sleeved polo, dark trousers, sneakers, tufted bob."""
    R = Rig("child", coll, 1.36)

    def hips(m, g):
        m.cyl((0, 0, -0.03), (0, 0, 0.1), 0.118, 0.124, "child_bottom", segs=16)        # seat of the trousers
        m.cyl((0, 0, 0.08), (0, 0, 0.115), 0.127, 0.127, "child_stripe", segs=16)       # waistband
        for s in (-1, 1):
            m.box((s * 0.085, -0.1, 0.03), (0.06, 0.012, 0.07), "child_bottom")          # back pockets
            m.box((s * 0.11, 0.055, 0.06), (0.012, 0.05, 0.05), "child_stripe")          # side pocket seams
    R.part("hips", (0, 0, 0.62), hips)

    def torso(m, g):
        m.cyl((0, 0, 0), (0, 0, 0.2), 0.124, 0.132, "child_top", segs=16)
        m.cyl((0, 0, 0.2), (0, 0, 0.31), 0.132, 0.118, "child_top", segs=16)
        blob(m, (0, 0, 0.3), 0.12, "child_top", g, (1.12, 0.8, 0.45), j=0)               # rounded shoulders
        for z in (0.07, 0.15, 0.23):
            m.cyl((0, 0, z), (0, 0, z + 0.03), 0.1345, 0.134, "child_stripe", segs=16)
        # polo collar: two flaps, a placket and two buttons
        m.cyl((0, 0, 0.33), (0, 0, 0.365), 0.068, 0.058, "child_top", segs=12)
        for s in (-1, 1):
            m.poly([(s * 0.012, 0.075, 0.345), (s * 0.075, 0.05, 0.35), (s * 0.06, 0.082, 0.3)], "cloth_cream")
            m.poly([(s * 0.06, 0.082, 0.3), (s * 0.075, 0.05, 0.35), (s * 0.012, 0.075, 0.345)], "cloth_cream")
        m.box((0, 0.124, 0.28), (0.03, 0.006, 0.08), "cloth_cream")
        for z in (0.29, 0.26):
            blob(m, (0, 0.13, z), 0.007, "ac_white", g, sub=1, j=0)
        m.box((-0.06, 0.128, 0.22), (0.05, 0.005, 0.05), "child_stripe")                 # chest pocket
    R.part("torso", (0, 0, 0.68), torso, "hips")

    def head(m, g):
        m.cyl((0, 0, -0.01), (0, 0, 0.075), 0.044, 0.046, "skin", segs=10)                 # neck
        blob(m, (0, 0.004, 0.17), 0.138, "skin", g, (1, 0.96, 1.04), sub=3, j=0.0)         # head
        blob(m, (0, 0.06, 0.1), 0.085, "skin", g, (1.05, 0.8, 0.75), sub=2, j=0)           # round chin and cheeks
        for s in (-1, 1):
            blob(m, (s * 0.136, 0.0, 0.16), 0.028, "skin", g, (0.45, 0.8, 1.15), sub=2, j=0)  # ears
            blob(m, (s * 0.142, 0.002, 0.158), 0.012, "cheek", g, (0.3, 0.7, 1.0), sub=1, j=0)
        # hair: a bob over the top and back, a fringe, and soft tufts with a cowlick at the crown
        blob(m, (0, -0.03, 0.215), 0.148, "hair", g, (1.04, 1.0, 0.92), sub=3, j=0.015)
        blob(m, (0, 0.065, 0.258), 0.095, "hair", g, (1.3, 0.75, 0.48), sub=2, j=0.02)
        for k in range(9):
            a = k / 9 * 6.283
            blob(m, (math.cos(a) * 0.12, -0.02 + math.sin(a) * 0.11, 0.26 + 0.02 * math.sin(a * 2)), 0.045, "hair", g, (1, 1, 0.7), sub=1, j=0.03)
        m.cyl((0.01, -0.06, 0.34), (0.03, -0.04, 0.39), 0.016, 0.003, "hair", segs=5)      # cowlick
        for s in (-1, 1):
            blob(m, (s * 0.11, 0.07, 0.17), 0.04, "hair", g, (0.6, 0.8, 1.4), sub=1, j=0.02)  # sideburn tufts
            # eyes: dark, with a white glint; brows; cheeks
            blob(m, (s * 0.05, 0.128, 0.165), 0.02, "eye", g, (1, 0.55, 1.3), sub=2, j=0)
            blob(m, (s * 0.05 + 0.007, 0.142, 0.172), 0.006, "ac_white", g, sub=1, j=0)
            blob(m, (s * 0.052, 0.13, 0.205), 0.02, "hair", g, (1.4, 0.45, 0.32), sub=1, j=0)
            blob(m, (s * 0.08, 0.112, 0.125), 0.026, "cheek", g, (1, 0.45, 0.7), sub=1, j=0)
        blob(m, (0, 0.145, 0.14), 0.014, "skin", g, (1, 1.1, 0.9), sub=1, j=0)            # nose
        for s in (-1, 1):                                                                 # a small smile
            blob(m, (s * 0.012, 0.137, 0.103), 0.008, "tongue", g, (1.4, 0.5, 0.6), sub=1, j=0)
        blob(m, (0, 0.138, 0.098), 0.009, "tongue", g, (1.5, 0.5, 0.6), sub=1, j=0)
    R.part("head", (0, 0, 1.03), head, "torso")

    for s, side in ((-1, "L"), (1, "R")):
        def arm(m, g, s=s):
            blob(m, (0, 0, -0.01), 0.05, "child_top", g, (1, 1, 1.1), sub=2, j=0)        # shoulder
            m.cyl((0, 0, 0), (0, 0, -0.16), 0.052, 0.05, "child_top", segs=12)          # short sleeve
            m.cyl((0, 0, -0.14), (0, 0, -0.165), 0.053, 0.052, "child_stripe", segs=12)  # sleeve hem
            m.cyl((0, 0, -0.16), (0, 0, -0.37), 0.034, 0.029, "skin", segs=10)
            blob(m, (0, 0.006, -0.405), 0.036, "skin", g, (0.75, 0.85, 1.15), sub=2, j=0)  # hand
            blob(m, (-s * 0.018, 0.026, -0.39), 0.014, "skin", g, (1, 1, 1.4), sub=1, j=0)  # thumb
        R.part(f"arm {side}", (s * 0.168, 0, 0.99), arm, "torso")

        def thigh(m, g):
            m.cyl((0, 0, 0.02), (0, 0, -0.28), 0.064, 0.054, "child_bottom", segs=12)
            blob(m, (0, 0.012, -0.28), 0.055, "child_bottom", g, (1, 1, 0.8), sub=2, j=0)  # knee
        R.part(f"leg {side}", (s * 0.07, 0, 0.6), thigh, "hips")

        def shin(m, g):
            m.cyl((0, 0, 0), (0, 0, -0.22), 0.053, 0.048, "child_bottom", segs=12)
            m.cyl((0, 0, -0.2), (0, 0, -0.235), 0.051, 0.051, "child_stripe", segs=12)  # turned-up cuff
            m.cyl((0, 0, -0.235), (0, 0, -0.26), 0.04, 0.04, "ac_white", segs=10)       # sock
            # sneaker: rounded toe cap, upper, laces, a thick pale sole
            m.box((0, 0.025, -0.285), (0.088, 0.15, 0.06), "shoe")
            blob(m, (0, 0.1, -0.29), 0.046, "shoe", g, (1, 1.05, 0.7), sub=2, j=0)
            m.box((0, 0.06, -0.255), (0.05, 0.08, 0.008), "cloth_cream")
            m.box((0, 0.035, -0.317), (0.098, 0.2, 0.024), "shoe_sole")
            blob(m, (0, 0.118, -0.318), 0.047, "shoe_sole", g, (1.03, 0.9, 0.3), sub=2, j=0)
        R.part(f"knee {side}", (s * 0.07, 0, 0.32), shin, f"leg {side}")
    return R


# ---------------------------------------------------------------- quadrupeds

def dog(coll):
    """Small yellow village dog (中华田园犬 type): pricked ears, curled tail, pale eyebrows and chest, a red collar."""
    R = Rig("dog", coll, 0.48)

    def body(m, g):
        blob(m, (0, 0, 0), 0.14, "dog_fur", g, (0.85, 1.7, 0.85), sub=3, j=0.02)
        blob(m, (0, 0.13, 0.04), 0.12, "dog_fur", g, (0.85, 0.9, 0.95), sub=2, j=0.01)     # deep chest
        blob(m, (0, 0.16, -0.01), 0.09, "dog_light", g, (0.75, 0.8, 0.95), sub=2, j=0)      # pale bib
        blob(m, (0, 0.02, -0.06), 0.11, "dog_light", g, (0.7, 1.45, 0.55), sub=2, j=0)      # belly
        for s in (-1, 1):
            blob(m, (s * 0.06, -0.15, 0.0), 0.085, "dog_fur", g, (0.7, 1.0, 1.0), sub=2, j=0.01)  # haunches
        blob(m, (0, 0.2, 0.12), 0.08, "dog_fur", g, (0.85, 0.9, 1.1), sub=2, j=0)           # neck
        m.cyl((0, 0.19, 0.06), (0, 0.235, 0.17), 0.083, 0.08, "plastic_red", segs=14)       # collar
        blob(m, (0, 0.265, 0.07), 0.018, "trim_gold", g, sub=2, j=0)                        # bell
    R.part("body", (0, 0, 0.3), body)

    def head(m, g):
        blob(m, (0, 0.03, 0.06), 0.105, "dog_fur", g, (1, 0.95, 0.95), sub=3, j=0)        # skull
        blob(m, (0, 0.125, 0.025), 0.06, "dog_light", g, (0.95, 1.35, 0.8), sub=2, j=0)    # muzzle
        blob(m, (0, 0.11, 0.06), 0.05, "dog_fur", g, (0.8, 1.2, 0.6), sub=2, j=0)          # bridge of the nose
        blob(m, (0, 0.188, 0.04), 0.024, "nose", g, (1.15, 0.85, 0.9), sub=2, j=0)
        m.box((0, 0.17, 0.0), (0.05, 0.03, 0.006), "nose")                                 # mouth line
        blob(m, (0, 0.165, -0.012), 0.018, "tongue", g, (1, 1.4, 0.4), sub=1, j=0)
        for s in (-1, 1):
            blob(m, (s * 0.046, 0.108, 0.098), 0.017, "eye", g, (1, 0.8, 1.05), sub=2, j=0)
            blob(m, (s * 0.046 + 0.005, 0.122, 0.104), 0.005, "ac_white", g, sub=1, j=0)  # glint
            blob(m, (s * 0.05, 0.095, 0.128), 0.014, "dog_light", g, (1.2, 0.8, 0.6), sub=1, j=0)  # pale "eyebrows"
            blob(m, (s * 0.06, 0.11, 0.035), 0.03, "dog_light", g, (0.8, 1, 0.8), sub=1, j=0)  # cheeks
            # pricked, slightly folded ears
            m.cyl((s * 0.055, 0.01, 0.13), (s * 0.075, 0.025, 0.22), 0.034, 0.004, "dog_fur", segs=6)
            m.cyl((s * 0.055, 0.016, 0.135), (s * 0.072, 0.03, 0.2), 0.022, 0.003, "dog_light", segs=5)
    R.part("head", (0, 0.24, 0.4), head, "body")

    def tail(m, g):
        # the curled tail, carried up over the back
        m.cyl((0, 0, 0), (0, -0.04, 0.09), 0.03, 0.025, "dog_fur", segs=8)
        m.cyl((0, -0.04, 0.09), (0, -0.01, 0.17), 0.025, 0.019, "dog_fur", segs=8)
        m.cyl((0, -0.01, 0.17), (0, 0.04, 0.19), 0.019, 0.012, "dog_fur", segs=8)
        blob(m, (0, 0.05, 0.188), 0.014, "dog_light", g, sub=1, j=0)
    R.part("tail", (0, -0.23, 0.36), tail, "body")
    for name, x, y in (("FL", -0.075, 0.15), ("FR", 0.075, 0.15), ("BL", -0.075, -0.15), ("BR", 0.075, -0.15)):
        def leg(m, g, back=name.startswith("B")):
            m.cyl((0, 0, 0.02), (0, 0.0 if not back else -0.01, -0.11), 0.042 if back else 0.036, 0.03, "dog_fur", segs=10)
            m.cyl((0, 0.0 if not back else -0.01, -0.11), (0, 0.005, -0.2), 0.03, 0.026, "dog_light" if not back else "dog_fur", segs=10)
            blob(m, (0, 0.016, -0.212), 0.032, "dog_light", g, (1, 1.25, 0.6), sub=2, j=0)  # paw
            for k in (-1, 0, 1):
                blob(m, (k * 0.014, 0.045, -0.218), 0.011, "dog_light", g, sub=1, j=0)     # toes
        R.part(f"leg {name}", (x, y, 0.23), leg, "body")
    return R


def cat(coll):
    R = Rig("cat", coll, 0.3)

    def body(m, g):
        blob(m, (0, 0, 0), 0.095, "cat_orange", g, (0.82, 1.9, 0.82))
        blob(m, (0, 0.06, -0.035), 0.07, "cat_white", g, (0.75, 1.3, 0.6))
    R.part("body", (0, 0, 0.2), body)

    def head(m, g):
        blob(m, (0, 0.03, 0.04), 0.075, "cat_orange", g, (1.05, 0.95, 0.9))
        blob(m, (0, 0.085, 0.015), 0.035, "cat_white", g, (1.2, 0.8, 0.7), sub=1)
        blob(m, (0, 0.108, 0.03), 0.01, "nose", g, sub=1, j=0)
        for s in (-1, 1):
            blob(m, (s * 0.032, 0.085, 0.06), 0.012, "eye", g, sub=1, j=0)
            m.cyl((s * 0.045, 0.02, 0.09), (s * 0.055, 0.02, 0.15), 0.025, 0.002, "cat_orange", segs=4)
    R.part("head", (0, 0.17, 0.28), head, "body")
    R.part("tail", (0, -0.17, 0.24), lambda m, g: (m.cyl((0, 0, 0), (0, -0.08, 0.14), 0.02, 0.016, "cat_orange", segs=6),
                                                   m.cyl((0, -0.08, 0.14), (0, -0.04, 0.26), 0.016, 0.01, "cat_orange", segs=6)), "body")
    for name, x, y in (("FL", -0.05, 0.11), ("FR", 0.05, 0.11), ("BL", -0.05, -0.11), ("BR", 0.05, -0.11)):
        R.part(f"leg {name}", (x, y, 0.15), lambda m, g: (m.cyl((0, 0, 0), (0, 0, -0.14), 0.02, 0.018, "cat_orange", segs=6),
                                                          blob(m, (0, 0.01, -0.145), 0.022, "cat_white", g, sub=1, j=0)), "body")
    return R


def goat(coll):
    R = Rig("goat", coll, 0.8)

    def body(m, g):
        blob(m, (0, 0, 0), 0.21, "goat_white", g, (0.78, 1.6, 0.85), j=0.08)
    R.part("body", (0, 0, 0.52), body)

    def head(m, g):
        m.cyl((0, -0.03, -0.05), (0, 0.06, 0.12), 0.07, 0.06, "goat_white", segs=8)  # neck
        blob(m, (0, 0.14, 0.15), 0.085, "goat_white", g, (0.75, 1.5, 0.85))
        blob(m, (0, 0.25, 0.12), 0.02, "nose", g, sub=1, j=0)
        blob(m, (0, 0.2, 0.05), 0.03, "goat_white", g, (0.6, 0.6, 1.6), sub=1)  # beard
        for s in (-1, 1):
            blob(m, (s * 0.055, 0.17, 0.19), 0.014, "eye", g, sub=1, j=0)
            m.cyl((s * 0.03, 0.1, 0.22), (s * 0.05, 0.02, 0.33), 0.018, 0.006, "horn", segs=6)
            blob(m, (s * 0.09, 0.08, 0.18), 0.04, "goat_white", g, (1.4, 0.6, 0.4), sub=1)
    R.part("head", (0, 0.28, 0.66), head, "body")
    R.part("tail", (0, -0.33, 0.6), lambda m, g: blob(m, (0, -0.02, 0.03), 0.04, "goat_white", g, (0.6, 0.8, 1.2), sub=1), "body")
    for name, x, y in (("FL", -0.09, 0.2), ("FR", 0.09, 0.2), ("BL", -0.09, -0.2), ("BR", 0.09, -0.2)):
        R.part(f"leg {name}", (x, y, 0.42), lambda m, g: (m.cyl((0, 0, 0), (0, 0, -0.38), 0.035, 0.025, "goat_white", segs=7),
                                                          m.cyl((0, 0, -0.38), (0, 0, -0.42), 0.028, 0.03, "horn", segs=7)), "body")
    return R


# ---------------------------------------------------------------- birds

def bird(coll, name, size, body_slot, belly_slot, head_slot, beak_slot, leg_slot, *, neck=0.0, tail=0.6, comb=False,
         bill=False, swim=False):
    s = size
    R = Rig(name, coll, (0.3 + neck) * s)

    def body(m, g):
        blob(m, (0, 0, 0), 0.1 * s, body_slot, g, (0.82, 1.35, 0.85))
        blob(m, (0, 0.02 * s, -0.035 * s), 0.075 * s, belly_slot, g, (0.75, 1.15, 0.6))
        blob(m, (0, -0.11 * s, 0.03 * s), 0.06 * s, body_slot, g, (0.55, 1.1 * tail, 0.7))
    R.part("body", (0, 0, (0.14 if not swim else 0.07) * s), body)

    def head(m, g):
        if neck:
            m.cyl((0, -0.01 * s, -0.03 * s), (0, 0, neck * s), 0.032 * s, 0.026 * s, head_slot, segs=8)
        hz = neck * s
        blob(m, (0, 0.015 * s, hz + 0.02 * s), 0.045 * s, head_slot, g)
        if bill:
            m.box((0, 0.075 * s, hz + 0.01 * s), (0.04 * s, 0.07 * s, 0.018 * s), beak_slot)
        else:
            m.cyl((0, 0.045 * s, hz + 0.02 * s), (0, 0.085 * s, hz + 0.012 * s), 0.014 * s, 0.002 * s, beak_slot, segs=5)
        for sd in (-1, 1):
            blob(m, (sd * 0.026 * s, 0.035 * s, hz + 0.035 * s), 0.008 * s, "eye", g, sub=1, j=0)
        if comb:
            blob(m, (0, 0.015 * s, hz + 0.065 * s), 0.025 * s, "comb", g, (0.4, 1.3, 1.0), sub=1, j=0.1)
            blob(m, (0, 0.05 * s, hz - 0.015 * s), 0.014 * s, "comb", g, (0.5, 0.6, 1.2), sub=1, j=0)
    R.part("head", (0, 0.1 * s, (0.21 if not swim else 0.14) * s), head, "body")
    for sd, side in ((-1, "L"), (1, "R")):
        R.part(f"wing {side}", (sd * 0.075 * s, 0.01 * s, (0.15 if not swim else 0.08) * s),
               lambda m, g, sd=sd: blob(m, (sd * 0.012 * s, -0.02 * s, 0), 0.07 * s, body_slot, g, (0.32, 1.25, 0.6), j=0.02), "body")
        if not swim:
            R.part(f"leg {side}", (sd * 0.035 * s, 0, 0.08 * s),
                   lambda m, g: (m.cyl((0, 0, 0), (0, 0, -0.08 * s), 0.008 * s, 0.006 * s, leg_slot, segs=4),
                                 m.box((0, 0.015 * s, -0.082 * s), (0.03 * s, 0.04 * s, 0.006 * s), leg_slot)), "body")
    return R


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    c = bpy.data.collections.new("KIT creatures")
    bpy.context.scene.collection.children.link(c)
    K.palette_material()
    rigs = [child(c), dog(c), cat(c), goat(c),
            bird(c, "hen brown", 1.0, "hen_brown", "hen_brown", "hen_brown", "beak", "beak", comb=True),
            bird(c, "hen white", 1.0, "hen_white", "hen_white", "hen_white", "beak", "beak", comb=True),
            bird(c, "duck", 1.1, "hen_white", "hen_white", "hen_white", "goose_beak", "goose_beak", bill=True, swim=True),
            bird(c, "goose", 1.5, "hen_white", "hen_white", "hen_white", "goose_beak", "goose_beak", neck=0.16, bill=True, swim=True),
            bird(c, "magpie", 0.62, "magpie_black", "hen_white", "magpie_black", "magpie_black", "magpie_black", tail=2.2),
            bird(c, "sparrow", 0.38, "sparrow", "sparrow_light", "sparrow", "magpie_black", "sparrow")]
    for m in list(bpy.data.materials):
        if m.name.startswith("slot:"):
            bpy.data.materials.remove(m)
    x = 0.0
    for r in rigs:
        r.root.location = (x, 0, 0)
        x += max(0.6, r.root["sv_height"] * 0.9) + 0.4
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "creatures.blend"))
    return rigs


def export(rigs):
    objs = []
    for r in rigs:
        r.root.location = (0, 0, 0)
        objs.append(r.root)
        objs += list(r.parts.values())
    for o in bpy.context.view_layer.objects:
        o.select_set(o in objs)
    bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
                              export_materials="NONE", export_extras=True, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6, export_animations=False, export_cameras=False,
                              export_lights=False)
    tris = {r.name: sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in r.parts.values()) for r in rigs}
    print("EXPORTED", OUT_GLB, os.path.getsize(OUT_GLB), tris)


def sheet(rigs):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 1600, 700
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("sheet")
    sc.world = w
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.85, 0.9, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    ld = bpy.data.lights.new("sun", "SUN")
    ld.energy = 4.5
    sun = bpy.data.objects.new("sun", ld)
    sc.collection.objects.link(sun)
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = Vector((-0.4, -0.7, 0.6)).normalized().to_track_quat("Z", "Y")
    ng = SL.toon_group()
    ng.nodes["global lit"].outputs[0].default_value = (1.12, 1.03, 0.9, 1)
    bpy.ops.mesh.primitive_plane_add(size=60)
    bpy.context.object.data.materials.append(SL.toon("ground", (0.66, 0.62, 0.54, 1), var=0.3))
    cd = bpy.data.cameras.new("cam")
    cd.type = "ORTHO"
    cam = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    groups = {"creatures_people": rigs[:4], "creatures_birds": rigs[4:]}
    for gname, group in groups.items():
        for r in rigs:
            r.root.location = (0, 0, -50)  # park everything, then line up this group
        x = 0.0
        top = max(r.root["sv_height"] for r in group)
        for r in group:
            w = max(0.3, r.root["sv_height"] * 0.75)
            r.root.location = (x + w / 2, 0, 0)
            r.root.rotation_euler = (0, 0, math.radians(180 + 32))  # three-quarter view, facing the camera
            x += w + 0.15
        cd.ortho_scale = max(x, top * 1.25 * 1600 / 700) * 1.05
        cam.location = (x / 2, -20, top * 0.55 + 20 * math.tan(math.radians(6)))
        cam.rotation_euler = (math.radians(84), 0, 0)
        sc.render.filepath = os.path.join(HERE, "renders", f"{gname}.png")
        bpy.ops.render.render(write_still=True)
        print("SHEET", sc.render.filepath)


rigs = build()
export(rigs)
if "--sheet" in argv:
    sheet(rigs)
