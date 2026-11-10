#!/usr/bin/env python3
"""Regenerate the Faazio customer brand assets from the canonical sources.

Sources (never overwritten):
  assets/brand/logo-square.png      1536x1024 opaque #1627E9 field, "Fa" mark
  assets/brand/logo-rectangle.png   2172x724 opaque #1627E9 field, wordmark

Outputs:
  src/assets/icon.png               1024x1024 full-bleed launcher master
  src/assets/adaptive-icon.png      1024x1024 transparent adaptive foreground
  src/assets/faazio-logo.png        400x400 full-bleed tile
  src/assets/logo.png               2171x724 wordmark on #1627E9
  src/assets/logo-welcomepage.png   855x292 transparent wordmark
  src/assets/logo.svg               recoloured wordmark badge
  assets/brand/logo-welcomepage.svg embedded raster wrapper
  client/faazio-logo.ico            16/32/48 brand icon
  android/app/src/main/res/mipmap-*/ customer launcher + adaptive foreground
  ios/Faazio/Images.xcassets/AppIcon.appiconset/Icon-*.png

Requires Pillow + numpy. Usage: python3 scripts/regenerate-icons.py
"""

from __future__ import annotations

import json
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
    report_center,
    rounded_mask,
    save_svg_wrapper,
    save_webp,
    tint,
    with_mask,
)

MOBILE = Path(__file__).resolve().parent.parent
ROOT = MOBILE.parent.parent
BRAND = MOBILE / "assets" / "brand"
ASSETS = MOBILE / "src" / "assets"
ANDROID_RES = MOBILE / "android" / "app" / "src" / "main" / "res"
IOS_APPICON = MOBILE / "ios" / "Faazio" / "Images.xcassets" / "AppIcon.appiconset"

MARK_SOURCE = BRAND / "logo-square.png"
WORDMARK_SOURCE = BRAND / "logo-rectangle.png"

LEGACY_SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
FOREGROUND_SIZES = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

APP_ICON_FILL = 0.70
ADAPTIVE_FILL = 0.66
SMALL_LOGO_FILL = 0.90
LEGACY_RADIUS = 0.226
WELCOME_CONTENT_HEIGHT = 227


def ios_sizes(contents: Path) -> list[tuple[str, int]]:
    data = json.loads(contents.read_text(encoding="utf-8"))
    out: list[tuple[str, int]] = []
    for entry in data["images"]:
        filename = entry["filename"]
        px = round(float(entry["size"].split("x")[0]) * float(entry["scale"].rstrip("x")))
        out.append((filename, px))
    return out


def main() -> int:
    mark = key_white_ink(MARK_SOURCE)
    wordmark = key_white_ink(WORDMARK_SOURCE)
    print(
        f"mark ink {mark.width}x{mark.height}  wordmark ink {wordmark.width}x{wordmark.height}"
    )

    icon = center_on(fit_box(mark, 1024, APP_ICON_FILL), 1024, 1024, BRAND_BLUE)
    icon.convert("RGB").save(ASSETS / "icon.png", "PNG", optimize=True)
    report_center("src/assets/icon.png", icon)

    adaptive = center_on(fit_circle(mark, 1024, ADAPTIVE_FILL), 1024, 1024)
    adaptive.save(ASSETS / "adaptive-icon.png", "PNG", optimize=True)
    report_center("src/assets/adaptive-icon.png", adaptive)

    small = center_on(fit_box(mark, 400, SMALL_LOGO_FILL), 400, 400, BRAND_BLUE)
    small.convert("RGB").save(ASSETS / "faazio-logo.png", "PNG", optimize=True)
    report_center("src/assets/faazio-logo.png", small)

    word_canvas = center_on(wordmark, 2171, 724, BRAND_BLUE)
    word_canvas.convert("RGB").save(ASSETS / "logo.png", "PNG", optimize=True)
    print(
        f"src/assets/logo.png: 2171x724 wordmark "
        f"{wordmark.width}x{wordmark.height} centered"
    )

    welcome_scale = WELCOME_CONTENT_HEIGHT / wordmark.height
    welcome_ink = wordmark.resize(
        (max(1, round(wordmark.width * welcome_scale)), WELCOME_CONTENT_HEIGHT),
        RESAMPLE,
    )
    welcome = center_on(tint(welcome_ink, BRAND_BLUE), 855, 292)
    welcome.save(ASSETS / "logo-welcomepage.png", "PNG", optimize=True)
    save_svg_wrapper(
        welcome,
        BRAND / "logo-welcomepage.svg",
        welcome.width,
        welcome.height,
    )
    report_center("src/assets/logo-welcomepage.png", welcome)

    logo_svg = ASSETS / "logo.svg"
    svg = logo_svg.read_text(encoding="utf-8")
    svg = svg.replace("#434BFD", "#1627E9")
    logo_svg.write_text(svg, encoding="utf-8")

    for density, size in LEGACY_SIZES.items():
        out_dir = ANDROID_RES / f"mipmap-{density}"
        out_dir.mkdir(parents=True, exist_ok=True)
        legacy = center_on(fit_box(mark, size, APP_ICON_FILL), size, size, BRAND_BLUE)
        save_webp(
            with_mask(legacy, rounded_mask(size, LEGACY_RADIUS)),
            out_dir / "ic_launcher.webp",
        )
        save_webp(with_mask(legacy, circle_mask(size)), out_dir / "ic_launcher_round.webp")
        foreground = center_on(
            fit_circle(mark, FOREGROUND_SIZES[density], ADAPTIVE_FILL),
            FOREGROUND_SIZES[density],
            FOREGROUND_SIZES[density],
        )
        save_webp(foreground, out_dir / "ic_launcher_foreground.webp")

    contents = IOS_APPICON / "Contents.json"
    for filename, px in ios_sizes(contents):
        icon.resize((px, px), RESAMPLE).convert("RGB").save(
            IOS_APPICON / filename, "PNG", optimize=True
        )

    ico_art = icon.convert("RGB").resize((48, 48), RESAMPLE)
    ico_art.save(
        MOBILE.parent / "faazio-logo.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    print("regenerated customer Android mipmaps and iOS AppIcon set")
    return 0


if __name__ == "__main__":
    sys.exit(main())
