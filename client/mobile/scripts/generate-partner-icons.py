#!/usr/bin/env python3
"""Regenerate the Faazio partner-app launcher icons (delivery + seller).

Sources (recoloured in place):
  src/assets/icon-delivery.png
  src/assets/icon-seller.png

The source artwork is keyed off its old blue field, re-filled with the canonical
Faazio Blue (#1627E9), and written back as a 1254x1254 full-bleed master. The
same ink then produces the per-density Android assets and the flattened iOS set.

Outputs, per variant:
  android/app/src/<flavor>/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/
      ic_launcher.webp             legacy launcher (API 24-25)
      ic_launcher_round.webp       legacy round
      ic_launcher_foreground.webp  adaptive foreground (API 26+)
  android/app/src/<flavor>/res/values/colors.xml
  ios/Faazio/Images.xcassets/<Variant>-AppIcon.appiconset/Icon-*.png

Requires Pillow + numpy. Usage: python3 scripts/generate-partner-icons.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from brand_assets import (  # noqa: E402
    BRAND_BLUE,
    RESAMPLE,
    center_on,
    circle_mask,
    fit_box,
    fit_circle,
    key_white_ink,
    rounded_mask,
    save_webp,
    with_mask,
)

MOBILE = Path(__file__).resolve().parent.parent
ASSETS = MOBILE / "src" / "assets"
ANDROID = MOBILE / "android" / "app" / "src"
XCASSETS = MOBILE / "ios" / "Faazio" / "Images.xcassets"

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
LEGACY_BASE = 48
FOREGROUND_BASE = 108

VARIANTS = [
    ("delivery", "icon-delivery.png", "Delivery-AppIcon"),
    ("seller", "icon-seller.png", "Seller-AppIcon"),
]

APP_ICON_FILL = 0.70
ADAPTIVE_FILL = 0.66
LEGACY_RADIUS = 0.226

IOS_SIZES = [
    ("Icon-20.png", "20x20", "1x", "ipad", None),
    ("Icon-20@2x.png", "20x20", "2x", "iphone", None),
    ("Icon-20@2x-ipad.png", "20x20", "2x", "ipad", None),
    ("Icon-20@3x.png", "20x20", "3x", "iphone", None),
    ("Icon-29.png", "29x29", "1x", "ipad", None),
    ("Icon-29@2x.png", "29x29", "2x", "iphone", None),
    ("Icon-29@2x-ipad.png", "29x29", "2x", "ipad", None),
    ("Icon-29@3x.png", "29x29", "3x", "iphone", None),
    ("Icon-40.png", "40x40", "1x", "ipad", None),
    ("Icon-40@2x.png", "40x40", "2x", "iphone", None),
    ("Icon-40@2x-ipad.png", "40x40", "2x", "ipad", None),
    ("Icon-40@3x.png", "40x40", "3x", "iphone", None),
    ("Icon-60@2x.png", "60x60", "2x", "iphone", None),
    ("Icon-60@3x.png", "60x60", "3x", "iphone", None),
    ("Icon-76.png", "76x76", "1x", "ipad", None),
    ("Icon-76@2x.png", "76x76", "2x", "ipad", None),
    ("Icon-83.5@2x.png", "83.5x83.5", "2x", "ipad", None),
    ("Icon-1024.png", "1024x1024", "1x", "universal", "ios"),
]


def generate(values: list[tuple[str, str, str]]) -> None:
    for flavor, source_name, ios_name in values:
        source = ASSETS / source_name
        ink = key_white_ink(source)

        master = center_on(fit_box(ink, 1254, APP_ICON_FILL), 1254, 1254, BRAND_BLUE)
        master.convert("RGB").save(source, "PNG", optimize=True)

        for density, scale in DENSITIES.items():
            out_dir = ANDROID / flavor / "res" / f"mipmap-{density}"
            legacy_px = round(LEGACY_BASE * scale)
            legacy = center_on(
                fit_box(ink, legacy_px, APP_ICON_FILL), legacy_px, legacy_px, BRAND_BLUE
            )
            save_webp(
                with_mask(legacy, rounded_mask(legacy_px, LEGACY_RADIUS)),
                out_dir / "ic_launcher.webp",
            )
            save_webp(
                with_mask(legacy, circle_mask(legacy_px)),
                out_dir / "ic_launcher_round.webp",
            )
            foreground_px = round(FOREGROUND_BASE * scale)
            foreground = center_on(
                fit_circle(ink, foreground_px, ADAPTIVE_FILL),
                foreground_px,
                foreground_px,
            )
            save_webp(foreground, out_dir / "ic_launcher_foreground.webp")

        colors = ANDROID / flavor / "res" / "values" / "colors.xml"
        colors.parent.mkdir(parents=True, exist_ok=True)
        colors.write_text(
            "<resources>\n"
            '  <color name="iconBackground">#1627E9</color>\n'
            "</resources>\n",
            encoding="utf-8",
        )

        appicon_dir = XCASSETS / f"{ios_name}.appiconset"
        appicon_dir.mkdir(parents=True, exist_ok=True)
        images = []
        for filename, size, scale, idiom, platform in IOS_SIZES:
            px = round(float(size.split("x")[0]) * float(scale.rstrip("x")))
            entry = {
                "filename": filename,
                "idiom": idiom,
                "scale": scale,
                "size": size,
            }
            if platform:
                entry["platform"] = platform
            images.append(entry)
            center_on(
                fit_box(ink, px, APP_ICON_FILL), px, px, BRAND_BLUE
            ).convert("RGB").save(
                appicon_dir / filename, "PNG", optimize=True
            )
        contents = {"images": images, "info": {"version": 1, "author": "Faazio"}}
        with open(appicon_dir / "Contents.json", "w", encoding="utf-8") as fh:
            json.dump(contents, fh, indent=2)
            fh.write("\n")

        print(f"{flavor}: recoloured source + Android mipmaps + {ios_name}.appiconset")


def main() -> None:
    generate(VARIANTS)
    print("done")


if __name__ == "__main__":
    os.chdir(MOBILE)
    main()
