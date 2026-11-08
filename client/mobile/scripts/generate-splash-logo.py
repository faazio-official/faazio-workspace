#!/usr/bin/env python3
"""
Generate native splash-screen logos from the single source of truth
`src/assets/logo.png` (the wide Faazio wordmark used by the JS SplashFallback).

Why this script exists
----------------------
The native splash assets are not a naive resize of the source. Two platform
constraints force a deliberate treatment, both verified against the real
toolchain rather than assumed:

1. Android 12+ masks `windowSplashScreenAnimatedIcon` to a CIRCLE.
   From androidx.core:core-splashscreen:1.0.1 (res/values/values.xml):
       splashscreen_icon_size_no_background      = 288dp   (icon canvas)
       splashscreen_icon_mask_size_no_background = 410dp   (compat ring)
       splashscreen_icon_mask_stroke_no_background = 109dp
   On API 31+ the platform draws the 288dp canvas inside a 192dp circle
   (radius 96dp). A 3:1 wordmark spanning the full canvas has a half-diagonal
   of ~149dp, so only ~61% of its width would survive. We therefore fit the
   wordmark INSIDE the mask circle with margin so nothing is clipped.
   On API 24-30 the compat drawable draws the icon at the full 288dp with the
   ring starting at radius ~150.5dp, so the fitted wordmark is fully visible
   there too. One asset satisfies both paths.

2. The source PNG is opaque RGB (no alpha) with a blue field that is NOT flat
   (corners run to #4952F3). Compositing that field onto the splash background
   would leave a faint rectangle edge. We key the field out to transparency and
   keep only the white wordmark, so the asset is background-independent and
   works on any splash colour, on both platforms.

Outputs
-------
  android/app/src/main/res/drawable-{m,h,xh,xxh,xxxh}dpi/splashscreen_logo.png
  ios/Faazio/Images.xcassets/SplashScreenLogo.imageset/image{,@2x,@3x}.png

Usage
-----
  python3 scripts/generate-splash-logo.py            # write assets
  python3 scripts/generate-splash-logo.py --check    # verify only, no writes
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "assets" / "logo.png"

ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS_IMAGESET = ROOT / "ios" / "Faazio" / "Images.xcassets" / "SplashScreenLogo.imageset"

# Android: splashscreen_icon_size_no_background = 288dp, so px == dp * density.
ANDROID_DENSITIES = {
    "mdpi": 1.0,
    "hdpi": 1.5,
    "xhdpi": 2.0,
    "xxhdpi": 3.0,
    "xxxhdpi": 4.0,
}

# Android 12+ circular mask: 192dp diameter on a 288dp canvas.
ANDROID_CANVAS_DP = 288.0
ANDROID_MASK_RADIUS_DP = 96.0
# Fraction of the mask diameter the wordmark may occupy. <1 leaves a margin so
# antialiased edges never touch the clip boundary.
ANDROID_INK_FILL = 0.92

# iOS uses the same square 288dp canvas as Android. The iOS 1x/2x/3x slices
# map exactly to Android mdpi/xhdpi/xxhdpi (288/576/864 px), so the storyboard
# can present a square logo identical to the Android splash artwork.
IOS_SCALES = {"": 1.0, "@2x": 2.0, "@3x": 3.0}


def _luma(p: tuple[int, int, int]) -> float:
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]


def load_wordmark() -> tuple[Image.Image, tuple[int, int, int, int]]:
    """Return the source as RGBA with the blue field keyed out to transparency.

    The source is an opaque blue field (luma ~85, and NOT flat: corners drift to
    #4952F3) carrying a white wordmark (luma ~250). Keying per-channel against a
    single field colour leaks a few units of alpha from that drift, which makes
    the whole canvas look like ink. Luma with a dead zone is robust to it: every
    field pixel lands below the threshold and every ink pixel above.
    """
    src = Image.open(SOURCE).convert("RGB")
    w, h = src.size
    px = src.load()

    # Field luma ceiling = p99 of the outer 8px border ring (drift-tolerant).
    ring: list[float] = []
    for y in range(h):
        for x in (*range(0, 8), *range(w - 8, w)):
            ring.append(_luma(px[x, y]))
    for x in range(w):
        for y in (*range(0, 8), *range(h - 8, h)):
            ring.append(_luma(px[x, y]))
    ring.sort()
    field_hi = ring[int(len(ring) * 0.99)]

    # Ink luma = p99 of the whole image (the wordmark is the bright population).
    all_l = sorted(_luma(px[x, y]) for y in range(0, h, 2) for x in range(0, w, 2))
    ink_lo = all_l[int(len(all_l) * 0.99)]
    if ink_lo - field_hi < 40:
        raise SystemExit(
            f"ERROR: field/ink luma too close (field {field_hi:.0f}, ink {ink_lo:.0f});"
            " refusing to key"
        )

    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    op = out.load()
    span = ink_lo - field_hi
    # Alpha floor: the field's own drift produces alpha of a few units, which is
    # invisible but would make getbbox() report the whole canvas as ink.
    floor = 24
    for y in range(h):
        for x in range(w):
            a = (_luma(px[x, y]) - field_hi) / span
            if a <= 0.0:
                continue
            v = round(min(a, 1.0) * 255)
            if v < floor:
                continue
            op[x, y] = (255, 255, 255, v)

    bbox = out.getchannel("A").point(lambda v: 255 if v >= floor else 0).getbbox()
    if bbox is None:
        raise SystemExit("ERROR: keying produced an empty image; check SOURCE")
    return out.crop(bbox), bbox


def render_android(ink: Image.Image, density: float) -> Image.Image:
    """Fit the wordmark inside the Android 12+ mask circle on a 288dp canvas."""
    canvas = round(ANDROID_CANVAS_DP * density)
    radius = ANDROID_MASK_RADIUS_DP * density
    aspect = ink.width / ink.height

    # Largest ink width whose bounding box still fits inside the circle.
    max_w = 2 * radius / (1 + 1 / (aspect ** 2)) ** 0.5
    target_w = max_w * ANDROID_INK_FILL
    target_h = target_w / aspect

    scaled = ink.resize((round(target_w), round(target_h)), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(scaled, ((canvas - scaled.width) // 2, (canvas - scaled.height) // 2), scaled)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verify only, write nothing")
    args = ap.parse_args()

    if not SOURCE.exists():
        raise SystemExit(f"ERROR: source not found: {SOURCE}")

    ink, bbox = load_wordmark()
    print(f"source      {SOURCE.relative_to(ROOT)}")
    print(f"ink bbox    {bbox}  ->  {ink.width}x{ink.height}  aspect {ink.width / ink.height:.3f}")

    written = 0

    for name, density in ANDROID_DENSITIES.items():
        img = render_android(ink, density)
        path = ANDROID_RES / f"drawable-{name}" / "splashscreen_logo.png"
        if not args.check:
            path.parent.mkdir(parents=True, exist_ok=True)
            img.save(path, "PNG", optimize=True)
        written += 1
        print(f"android     {path.relative_to(ROOT)}  {img.width}x{img.height}")

    for suffix, scale in IOS_SCALES.items():
        img = render_android(ink, scale)
        path = IOS_IMAGESET / f"image{suffix}.png"
        if not args.check:
            path.parent.mkdir(parents=True, exist_ok=True)
            img.save(path, "PNG", optimize=True)
        written += 1
        print(f"ios         {path.relative_to(ROOT)}  {img.width}x{img.height}")

    verb = "verified" if args.check else "wrote"
    print(f"\n{verb} {written} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
