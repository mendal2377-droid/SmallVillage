"""Village layout traced from the satellite screenshot (`village photos/map.png`) and the plan sketch.

Coordinates here are MAP METRES: x east and y south from the top-left of the traced crop (crop origin =
screenshot pixel (380, 60); scale bar 86 px = 50 m, so 0.581 m per pixel). `to_world()` converts to
Blender metres (X east, Y north) so that the confirmed star position of the family house (map ~565, 400,
lower-right strip below the east-west pond line, just west of the east road) lands on the existing house
construction origin (-37, -109). The authoritative house and its walk data therefore keep their coordinates.

Everything is an estimate from a single satellite image: positions are good to a few metres, sizes of
individual plots and lane spacing are inferred. North is up in the screenshot.
"""

HOME_MAP = (565.0, 400.0)
HOME_WORLD = (-37.0, -109.0)


def to_world(p):
    return (p[0] - HOME_MAP[0] + HOME_WORLD[0], -(p[1] - HOME_MAP[1]) + HOME_WORLD[1])


# ---------------------------------------------------------------- roads (polyline points, width in m)

ROADS = {
    # the main east-west village road, rising slightly to the east, then continuing into the fields
    "main road": dict(width=4.5, pts=[(-250, 330), (60, 300), (174, 279), (349, 252), (523, 234), (585, 232), (700, 248), (1300, 252)]),
    # west perimeter road, north-south, continuing into the fields both ways
    "west road": dict(width=4.5, pts=[(40, -500), (44, 0), (52, 300), (58, 600), (66, 1100)]),
    # east perimeter road (photographed as the poplar avenue south of the village)
    "east road": dict(width=4.5, pts=[(562, -500), (567, 0), (570, 120), (585, 232), (598, 600), (610, 1100)]),
    # south field road along the canal (sketch: road and river along the bottom)
    "south road": dict(width=4.5, pts=[(-400, 652), (66, 650), (610, 654), (1300, 660)]),
    # village lanes (3 m) seen as light lines between the house rows
    "lane middle": dict(width=3.0, pts=[(170, 70), (170, 279)]),
    "lane xwz": dict(width=3.0, pts=[(178, 281), (180, 640)]),
    "lane 349": dict(width=3.0, pts=[(349, 128), (349, 252)]),
    "lane 442": dict(width=3.0, pts=[(442, 128), (442, 240)]),
    "lane 500": dict(width=3.0, pts=[(500, 110), (500, 236)]),
    "lane se north": dict(width=3.0, pts=[(452, 318), (598, 314)]),
    "lane se 465": dict(width=3.0, pts=[(465, 300), (465, 650)]),
    "lane se south": dict(width=3.0, pts=[(465, 460), (598, 458)]),
    "lane north edge": dict(width=3.0, pts=[(44, 62), (298, 62)]),
    "lane school": dict(width=3.0, pts=[(445, 128), (567, 120)]),
    # earth field tracks between the strips south of the village
    "track 305": dict(width=2.6, kind="field", pts=[(305, 380), (305, 650)]),
    "track 400": dict(width=2.6, kind="field", pts=[(400, 382), (400, 650)]),
}

# E-W lanes inside each housing region are generated every LANE_SPACING m (one row of courtyards each)
LANE_SPACING = 23.0

# ---------------------------------------------------------------- water

PONDS = {
    # large algae-green north pond with a darker deep west lobe
    "north pond": dict(algae=0.45, pts=[(298, 75), (320, 68), (340, 62), (380, 58), (420, 60), (440, 72), (445, 100), (432, 122), (400, 126),
                                         (370, 112), (340, 102), (318, 100), (300, 92)]),
    # dark west pond beside the main road
    "west pond": dict(algae=0.2, pts=[(100, 256), (130, 252), (165, 255), (167, 272), (160, 285), (125, 286), (101, 280)]),
    # elongated pond south of the centre: the "east-west stream" line of the sketch
    "south pond": dict(algae=0.4, pts=[(350, 362), (380, 357), (420, 356), (442, 362), (440, 374), (405, 378), (370, 377), (351, 371)]),
}

DITCHES = {
    # sketch: river running north-south through the centre (tree-lined channel beside the middle lane)
    "central ditch": dict(pts=[(162, 40), (162, 279), (170, 300), (172, 640)], water=True),
    # sketch: top channel feeding the north pond
    "north channel": dict(pts=[(162, 40), (298, 42), (310, 66)], water=True),
    # the stream line continuing east from the south pond to the east road, south of the home strip edge
    "south pond outflow": dict(pts=[(442, 368), (520, 372), (590, 376)], water=True),
    # roadside ditch on the east side of the east road (photo 04: water beside the avenue)
    "east road ditch": dict(pts=[(606, 300), (612, 600), (622, 1100)], water=True),
}

RIVERS = {
    # sketch: river along the bottom beside the south road
    "south canal": dict(pts=[(-400, 664), (1300, 672)]),
}

BRIDGES = [  # (map point, kind)
    ((170, 300), "culvert"), ((178, 650), "culvert"), ((612, 654), "culvert"), ((66, 662), "river"), ((610, 668), "river"),
]

# ---------------------------------------------------------------- built-up areas

SCHOOL = dict(center=(565, 68))  # 文化大院 compound = the school (owner confirmed)

HOUSING = {
    # region: (x0, y0, x1, y1) map rectangle; plots fill rows facing lanes to their south
    "north village": (52, 66, 560, 296),
    "north east": (592, 110, 645, 290),
    "xiaowangzhuang": (64, 300, 300, 600),  # 小王庄 in the south-west
    "south middle": (300, 262, 590, 352),
    "south east": (470, 384, 594, 505),  # the family house's strip
}

EXCLUDE = [  # map rectangles kept free of generated plots
    (520, 18, 625, 118),   # school compound
    (153, 30, 186, 650),   # central ditch, lane and its tree strip
    (288, 50, 452, 134),   # north pond and banks
    (92, 246, 175, 294),   # west pond
    (340, 350, 452, 386),  # south pond
]

# ---------------------------------------------------------------- vegetation

TREE_BELTS = [  # (map polyline, kind, rows)
    ([(-10, 140), (-10, 290)], "shelterbelt", 3),       # dense belt west of the village (satellite)
    ([(162, 60), (162, 640)], "poplar line", 1),          # trees along the central ditch
]
AVENUES = ["east road", "main road", "south road", "west road"]  # whitewashed poplars both sides outside the village

FIELD_EXTENT = (-900, -700, 1500, 1500)  # map rectangle filled with field strips
FIELD_STRIP = (36.0, 300.0)  # typical parcel width x length (N-S strips, satellite)
