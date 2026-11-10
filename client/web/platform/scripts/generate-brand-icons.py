#!/usr/bin/env python3
"""Regenerate the Faazio favicon + PWA icon set for the portal and landing page.

Art = the Faazio "Fa" mark (extracted from the canonical mobile transparent
master) on the brand-gradient tile, matching `public/favicon.svg` geometry
(same gradient stops, 22.6% corner radius, ~62% glyph, white fill).

The source of truth is `client/mobile/src/assets/adaptive-icon.png` (1024x1024
transparent mark). Its alpha channel is the mark silhouette; we fill it white
over the gradient tile.

Outputs, for both `client/web/platform/public/` and
`client/web/landingpage/public/`:
  favicon.ico                 real multi-size ICO (16 + 32 + 48)
  favicon.svg                 64x64 SVG wrapper around the generated raster
  favicon-16x16.png, favicon-32x32.png
  apple-touch-icon.png        180x180, flattened full-bleed (no transparency)
  android-chrome-192x192.png  any-purpose tile
  android-chrome-512x512.png  full-bleed tile so the same file is maskable-safe
"""

from __future__ import annotations

import base64
import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SCRIPT_DIR = Path(__file__).resolve().parent
PLATFORM_PUBLIC = SCRIPT_DIR.parent / "public"
LANDING_PUBLIC = SCRIPT_DIR.parents[1] / "landingpage" / "public"
SOURCE = SCRIPT_DIR.parents[2] / "mobile" / "src" / "assets" / "adaptive-icon.png"

ST0 = np.array([22, 39, 233], dtype=float)
ST1 = np.array([47, 128, 237], dtype=float)
ST2 = np.array([42, 159, 214], dtype=float)

SUPER = 4
RADIUS_FRAC = 116 / 512
MARK_FILL = 0.62


def gradient(size: int) -> np.ndarray:
    yy, xx = np.indices((size, size))
    t = np.clip((xx + yy) / (2 * (size - 1)), 0, 1)
    first = ST0 + (ST1 - ST0) * (t[..., None] / 0.6)
    last = ST1 + (ST2 - ST1) * ((t[..., None] - 0.6) / 0.4)
    rgb = np.where(t[:, :, None] > 0.6, last, first).astype(np.uint8)
    return rgb


def mark_mask(size: int) -> tuple[np.ndarray, int, int]:
    src = Image.open(SOURCE).convert("RGBA")
    alpha = np.array(src)[:, :, 3]
    ys, xs = np.nonzero(alpha > 8)
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    mark = alpha[by0 : by1 + 1, bx0 : bx1 + 1]
    target_w = int(size * MARK_FILL)
    scale = target_w / mark.shape[1]
    target_h = int(round(mark.shape[0] * scale))
    im = Image.fromarray(mark, mode="L").resize((target_w, target_h), Image.LANCZOS)
    a = np.array(im)
    return (a > 8).astype(np.uint8), target_w, target_h


def tile(size: int, rounded: bool) -> Image.Image:
    rgb = gradient(size)
    mask, gx, gy = mark_mask(size)
    x0 = (size - gx) // 2
    y0 = (size - gy) // 2
    seg = rgb[y0 : y0 + gy, x0 : x0 + gx]
    rgb[y0 : y0 + gy, x0 : x0 + gx] = np.where(mask[..., None], 255, seg)
    img = Image.fromarray(rgb, mode="RGB").convert("RGBA")
    if rounded:
        radius = max(1, int(size * RADIUS_FRAC))
        mask_img = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask_img).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=radius, fill=255
        )
        img.putalpha(mask_img)
    return img


def down(img: Image.Image, px: int) -> Image.Image:
    return img.resize((px, px), Image.LANCZOS)


def svg_wrapper(png: Image.Image, path: Path) -> None:
    buf = io.BytesIO()
    png.save(buf, "PNG", optimize=True)
    data = base64.b64encode(buf.getvalue()).decode("ascii")
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" '
        'viewBox="0 0 64 64" role="img" aria-label="Faazio">\n'
        f'  <image href="data:image/png;base64,{data}" width="64" height="64" '
        'alt="Faazio logo"/>\n'
        "</svg>\n",
        encoding="utf-8",
    )


def write_set(public: Path, master: Image.Image, bleed: Image.Image) -> None:
    public.mkdir(parents=True, exist_ok=True)
    ico = down(master, 48)
    ico.save(public / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    down(master, 16).save(public / "favicon-16x16.png")
    down(master, 32).save(public / "favicon-32x32.png")
    down(bleed, 180).convert("RGB").save(public / "apple-touch-icon.png")
    down(master, 192).save(public / "android-chrome-192x192.png")
    down(bleed, 512).save(public / "android-chrome-512x512.png")
    svg_wrapper(down(master, 64), public / "favicon.svg")


def main() -> None:
    assert SOURCE.exists(), f"source mark PNG not found: {SOURCE}"
    print(f"source mark: {SOURCE}")
    master = tile(512 * SUPER, rounded=True)
    bleed = tile(512 * SUPER, rounded=False)

    for public in (PLATFORM_PUBLIC, LANDING_PUBLIC):
        write_set(public, master, bleed)
        print(f"wrote: {public}")

    print("done")


if __name__ == "__main__":
    main()
