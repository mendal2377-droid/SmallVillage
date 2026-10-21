"""SmallVillage kit palette: slot name -> linear RGB, per season.

Single source of truth for the Blender kit and the future web exporter. The palette is a 16x16 grid
(256 slots max); each kit face is UV-mapped to the centre of its slot's cell. Seasonal slots give a
dict per season; constant slots give one colour.
"""

SEASONS = ("spring", "summer", "autumn", "winter")
GRID = 16

_S = {  # name: constant colour or {season: colour}
    # bark and trunks
    "bark": (0.30, 0.29, 0.24),
    "bark_dark": (0.16, 0.13, 0.11),
    "whitewash": (0.86, 0.86, 0.82),
    "nest": (0.20, 0.14, 0.09),
    # tree foliage (seasonal)
    "leaf_l": {"spring": (0.40, 0.58, 0.16), "summer": (0.24, 0.42, 0.12), "autumn": (0.74, 0.55, 0.12), "winter": (0.55, 0.42, 0.14)},
    "leaf_d": {"spring": (0.17, 0.36, 0.12), "summer": (0.10, 0.24, 0.09), "autumn": (0.48, 0.30, 0.08), "winter": (0.36, 0.24, 0.08)},
    "willow_l": {"spring": (0.52, 0.68, 0.18), "summer": (0.30, 0.48, 0.14), "autumn": (0.62, 0.58, 0.20), "winter": (0.50, 0.48, 0.20)},
    "willow_d": {"spring": (0.28, 0.46, 0.12), "summer": (0.14, 0.30, 0.10), "autumn": (0.40, 0.40, 0.12), "winter": (0.32, 0.32, 0.12)},
    "broad_l": {"spring": (0.36, 0.56, 0.16), "summer": (0.20, 0.40, 0.10), "autumn": (0.66, 0.42, 0.10), "winter": (0.50, 0.34, 0.10)},
    "broad_d": {"spring": (0.15, 0.34, 0.10), "summer": (0.08, 0.22, 0.07), "autumn": (0.42, 0.20, 0.06), "winter": (0.30, 0.18, 0.06)},
    "conifer_l": (0.14, 0.32, 0.14),
    "conifer_d": (0.06, 0.18, 0.08),
    "hedge_l": (0.22, 0.38, 0.12),
    "hedge_d": (0.10, 0.22, 0.08),
    "hedge_tip": {"spring": (0.62, 0.10, 0.06), "summer": (0.30, 0.30, 0.10), "autumn": (0.50, 0.12, 0.06), "winter": (0.40, 0.10, 0.06)},
    # grass and wild plants (seasonal)
    "grass": {"spring": (0.24, 0.48, 0.10), "summer": (0.20, 0.42, 0.09), "autumn": (0.46, 0.42, 0.18), "winter": (0.40, 0.36, 0.22)},
    "grass_d": {"spring": (0.14, 0.32, 0.07), "summer": (0.11, 0.27, 0.06), "autumn": (0.32, 0.28, 0.12), "winter": (0.28, 0.24, 0.15)},
    "reed": {"spring": (0.34, 0.52, 0.14), "summer": (0.28, 0.44, 0.12), "autumn": (0.58, 0.48, 0.22), "winter": (0.52, 0.44, 0.28)},
    "reed_head": (0.30, 0.18, 0.09),
    "stem": (0.15, 0.32, 0.08),
    "flower_white": (0.90, 0.90, 0.85),
    "flower_yellow": (0.95, 0.70, 0.08),
    "flower_purple": (0.50, 0.25, 0.70),
    "flower_pink": (0.90, 0.38, 0.55),
    "flower_blue": (0.25, 0.32, 0.85),
    "flower_center": (0.95, 0.62, 0.05),
    # crops (stage colours, season independent)
    "wheat_seedling": (0.24, 0.48, 0.10),
    "wheat_winter": (0.15, 0.32, 0.10),
    "wheat_green": (0.20, 0.42, 0.10),
    "wheat_heading": (0.38, 0.52, 0.14),
    "wheat_ripe": (0.72, 0.50, 0.16),
    "wheat_ear": (0.82, 0.58, 0.18),
    "stubble": (0.62, 0.50, 0.30),
    "maize_green": (0.16, 0.38, 0.08),
    "maize_dark": (0.10, 0.26, 0.06),
    "tassel": (0.70, 0.58, 0.30),
    "maize_dry": (0.58, 0.44, 0.24),
    "maize_dry_d": (0.42, 0.30, 0.16),
    "cob": (0.88, 0.64, 0.12),
    "husk": (0.50, 0.55, 0.20),
    "garlic": (0.40, 0.58, 0.30),
    "bean": (0.22, 0.44, 0.12),
    "soil": (0.36, 0.25, 0.15),
    "soil_dark": (0.24, 0.17, 0.10),
    "snow": (0.92, 0.94, 0.97),
    # buildings (from the house and village photographs)
    "plaster_white": (0.80, 0.79, 0.74),
    "tile_white": (0.84, 0.85, 0.82),
    "tile_joint": (0.62, 0.64, 0.62),
    "render_grey": (0.50, 0.51, 0.48),
    "render_streak": (0.32, 0.33, 0.31),
    "plaster_pink": (0.74, 0.56, 0.50),
    "plaster_cream": (0.80, 0.71, 0.56),
    "brick_red": (0.44, 0.17, 0.10),
    "brick_old": (0.36, 0.20, 0.14),
    "plinth": (0.30, 0.03, 0.04),
    "trim_gold": (0.72, 0.46, 0.14),
    "trim_ochre": (0.46, 0.20, 0.06),
    "glass": (0.20, 0.32, 0.36),
    "glass_light": (0.44, 0.60, 0.62),
    "frame_dark": (0.05, 0.06, 0.07),
    "frame_bronze": (0.44, 0.40, 0.32),
    "door_maroon": (0.28, 0.04, 0.05),
    "door_red": (0.55, 0.06, 0.06),
    "screen_teal": (0.06, 0.30, 0.30),
    "couplet": (0.80, 0.08, 0.06),
    "fu_gold": (0.92, 0.66, 0.16),
    "roof_tile": (0.42, 0.15, 0.08),
    "roof_tile_d": (0.30, 0.10, 0.06),
    "roof_grey": (0.30, 0.31, 0.32),
    "roof_concrete": (0.46, 0.46, 0.43),
    "rail_steel": (0.70, 0.72, 0.72),
    "shed_blue": (0.03, 0.30, 0.66),
    "shed_blue_d": (0.02, 0.20, 0.48),
    "concrete": (0.56, 0.54, 0.49),
    "concrete_wet": (0.36, 0.37, 0.34),
    "ac_white": (0.88, 0.88, 0.86),
    "pipe_white": (0.86, 0.86, 0.84),
    "school_cream": (0.86, 0.76, 0.56),
    "flag_red": (0.85, 0.06, 0.05),
    "sign_red": (0.62, 0.05, 0.05),
    # infrastructure (roads, water, utilities)
    "concrete_joint": (0.34, 0.33, 0.30),
    "dirt": (0.48, 0.36, 0.22),
    "dirt_dark": (0.36, 0.26, 0.16),
    "paving_brick": (0.40, 0.24, 0.16),
    "paving_brick_d": (0.28, 0.17, 0.11),
    "moss": (0.22, 0.34, 0.12),
    "water": (0.10, 0.22, 0.22),
    "water_light": (0.30, 0.46, 0.46),
    "balustrade": (0.80, 0.80, 0.76),
    "pole": (0.58, 0.57, 0.53),
    "insulator": (0.86, 0.86, 0.83),
    "steel_dark": (0.12, 0.13, 0.14),
    "solar": (0.05, 0.10, 0.24),
    "lamp": (0.95, 0.92, 0.80),
    "transformer": (0.46, 0.50, 0.50),
    # props and vehicles
    "plastic_red": (0.70, 0.04, 0.05),
    "plastic_green": (0.28, 0.62, 0.40),
    "plastic_pink": (0.92, 0.42, 0.52),
    "plastic_blue": (0.10, 0.30, 0.70),
    "plastic_orange": (0.92, 0.36, 0.06),
    "cloth_cream": (0.92, 0.88, 0.78),
    "cloth_blue": (0.20, 0.34, 0.62),
    "cloth_check": (0.85, 0.85, 0.88),
    "umbrella_navy": (0.06, 0.12, 0.38),
    "wood": (0.50, 0.32, 0.16),
    "wood_d": (0.30, 0.18, 0.09),
    "bamboo": (0.66, 0.54, 0.26),
    "straw": (0.78, 0.62, 0.30),
    "straw_d": (0.56, 0.42, 0.18),
    "urn": (0.34, 0.18, 0.10),
    "pot_clay": (0.55, 0.26, 0.14),
    "bin_green": (0.10, 0.40, 0.20),
    "tyre": (0.05, 0.05, 0.05),
    "hub": (0.62, 0.64, 0.64),
    "canopy_green": (0.12, 0.40, 0.22),
    "trike_teal": (0.10, 0.36, 0.38),
    "scooter_green": (0.30, 0.66, 0.50),
    "seat_black": (0.08, 0.07, 0.07),
    "combine_red": (0.62, 0.06, 0.04),
    "combine_yellow": (0.92, 0.70, 0.10),
    "tractor_red": (0.70, 0.08, 0.05),
    "tractor_blue": (0.10, 0.26, 0.56),
    "engine_grey": (0.30, 0.31, 0.32),
    # sky set (clouds, horizon strips)
    "cloud": (0.98, 0.97, 0.94),
    "cloud_base": (0.80, 0.82, 0.90),
    "cloud_storm": (0.42, 0.45, 0.52),
    "far_house": (0.78, 0.78, 0.76),
    "far_house_d": (0.56, 0.57, 0.58),
    "far_roof": (0.50, 0.30, 0.24),
    # creatures (batch 5): the village child, the dog and the animals
    "skin": (0.86, 0.64, 0.50),
    "cheek": (0.92, 0.48, 0.44),
    "hair": (0.05, 0.04, 0.04),
    "eye": (0.03, 0.02, 0.02),
    "child_top": {"spring": (0.90, 0.88, 0.80), "summer": (0.92, 0.92, 0.88), "autumn": (0.62, 0.20, 0.16), "winter": (0.72, 0.10, 0.12)},
    "child_stripe": {"spring": (0.36, 0.52, 0.80), "summer": (0.85, 0.30, 0.30), "autumn": (0.88, 0.72, 0.36), "winter": (0.95, 0.85, 0.70)},
    "child_bottom": {"spring": (0.20, 0.30, 0.50), "summer": (0.30, 0.42, 0.62), "autumn": (0.22, 0.24, 0.30), "winter": (0.16, 0.16, 0.22)},
    "shoe": (0.12, 0.10, 0.10),
    "shoe_sole": (0.86, 0.84, 0.80),
    "dog_fur": (0.72, 0.46, 0.20),
    "dog_light": (0.94, 0.86, 0.70),
    "nose": (0.06, 0.05, 0.05),
    "tongue": (0.88, 0.38, 0.42),
    "hen_brown": (0.56, 0.30, 0.12),
    "hen_white": (0.94, 0.92, 0.86),
    "comb": (0.86, 0.10, 0.08),
    "beak": (0.96, 0.66, 0.10),
    "goose_beak": (0.96, 0.46, 0.08),
    "magpie_black": (0.05, 0.06, 0.08),
    "magpie_blue": (0.10, 0.20, 0.42),
    "sparrow": (0.48, 0.32, 0.18),
    "sparrow_light": (0.80, 0.72, 0.58),
    "cat_orange": (0.86, 0.50, 0.18),
    "cat_white": (0.95, 0.93, 0.88),
    "goat_white": (0.92, 0.90, 0.84),
    "horn": (0.58, 0.52, 0.40),
}

SLOTS = list(_S.keys())
assert len(SLOTS) <= GRID * GRID, "palette full"


def color(slot, season):
    v = _S[slot]
    return v[season] if isinstance(v, dict) else v


def is_seasonal(slot):
    return isinstance(_S[slot], dict)


def uv(slot):
    """Centre of the slot's cell; row 0 is the bottom row of the image (Blender UV origin)."""
    i = SLOTS.index(slot)
    col, row = i % GRID, i // GRID
    return ((col + 0.5) / GRID, (row + 0.5) / GRID)
