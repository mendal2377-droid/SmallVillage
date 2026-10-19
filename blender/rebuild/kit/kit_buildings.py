"""SmallVillage kit batch 2: modular village buildings.

Every module is written into a `MeshWriter` in its own local frame (front facing -Y, ground at z=0), so
modules can be merged into one courtyard-plot mesh with a single palette material. Level of detail:
  LOD0  frames, mullions, couplets, railings, trims, downpipes
  LOD1  windows as single glass panes, solid parapets, no small fixtures
  LOD2  massing boxes and roofs only
Facade details follow the house and village photographs (white tile and grey render facades, burgundy
plinths, gold tile bands, glazed upper corridors, red gates with couplets, blue corrugated sheds).
"""
import math
import random

import bmesh
from mathutils import Matrix, Vector

import kit_lib as K
import style_lib as SL

FLOOR_H = 3.2


class MeshWriter:
    def __init__(self, lod=0):
        self.bm = bmesh.new()
        self.slots = []
        self.lod = lod
        self.stack = [Matrix.Identity(4)]

    # -- transforms
    def push(self, offset=(0, 0, 0), rot_z=0.0):
        self.stack.append(self.stack[-1] @ Matrix.Translation(Vector(offset)) @ Matrix.Rotation(rot_z, 4, "Z"))

    def pop(self):
        self.stack.pop()

    @property
    def M(self):
        return self.stack[-1]

    def _xf(self, verts):
        bmesh.ops.transform(self.bm, matrix=self.M, verts=verts)
        return verts

    def i(self, slot):
        if slot not in self.slots:
            self.slots.append(slot)
        return self.slots.index(slot)

    # -- primitives (local coordinates)
    def box(self, center, size, slot):
        return self._xf(SL.add_box(self.bm, center, size, mat_index=self.i(slot)))

    def cyl(self, p0, p1, r0, r1, slot, segs=6):
        return self._xf(SL.add_cyl(self.bm, p0, p1, r0, r1, segs=segs, mat_index=self.i(slot)))

    def poly(self, pts, slot):
        vs = [self.bm.verts.new(self.M @ Vector(p)) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = self.i(slot)
        return f

    def blob(self, center, radius, slot, rng, sub=1, squash=(1, 1, 1), jitter=0.1):
        return self._xf(SL.add_blob(self.bm, center, radius, rng, sub=sub, squash=squash, jitter=jitter, mat_index=self.i(slot)))

    def tag(self, verts, group):
        """Remember vertices for a named vertex group (e.g. 'wheels' so the web can spin them)."""
        if not hasattr(self, "groups"):
            self.groups = {}
        self.groups.setdefault(group, []).extend(verts)
        return verts

    def finish(self, name, coll, meta, smooth=False):
        names = list(getattr(self, "groups", {}))
        if names:
            dl = self.bm.verts.layers.deform.verify()
            for gi, g in enumerate(names):
                for v in self.groups[g]:
                    if v.is_valid:
                        v[dl][gi] = 1.0
        for f in self.bm.faces:
            f.smooth = smooth
        o = K.finish(name, self.bm, self.slots, coll, meta)
        for g in names:
            o.vertex_groups.new(name=g)
        for p in o.data.polygons:
            p.use_smooth = smooth
        return o


# ---------------------------------------------------------------- facade pieces
# A wall face is described by an origin on the wall surface, its outward normal (axis aligned) and the
# horizontal axis along the wall.


def _face(normal):
    n = Vector(normal)
    along = Vector((-n.y, n.x, 0)) if abs(n.z) < 0.5 else Vector((1, 0, 0))
    return n, along


def _slab(m, center, normal, w, h, depth, slot):
    n, a = _face(normal)
    size = (abs(a.x) * w + abs(n.x) * depth, abs(a.y) * w + abs(n.y) * depth, h)
    m.box(Vector(center) + n * depth / 2, size, slot)


def window(m, center, normal, w=1.5, h=1.4, frame="frame_dark", glass="glass", grille=False, mullions=1):
    n, a = _face(normal)
    c = Vector(center)
    if m.lod >= 2:
        return
    if m.lod == 1:
        _slab(m, c, n, w, h, 0.03, glass)
        return
    _slab(m, c, n, w + 0.12, h + 0.12, 0.04, frame)
    _slab(m, c + n * 0.01, n, w - 0.04, h - 0.04, 0.04, glass)
    for k in range(1, mullions + 1):
        _slab(m, c + a * (w * (k / (mullions + 1) - 0.5)) + n * 0.02, n, 0.05, h, 0.04, frame)
    _slab(m, c + Vector((0, 0, h * 0.18)) + n * 0.02, n, w, 0.05, 0.04, frame)
    _slab(m, c - Vector((0, 0, h / 2 + 0.08)) + n * 0.02, n, w + 0.3, 0.08, 0.12, "plaster_white")  # sill
    if grille:
        for k in range(5):
            _slab(m, c + a * (w * (k / 4 - 0.5) * 0.9) + n * 0.06, n, 0.025, h, 0.025, "rail_steel")


def door(m, center_bottom, normal, w=1.2, h=2.2, slot="door_maroon", couplets=True, screen=False, fu=True):
    """Door leaf (or teal door-screen curtain) with the spring-festival couplets and a 福 square."""
    n, a = _face(normal)
    c = Vector(center_bottom) + Vector((0, 0, h / 2))
    if m.lod >= 2:
        return
    _slab(m, c, n, w + 0.16, h + 0.1, 0.03, "frame_dark" if m.lod == 0 else slot)
    _slab(m, c + n * 0.01, n, w, h, 0.04, "screen_teal" if screen else slot)
    if m.lod == 0:
        if not screen:
            _slab(m, c + n * 0.03, n, 0.03, h, 0.03, "frame_dark")  # split between the two leaves
        # transom
        _slab(m, c + Vector((0, 0, h / 2 + 0.3)), n, w + 0.16, 0.5, 0.03, "frame_dark")
        _slab(m, c + Vector((0, 0, h / 2 + 0.3)) + n * 0.01, n, w - 0.1, 0.36, 0.03, "glass")
        if couplets:
            for s in (-1, 1):
                _slab(m, c + a * s * (w / 2 + 0.22) + Vector((0, 0, 0.05)), n, 0.24, h * 0.88, 0.02, "couplet")
            _slab(m, c + Vector((0, 0, h / 2 + 0.66)), n, w + 0.3, 0.22, 0.02, "couplet")
        if fu and not screen:
            for s in (-1, 1):
                _slab(m, c + a * s * w * 0.25 + Vector((0, 0, 0.25)) + n * 0.04, n, 0.24, 0.24, 0.01, "couplet")


def downpipe(m, base, normal, h):
    if m.lod > 0:
        return
    n, a = _face(normal)
    m.cyl(Vector(base) + n * 0.08, Vector(base) + n * 0.08 + Vector((0, 0, h)), 0.05, 0.05, "pipe_white", segs=6)


def ac_unit(m, base, normal):
    if m.lod > 0:
        return
    n, a = _face(normal)
    c = Vector(base) + n * 0.2
    size = (abs(a.x) * 0.8 + abs(n.x) * 0.3, abs(a.y) * 0.8 + abs(n.y) * 0.3, 0.55)
    m.box(c, size, "ac_white")
    _slab(m, c + n * 0.15, n, 0.42, 0.42, 0.01, "frame_bronze")


# ---------------------------------------------------------------- house blocks

FACADES = {
    # name: (wall slot, side wall slot, plinth slot, has gold trims)
    "white_tile": ("tile_white", "render_grey", "plinth", True),
    "white": ("plaster_white", "render_grey", "plinth", False),
    "grey": ("render_grey", "render_grey", "render_streak", False),
    "cream": ("plaster_cream", "render_grey", "plinth", False),
    "pink": ("plaster_pink", "plaster_pink", "render_streak", False),
    "brick": ("brick_red", "brick_red", "plaster_white", False),
    "old_brick": ("brick_old", "brick_old", "plaster_white", False),
}


def house_block(m, w, d, floors, facade="white", roof="flat", glazed=False, railing=True, rng=None, front_door=True,
                screen_door=False, windows_back=True, ac=True):
    """Main house box, front facing -Y at y=0, x from 0..w, depth d. Returns roof height."""
    rng = rng or random.Random(0)
    wall, side, plinth, trims = FACADES[facade]
    H = floors * FLOOR_H
    m.box((w / 2, d / 2, H / 2), (w, d, H), wall)
    if m.lod <= 1:
        # unfinished grey render on the gable ends (very common in the photographs)
        if side != wall:
            for x in (-0.02, w + 0.02):
                m.box((x, d / 2, H / 2 + 0.1), (0.04, d - 0.06, H + 0.2), side)
            if m.lod == 0 and side == "render_grey":
                for x in (-0.05, w + 0.05):
                    m.box((x, d / 2, H - 0.45), (0.02, d - 0.1, 0.7), "render_streak")
        # plinth / whitewashed band
        ph = 1.0 if facade in ("brick", "old_brick") else 0.85
        m.box((w / 2, -0.03, ph / 2), (w + 0.04, 0.06, ph), plinth)
    # front: doors and windows per floor
    bays = max(2, int(round(w / 3.2)))
    bw = w / bays
    for f in range(floors):
        z0 = f * FLOOR_H
        if f >= 1 and glazed:
            # glazed upper corridor: continuous window band over a white tile parapet with gold lines
            if m.lod <= 1:
                m.box((w / 2, -0.06, z0 + 0.55), (w + 0.02, 0.12, 1.1), "tile_white")
                if m.lod == 0:
                    for k in range(1, 6):
                        m.box((w / 2, -0.125, z0 + k * 0.19), (w, 0.01, 0.015), "tile_joint")
                    m.box((w / 2, -0.13, z0 + 1.12), (w + 0.04, 0.03, 0.08), "trim_gold")
            nwin = max(3, int(w / 0.95))
            if m.lod == 0:
                _slab(m, (w / 2, 0, z0 + 1.95), (0, -1, 0), w - 0.1, 1.6, 0.05, "frame_bronze")
                _slab(m, (w / 2, -0.01, z0 + 1.95), (0, -1, 0), w - 0.2, 1.5, 0.05, "glass_light")
                for k in range(1, nwin):
                    _slab(m, (k * w / nwin, -0.02, z0 + 1.95), (0, -1, 0), 0.05, 1.6, 0.05, "frame_bronze")
                _slab(m, (w / 2, -0.02, z0 + 2.35), (0, -1, 0), w - 0.1, 0.04, 0.05, "frame_bronze")
            elif m.lod == 1:
                _slab(m, (w / 2, 0, z0 + 1.95), (0, -1, 0), w - 0.1, 1.6, 0.04, "glass_light")
            continue
        for b in range(bays):
            x = (b + 0.5) * bw
            if f == 0 and front_door and b == bays // 2:
                door(m, (x, 0, 0.12), (0, -1, 0), w=1.25, screen=screen_door)
                continue
            window(m, (x, 0, z0 + 1.65), (0, -1, 0), w=min(1.6, bw - 0.6), h=1.4,
                   frame="frame_bronze" if facade == "white_tile" else "frame_dark", grille=(f == 0 and facade in ("brick", "old_brick")))
    if windows_back and m.lod == 0:
        for f in range(floors):
            window(m, (w * 0.3, d, f * FLOOR_H + 1.8), (0, 1, 0), w=1.0, h=1.0)
    # trims under the eave
    if trims and m.lod <= 1:
        for k, (slot, dz) in enumerate((("trim_gold", 0.0), ("trim_ochre", -0.14), ("plinth", -0.26))):
            if m.lod == 1 and k:
                break
            m.box((w / 2, -0.07, H - 0.18 + dz), (w + 0.1, 0.1, 0.1), slot)
    # roof
    if roof == "flat":
        m.box((w / 2, d / 2, H + 0.05), (w + 0.2, d + 0.2, 0.12), "roof_concrete")
        if m.lod <= 1:
            for (cx, cy, sx, sy) in ((w / 2, -0.05, w + 0.2, 0.2), (w / 2, d + 0.05, w + 0.2, 0.2), (-0.05, d / 2, 0.2, d), (w + 0.05, d / 2, 0.2, d)):
                m.box((cx, cy, H + 0.35), (sx, sy, 0.6), "render_grey" if facade != "white_tile" else "tile_white")
            if railing:
                if m.lod == 0:
                    n = int(w / 0.55)
                    for k in range(n + 1):
                        m.box((k * w / n, -0.05, H + 0.95), (0.04, 0.04, 0.7), "rail_steel")
                    m.box((w / 2, -0.05, H + 1.3), (w, 0.06, 0.06), "rail_steel")
                    m.box((w / 2, -0.05, H + 0.75), (w, 0.03, 0.03), "rail_steel")
                else:
                    m.box((w / 2, -0.05, H + 1.0), (w, 0.04, 0.6), "rail_steel")
        top = H + 0.65
    else:
        top = pitched_roof(m, w, d, H, slot_a="roof_tile" if roof == "tile" else "roof_grey",
                           slot_b="roof_tile_d" if roof == "tile" else "roof_concrete", gable=wall)
    if m.lod == 0:
        downpipe(m, (w - 0.3, 0, 0), (0, -1, 0), H)
        if ac and floors >= 2:
            ac_unit(m, (0.9, 0, FLOOR_H + 0.4), (0, -1, 0))
    return top


def pitched_roof(m, w, d, H, slot_a="roof_tile", slot_b="roof_tile_d", gable="brick_red", ov=0.45):
    """Gable roof along X with alternating tile courses, ridge cap and painted gable triangles."""
    rh = d * 0.3
    courses = {0: 7, 1: 3, 2: 1}[m.lod]
    for side in (-1, 1):
        y_e = (-ov) if side < 0 else (d + ov)
        for k in range(courses):
            t0, t1 = k / courses, (k + 1) / courses
            y0 = y_e + (d / 2 - y_e) * t0
            y1 = y_e + (d / 2 - y_e) * t1
            z0 = H - 0.12 + (rh + 0.12) * t0
            z1 = H - 0.12 + (rh + 0.12) * t1
            pts = [(-ov, y0, z0), (w + ov, y0, z0), (w + ov, y1, z1), (-ov, y1, z1)]
            if side > 0:
                pts = pts[::-1]
            m.poly(pts, slot_a if k % 2 == 0 else slot_b)
        # underside so the roof reads solid from below
        m.poly([(-ov, y_e, H - 0.14), (-ov, d / 2, H + rh - 0.02), (w + ov, d / 2, H + rh - 0.02), (w + ov, y_e, H - 0.14)][::(1 if side < 0 else -1)], slot_b)
    if m.lod <= 1:
        m.box((w / 2, d / 2, H + rh + 0.05), (w + 2 * ov + 0.1, 0.3, 0.16), slot_b)
    for x, flip in ((0.0, True), (w, False)):
        pts = [(x, 0, H), (x, d, H), (x, d / 2, H + rh - 0.05)]
        m.poly(pts[::-1] if flip else pts, gable)
    return H + rh


def wing(m, length, depth=4.2, facade="white", roof="flat", rng=None):
    """Single-storey side wing (kitchen / storage) facing -Y."""
    rng = rng or random.Random(1)
    wall, side, plinth, trims = FACADES[facade]
    H = 3.0
    m.box((length / 2, depth / 2, H / 2), (length, depth, H), wall)
    if m.lod <= 1:
        m.box((length / 2, -0.03, 0.42), (length + 0.04, 0.06, 0.85), plinth)
    nb = max(1, int(length / 3.4))
    for b in range(nb):
        x = (b + 0.5) * length / nb
        if b == 0:
            door(m, (x, 0, 0.1), (0, -1, 0), w=1.0, h=2.1, screen=True, couplets=m.lod == 0)
        else:
            window(m, (x, 0, 1.6), (0, -1, 0), w=1.2, h=1.2)
    if roof == "flat":
        m.box((length / 2, depth / 2, H + 0.06), (length + 0.3, depth + 0.3, 0.14), "roof_concrete")
        if m.lod <= 1:
            # the tiled coping band seen on the house's side wing
            m.box((length / 2, -0.12, H + 0.1), (length + 0.34, 0.12, 0.22), "tile_white")
            if m.lod == 0:
                m.box((length / 2, -0.19, H + 0.1), (length + 0.34, 0.02, 0.08), "trim_gold")
    else:
        pitched_roof(m, length, depth, H, gable=wall)


def shed(m, w=4.0, d=3.2, h=2.6):
    """Blue corrugated-steel lean-to, open on the front."""
    stripes = {0: int(w / 0.25), 1: 4, 2: 1}[m.lod]
    for k in range(stripes):
        x0 = k * w / stripes
        slot = "shed_blue" if k % 2 == 0 else "shed_blue_d"
        m.box((x0 + w / stripes / 2, d, h / 2), (w / stripes, 0.04, h), slot)
    for x in (0.0, w):
        m.box((x, d / 2, h / 2), (0.04, d, h), "shed_blue")
    # sloped roof falling to the front, ribbed
    rs = {0: int(w / 0.3), 1: 3, 2: 1}[m.lod]
    for k in range(rs):
        x0, x1 = k * w / rs - 0.1, (k + 1) * w / rs + 0.1
        m.poly([(x0, -0.3, h - 0.25), (x1, -0.3, h - 0.25), (x1, d + 0.1, h + 0.25), (x0, d + 0.1, h + 0.25)],
               "shed_blue" if k % 2 == 0 else "shed_blue_d")
    if m.lod == 0:
        m.cyl((w * 0.75, -0.25, 0), (w * 0.75, -0.25, h - 0.25), 0.04, 0.04, "frame_dark", segs=5)


def wall_run(m, length, h=2.4, material="brick", coping=True):
    slot = {"brick": "brick_red", "plaster": "plaster_white", "grey": "render_grey", "old": "brick_old"}[material]
    m.box((length / 2, 0, h / 2), (length, 0.24, h), slot)
    if coping and m.lod <= 1:
        m.box((length / 2, 0, h + 0.06), (length + 0.04, 0.34, 0.12), "roof_tile_d" if material in ("brick", "old") else "render_grey")
    if material == "plaster" and m.lod <= 1:
        m.box((length / 2, -0.13, 0.4), (length, 0.02, 0.8), "plinth")


def gate(m, w=3.2, h=2.6, style="tiled"):
    """Red double gate with pillars, sign board, couplets and a small tiled cap (front faces -Y)."""
    pw = 0.6
    for x in (-pw / 2, w + pw / 2):
        m.box((x, 0, (h + 0.6) / 2), (pw, 0.6, h + 0.6), "tile_white" if style == "tiled" else "brick_red")
        if m.lod <= 1:
            m.box((x, -0.04, 0.45), (pw + 0.04, 0.58, 0.9), "plinth")
    m.box((w / 2, 0, h + 0.35), (w + 2 * pw, 0.6, 0.7), "tile_white" if style == "tiled" else "brick_red")
    if m.lod <= 1:
        _slab(m, (w / 2, -0.3, h + 0.35), (0, -1, 0), w * 0.8, 0.46, 0.03, "sign_red")
        if m.lod == 0:
            _slab(m, (w / 2, -0.31, h + 0.35), (0, -1, 0), w * 0.74, 0.36, 0.02, "trim_gold")
            _slab(m, (w / 2, -0.32, h + 0.35), (0, -1, 0), w * 0.7, 0.3, 0.02, "sign_red")
        # tiled cap
        cap_w = w + 2 * pw + 0.5
        for side in (-1, 1):
            y0, y1 = side * 0.6, 0
            pts = [(-pw - 0.25, y0, h + 0.7), (w + pw + 0.25, y0, h + 0.7), (w + pw + 0.25, y1, h + 1.05), (-pw - 0.25, y1, h + 1.05)]
            m.poly(pts if side < 0 else pts[::-1], "roof_tile")
    # the two red leaves (one open a little in the photos; kept closed in the kit)
    _slab(m, (w / 2, -0.25, h / 2), (0, -1, 0), w, h, 0.06, "door_red")
    if m.lod == 0:
        _slab(m, (w / 2, -0.32, h / 2), (0, -1, 0), 0.04, h, 0.02, "frame_dark")
        for s in (-1, 1):
            for r in range(3):
                for c in range(3):
                    _slab(m, (w / 2 + s * (0.35 + c * 0.35), -0.32, h * (0.35 + r * 0.2)), (0, -1, 0), 0.06, 0.06, 0.03, "fu_gold")
            _slab(m, (w / 2 + s * (w / 2 + pw / 2), -0.31, h * 0.5), (0, -1, 0), 0.3, h * 0.85, 0.02, "couplet")
            _slab(m, (w / 2 + s * w * 0.25, -0.33, h * 0.75), (0, -1, 0), 0.5, 0.7, 0.01, "couplet")


# ---------------------------------------------------------------- courtyard plots

PLOTS = {
    # variant: main house, wing, shed, walls, gate style, width, depth
    "home_like": dict(main=("white_tile", 2, "flat", True), wing=("white", "flat"), shed=True, walls="plaster", gate="tiled", W=13.5, D=19),
    "grey_two": dict(main=("grey", 2, "flat", False), wing=("grey", "flat"), shed=False, walls="grey", gate="tiled", W=12, D=18),
    "white_three": dict(main=("white", 3, "flat", False), wing=None, shed=True, walls="brick", gate="brick", W=12.5, D=17),
    "old_brick": dict(main=("old_brick", 1, "tile", False), wing=("old_brick", "tile"), shed=False, walls="old", gate="brick", W=12, D=18),
    "pink_pitched": dict(main=("pink", 1, "tile", False), wing=("white", "flat"), shed=True, walls="plaster", gate="tiled", W=11.5, D=17),
    "cream_two": dict(main=("cream", 2, "flat", False), wing=("white", "flat"), shed=False, walls="brick", gate="tiled", W=13, D=19),
    "brick_two": dict(main=("brick", 2, "flat", False), wing=None, shed=True, walls="brick", gate="brick", W=11, D=17),
    "grey_pitched": dict(main=("grey", 1, "grey", False), wing=("grey", "flat"), shed=False, walls="grey", gate="brick", W=11, D=16),
}


def courtyard_plot(coll, variant, lod=0):
    """One walled courtyard household. Local frame: lane side at y=0 (gate), main house at the back facing the
    courtyard (-Y), side wing along the east wall facing west, shed against the west wall."""
    P = PLOTS[variant]
    rng = random.Random(sum(map(ord, variant)))
    m = MeshWriter(lod)
    W, D = P["W"], P["D"]
    facade, floors, roof, glazed = P["main"]
    hd = 8.0  # main house depth
    # courtyard floor
    m.box((W / 2, (D - hd) / 2, 0.05), (W - 0.3, D - hd - 0.3, 0.1), "concrete")
    # main house at the back
    m.push((0.3, D - hd, 0))
    house_block(m, W - 0.6, hd, floors, facade, roof="flat" if roof == "flat" else roof, glazed=glazed,
                railing=rng.random() < 0.7, rng=rng, screen_door=rng.random() < 0.5)
    m.pop()
    # side wing on the east side facing west into the courtyard
    if P["wing"]:
        wf, wr = P["wing"]
        wl = min(7.5, D - hd - 3.5)
        # rotate -90 deg: local +x runs toward the lane, the wing front (local -Y) faces west into the yard
        m.push((W - 0.2 - 3.8, D - hd - 0.3, 0), -math.pi / 2)
        wing(m, wl, depth=3.8, facade=wf, roof=wr, rng=rng)
        m.pop()
    # shed against the west wall, opening east
    if P["shed"]:
        # rotate +90 deg: the open front faces east, back wall against the west boundary wall
        m.push((0.25 + 3.0, 2.5, 0), math.pi / 2)
        shed(m, w=4.0, d=3.0)
        m.pop()
    # boundary walls: front (with gate), west, east
    gw = 3.2
    gx = W * 0.3 if P["wing"] else W * 0.5
    m.push((0, 0, 0))
    wall_run_at(m, (0, 0), (gx - gw / 2 - 0.6, 0), P["walls"])
    wall_run_at(m, (gx + gw / 2 + 0.6, 0), (W, 0), P["walls"])
    wall_run_at(m, (0, 0), (0, D - hd), P["walls"])
    wall_run_at(m, (W, 0), (W, D - hd), P["walls"])
    m.pop()
    m.push((gx - gw / 2, 0, 0))
    gate(m, w=gw, style=P["gate"])
    m.pop()
    meta = {"sv_kind": "building", "sv_family": "courtyard plot", "sv_variant": variant, "sv_state": "standing", "sv_lod": lod,
            "sv_footprint": f"{W},{D}"}
    return m.finish(f"KIT plot {variant} L{lod}", coll, meta)


def wall_run_at(m, p0, p1, material):
    p0, p1 = Vector((*p0, 0)), Vector((*p1, 0))
    d = p1 - p0
    if d.length < 0.2:
        return
    m.push(p0, math.atan2(d.y, d.x))
    m.push((0, 0, 0))
    wall_run(m, d.length, material=material)
    m.pop()
    m.pop()


# ---------------------------------------------------------------- school (the 文化大院 compound)


def school(coll, lod=0):
    """Two-storey village primary school with a forecourt, flag pole and gate (generic details: estimated)."""
    m = MeshWriter(lod)
    W, D = 34.0, 9.0
    m.push((0, 14, 0))
    H = 2 * FLOOR_H
    m.box((W / 2, D / 2, H / 2), (W, D, H), "school_cream")
    if lod <= 1:
        m.box((W / 2, -0.03, 0.45), (W + 0.04, 0.06, 0.9), "plinth")
        m.box((W / 2, -0.4, FLOOR_H + 0.1), (W, 0.8, 0.18), "plaster_white")  # corridor slab line
        m.box((W / 2, D / 2, H + 0.4), (W + 0.3, D + 0.3, 0.8), "plaster_white")
        m.box((W / 2, -0.2, H + 1.2), (6.0, 0.3, 1.2), "plaster_white")  # name board
        if lod == 0:
            _slab(m, (W / 2, -0.35, H + 1.2), (0, -1, 0), 5.2, 0.8, 0.02, "sign_red")
    for f in range(2):
        for b in range(10):
            x = (b + 0.5) * W / 10
            if f == 0 and b in (4, 5):
                continue
            window(m, (x, 0, f * FLOOR_H + 1.7), (0, -1, 0), w=1.8, h=1.5, frame="plaster_white", glass="glass", mullions=2)
    door(m, (W / 2, 0, 0.1), (0, -1, 0), w=2.4, h=2.4, slot="door_red", couplets=False, fu=False)
    m.box((W / 2, D / 2, H + 0.05), (W + 0.4, D + 0.4, 0.1), "roof_concrete")
    m.pop()
    # forecourt, flag pole, boundary wall and gate
    m.box((W / 2, 7, 0.04), (W + 4, 14, 0.08), "concrete")
    m.cyl((W / 2, 6, 0), (W / 2, 6, 10), 0.06, 0.04, "rail_steel", segs=6 if lod == 0 else 4)
    if lod <= 1:
        m.box((W / 2, 6, 0.3), (2.0, 2.0, 0.6), "plaster_white")
        m.box((W / 2 + 0.8, 6, 9.3), (1.4, 0.02, 0.9), "flag_red")
    wall_run_at(m, (-2, 0), (W / 2 - 3, 0), "plaster")
    wall_run_at(m, (W / 2 + 3, 0), (W + 2, 0), "plaster")
    wall_run_at(m, (-2, 0), (-2, 24), "plaster")
    wall_run_at(m, (W + 2, 0), (W + 2, 24), "plaster")
    for x in (W / 2 - 3, W / 2 + 3):
        m.box((x, 0, 1.6), (0.7, 0.7, 3.2), "tile_white")
    return m.finish(f"KIT school L{lod}", coll, {"sv_kind": "building", "sv_family": "school", "sv_state": "standing", "sv_lod": lod,
                                                 "sv_footprint": f"{W + 4},{24}"})


# ---------------------------------------------------------------- standalone modules for lanes and irregular plots


def module(coll, name, fn, lod=0, **kw):
    m = MeshWriter(lod)
    fn(m, **kw)
    return m.finish(f"KIT {name} L{lod}", coll, {"sv_kind": "building", "sv_family": name, "sv_state": "module", "sv_lod": lod})
