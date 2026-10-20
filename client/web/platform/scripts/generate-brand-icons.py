#!/usr/bin/env python3
"""Regenerate the Faazio Partner Portal favicon + PWA icon set.

Dev-only. Requires python3 + Pillow + numpy (no new npm dep; Pillow is a
system tool on this machine). Idempotent — run from anywhere; paths are
resolved relative to this script.

Art = the Faazio knot (masked from the canonical mobile brand PNG) on the
brand-gradient tile, matching `public/favicon.svg` exactly (same gradient
stops, same 22.6% corner radius, same ~62% glyph, same white fill). The
vector `favicon.svg` itself is left untouched.

The source of truth is `client/mobile/src/assets/faazio-logo.png`
(1254x1254 RGBA knot; byte-identical to `icon.png`/`adaptive-icon.png`).
Its alpha channel is the knot silhouette; we fill it white over the
gradient tile so the favicons match the in-app `BrandTile`.

Outputs (overwrites 7 files in `public/`):
  favicon.ico                 real multi-size ICO (16 + 32 + 48)
  favicon-16x16.png, favicon-32x32.png
  apple-touch-icon.png        180x180, flattened onto white (Apple ignores alpha)
  android-chrome-192x192.png  any-purpose tile
  android-chrome-512x512.png  full-bleed tile so the same file is maskable-safe
"""
from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SCRIPT_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = SCRIPT_DIR.parent / "public"
SOURCE = SCRIPT_DIR.parents[2] / "mobile" / "src" / "assets" / "faazio-logo.png"

# Brand-gradient stops, copied from public/favicon.svg.
# diagonal (0,0) -> (S,S); stops at t = 0 / 0.6 / 1.
ST0 = np.array([17, 98, 211], dtype=float)   # #1162D3
ST1 = np.array([47, 128, 237], dtype=float)  # #2F80ED
ST2 = np.array([42, 159, 214], dtype=float)  # #2A9FD6

SUPER = 4  # supersample factor for crisp small-size corners
RADIUS_FRAC = 116 / 512  # matches favicon.svg rx=116 on a 512 viewport


def gradient(size: int) -> np.ndarray:
    yy, xx = np.indices((size, size))
    t = np.clip((xx + yy) / (2 * (size - 1)), 0, 1)
    first = ST0 + (ST1 - ST0) * (t[..., None] / 0.6)
    last = ST1 + (ST2 - ST1) * ((t[..., None] - 0.6) / 0.4)
    rgb = np.where(t[:, :, None] > 0.6, last, first).astype(np.uint8)
    return rgb


def knot_mask(size: int) -> np.ndarray:
    src = Image.open(SOURCE).convert("RGBA")
    alpha = np.array(src)[:, :, 3]
    ys, xs = np.nonzero(alpha > 8)
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    knot = alpha[by0 : by1 + 1, bx0 : bx1 + 1]
    # target glyph ~62% of canvas width (matches favicon.svg geometry),
    # preserving the source panel's aspect ratio.
    target_w = int(size * 0.62)
    scale = target_w / knot.shape[1]
    target_h = int(round(knot.shape[0] * scale))
    im = Image.fromarray(knot, mode="L").resize((target_w, target_h), Image.LANCZOS)
    a = np.array(im)
    return (a > 8).astype(np.uint8), target_w, target_h


def tile(size: int, rounded: bool) -> Image.Image:
    rgb = gradient(size)
    gap, gx, gy = knot_mask(size)
    # paste knot white, centered
    x0 = (size - gx) // 2
    y0 = (size - gy) // 2
    seg = rgb[y0 : y0 + gy, x0 : x0 + gx]
    rgb[y0 : y0 + gy, x0 : x0 + gx] = np.where(gap[..., None], 255, seg)
    img = Image.fromarray(rgb, mode="RGB").convert("RGBA")
    if rounded:
        radius = int(size * RADIUS_FRAC)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=max(radius, 1), fill=255)
        img.putalpha(mask)
    return img


def down(img: Image.Image, px: int) -> Image.Image:
    return img.resize((px, px), Image.LANCZOS)


def main() -> None:
    assert SOURCE.exists(), f"source knot PNG not found: {SOURCE}"
    print(f"source knot: {SOURCE}")
    master = tile(512 * SUPER, rounded=True)   # rounded tile master
    bleed = tile(512 * SUPER, rounded=False)   # full-bleed (maskable) master

    # favicon.ico — real multi-size ICO (16/32/48)
    ico = down(master, 48)
    ico.save(
        PUBLIC_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    # PNG favicons
    down(master, 16).save(PUBLIC_DIR / "favicon-16x16.png")
    down(master, 32).save(PUBLIC_DIR / "favicon-32x32.png")
    # Apple: 180x180, flattened onto white (no transparency)
    apple = down(master, 180)
    bg = Image.new("RGB", apple.size, (255, 255, 255))
    bg.paste(apple, mask=apple.split()[3])
    bg.save(PUBLIC_DIR / "apple-touch-icon.png")
    # Android: "any" rounded tile + full-bleed maskable-safe 512
    down(master, 192).save(PUBLIC_DIR / "android-chrome-192x192.png")
    down(bleed, 512).save(PUBLIC_DIR / "android-chrome-512x512.png")

    # favicon.svg stays the shipped vector (its art IS this generator's input).
    print("wrote:")
    for name in (
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
    ):
        p = PUBLIC_DIR / name
        print(f"  {p} ({p.stat().st_size} bytes)")


if __name__ == "__main__":
    main()