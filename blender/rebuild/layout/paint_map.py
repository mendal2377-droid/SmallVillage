"""Turn the top-down map sheets into picture-book map images for the main page.

  python blender/rebuild/layout/paint_map.py

Reads layout/renders/mapsheet_m{4,8,10,1}.png (orthographic renders of layout_data.MAP_SHEET) and writes
public/images/v2/map_{spring,summer,autumn,winter}.webp (2048 px). The treatment is a soft painted look:
small brush patches, warmer colour, light ink edges, paper grain and an edge that fades into the paper.
"""
import os

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SRC = os.path.join(HERE, "renders")
OUT = os.path.join(REPO, "public", "images", "v2")
SIZE = 2048
PAPER = np.array([238, 228, 205], dtype=np.float32)  # warm cream
INK = np.array([62, 58, 44], dtype=np.float32)
SEASONS = {4: "spring", 8: "summer", 10: "autumn", 1: "winter"}


def noise(size, scale, seed):
    """Smooth value noise in 0..1 by upsampling a small random grid."""
    rng = np.random.default_rng(seed)
    n = max(2, size // scale)
    small = Image.fromarray((rng.random((n, n)) * 255).astype(np.uint8))
    return np.asarray(small.resize((size, size), Image.BICUBIC), dtype=np.float32) / 255.0


def paint(path, out):
    im = Image.open(path).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
    # brush patches: a mode filter merges small details into painted dabs, then a light blur softens them
    im = im.filter(ImageFilter.ModeFilter(5)).filter(ImageFilter.GaussianBlur(0.6))
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Contrast(im).enhance(1.04)
    a = np.asarray(im, dtype=np.float32)
    # warm the light values a little, like paper showing through the paint
    a = a * 0.94 + PAPER * 0.06
    # ink: soft dark outlines where colour changes sharply (roofs, roads, pond banks)
    g = im.convert("L").filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(0.8))
    e = np.clip((np.asarray(g, dtype=np.float32) - 18) / 60, 0, 1)[..., None] * 0.45
    a = a * (1 - e) + INK * e
    # paper grain (fine) and wash variation (broad)
    grain = noise(SIZE, 2, 1) * 0.6 + noise(SIZE, 6, 2) * 0.4
    wash = noise(SIZE, 180, 3)
    a *= (0.95 + 0.07 * grain)[..., None] * (0.97 + 0.06 * wash)[..., None]
    # edges fade into the paper with an irregular border
    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / (SIZE - 1)
    d = np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy))
    wobble = (noise(SIZE, 64, 4) - 0.5) * 0.02
    fade = np.clip((d + wobble - 0.012) / 0.05, 0, 1)[..., None]
    a = a * fade + PAPER * (1 - fade)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out, "WEBP", quality=84, method=6)
    return os.path.getsize(out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for m, season in SEASONS.items():
        src = os.path.join(SRC, f"mapsheet_m{m}.png")
        dst = os.path.join(OUT, f"map_{season}.webp")
        print(season, paint(src, dst), "bytes")
