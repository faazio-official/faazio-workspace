#!/usr/bin/env python3
"""Regenerate the Faazio partner-app launcher icons (delivery + seller).

Dev-only helper. Requires Pillow. Idempotent; paths resolve relative to this file.

The customer app icons are committed under `android/app/src/main/res/` and
`ios/Faazio/Images.xcassets/AppIcon.appiconset/` and are NOT touched here.

Sources (never overwritten):
  src/assets/icon-delivery.png   (1254x1254 RGBA)
  src/assets/icon-seller.png     (1254x1254 RGBA)

Outputs, per variant:
  android/app/src/<flavor>/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/
      ic_launcher.webp             legacy launcher (API 24-25)
      ic_launcher_round.webp       legacy round
      ic_launcher_foreground.webp  adaptive foreground (API 26+)
  android/app/src/<flavor>/res/values/colors.xml   iconBackground matching the tile
  ios/Faazio/Images.xcassets/<Variant>-AppIcon.appiconset/App-Icon-1024x1024@1x.png

The adaptive foreground is drawn full-bleed; the shared drawable
`res/drawable/ic_launcher_foreground_inset.xml` applies the 20dp safe-zone inset
so the logo stays inside the launcher mask (see docs/RUNBOOKS/TROUBLESHOOTING.md).
"""
from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image, ImageChops, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.normpath(os.path.join(HERE, ".."))
ASSETS = os.path.join(MOBILE, "src", "assets")
ANDROID = os.path.join(MOBILE, "android", "app", "src")
XCASSETS = os.path.join(MOBILE, "ios", "Faazio", "Images.xcassets")

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
LEGACY_BASE = 48
FOREGROUND_BASE = 108

VARIANTS = [
    ("delivery", "icon-delivery.png", "Delivery-AppIcon"),
    ("seller", "icon-seller.png", "Seller-AppIcon"),
]

RESAMPLE = Image.LANCZOS


def full_bleed(art: Image.Image, size: int) -> Image.Image:
    """Crop to the opaque artwork then scale so the tile fills a square `size` canvas."""
    alpha = np.array(art)[:, :, 3]
    ys, xs = np.where(alpha > 8)
    cx = (xs.min() + xs.max()) / 2
    cy = (ys.min() + ys.max()) / 2
    side = float(max(xs.max() - xs.min() + 1, ys.max() - ys.min() + 1))
    left = int(round(cx - side / 2))
    top = int(round(cy - side / 2))
    crop = art.crop((left, top, left + int(side), top + int(side)))
    return crop.resize((size, size), RESAMPLE)


def round_mask(im: Image.Image) -> Image.Image:
    """Mask `im` to an inscribed circle (legacy round launcher icon)."""
    size = im.size[0]
    ss = 4
    mask = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * ss - 1, size * ss - 1), fill=255)
    mask = mask.resize((size, size), RESAMPLE)
    out = im.convert("RGBA")
    out.putalpha(ImageChops.multiply(out.getchannel("A"), mask))
    return out


def tile_color(art: Image.Image) -> str:
    """Median colour of the tile background (ignores the white glyph), as #RRGGBB."""
    a = np.array(art)
    r, g, b, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mask = (alpha > 250) & ~((r > 150) & (g > 150) & (b > 150))
    med = np.median(a[..., :3][mask], axis=0).astype(int)
    return "#%02X%02X%02X" % tuple(int(v) for v in med)


def save_webp(im: Image.Image, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", lossless=True, quality=100, method=6)


def generate(values: dict) -> None:
    for flavor, source, ios_name in values:
        art = Image.open(os.path.join(ASSETS, source)).convert("RGBA")

        for density, scale in DENSITIES.items():
            out_dir = os.path.join(ANDROID, flavor, "res", f"mipmap-{density}")
            legacy = full_bleed(art, int(round(LEGACY_BASE * scale)))
            foreground = full_bleed(art, int(round(FOREGROUND_BASE * scale)))
            save_webp(legacy, os.path.join(out_dir, "ic_launcher.webp"))
            save_webp(round_mask(legacy), os.path.join(out_dir, "ic_launcher_round.webp"))
            save_webp(foreground, os.path.join(out_dir, "ic_launcher_foreground.webp"))

        colors = os.path.join(ANDROID, flavor, "res", "values", "colors.xml")
        os.makedirs(os.path.dirname(colors), exist_ok=True)
        with open(colors, "w") as fh:
            fh.write("<resources>\n")
            fh.write(f'  <color name="iconBackground">{tile_color(art)}</color>\n')
            fh.write("</resources>\n")

        icon = full_bleed(art, 1024)
        background = Image.new("RGB", (1024, 1024), tile_color(art))
        background.paste(icon, (0, 0), icon)
        appicon_dir = os.path.join(XCASSETS, f"{ios_name}.appiconset")
        os.makedirs(appicon_dir, exist_ok=True)
        background.save(os.path.join(appicon_dir, "App-Icon-1024x1024@1x.png"), "PNG", optimize=True)
        contents = {
            "images": [
                {
                    "filename": "App-Icon-1024x1024@1x.png",
                    "idiom": "universal",
                    "platform": "ios",
                    "size": "1024x1024",
                }
            ],
            "info": {"version": 1, "author": "Faazio"},
        }
        with open(os.path.join(appicon_dir, "Contents.json"), "w") as fh:
            json.dump(contents, fh, indent=2)
            fh.write("\n")

        print(f"{flavor}: regenerated Android mipmaps + {ios_name}.appiconset")


def main() -> None:
    generate(VARIANTS)
    print("done")


if __name__ == "__main__":
    main()
