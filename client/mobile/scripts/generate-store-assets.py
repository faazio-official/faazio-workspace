#!/usr/bin/env python3
"""Generate the store-upload icon bundle for Google Play, the App Store and web.

This script does NOT replace the in-app launcher/adaptive icons. It produces a
separate, upload-ready folder (`client/mobile/store-assets/`) with exactly the
files the consoles ask for:

  Google Play Console  512x512 32-bit PNG with alpha, <= 1024 KB
  Google Play listing  1024x500 JPEG/24-bit PNG, no alpha (feature graphic)
  App Store Connect    1024x1024 PNG, opaque, full-bleed (no alpha)
  Web / PWA            favicon.ico, 16/32 PNG, 180 apple-touch, 192/512 PWA

Sources (already canonical; never hand-edited):
  src/assets/icon.png            customer  (Fa mark on Faazio Blue)
  src/assets/icon-delivery.png   delivery  (Faazio Delivery on Faazio Blue)
  src/assets/icon-seller.png     seller    (Faazio Seller on Faazio Blue)
  assets/brand/logo-rectangle.png Faazio wordmark (feature graphic)
  client/web/platform/public/*   canonical web favicon/PWA set

Usage: python3 scripts/generate-store-assets.py
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))

from brand_assets import (  # noqa: E402
    BRAND_BLUE,
    RESAMPLE,
    center_on,
    key_white_ink,
)

MOBILE = Path(__file__).resolve().parent.parent
REPO = MOBILE.parent.parent
ASSETS = MOBILE / "src" / "assets"
WORDMARK = MOBILE / "assets" / "brand" / "logo-rectangle.png"
WEB_PUBLIC = REPO / "client" / "web" / "platform" / "public"
OUT = MOBILE / "store-assets"

VARIANTS = {
    "customer": {"icon": ASSETS / "icon.png", "label": None},
    "delivery": {"icon": ASSETS / "icon-delivery.png", "label": "Delivery Partner"},
    "seller": {"icon": ASSETS / "icon-seller.png", "label": "Seller Partner"},
}

PLAY_ICON = 512
IOS_ICON = 1024
PLAY_MAX_BYTES = 1024 * 1024
FEATURE_W, FEATURE_H = 1024, 500

FONT_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")

WEB_FILES = {
    "favicon.ico": "favicon.ico",
    "favicon-16x16.png": "favicon-16x16.png",
    "favicon-32x32.png": "favicon-32x32.png",
    "favicon.svg": "favicon.svg",
    "apple-touch-icon.png": "apple-touch-icon-180x180.png",
    "android-chrome-192x192.png": "android-chrome-192x192.png",
    "android-chrome-512x512.png": "android-chrome-512x512.png",
    "site.webmanifest": "site.webmanifest",
}


def open_icon(path: Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def write_play_icon(icon: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    out = icon.resize((PLAY_ICON, PLAY_ICON), RESAMPLE).convert("RGBA")
    out.save(dest, "PNG", optimize=True)
    size = dest.stat().st_size
    if size > PLAY_MAX_BYTES:
        raise SystemExit(
            f"ERROR: {dest} is {size} bytes; Google Play limit is {PLAY_MAX_BYTES}"
        )


def write_ios_icon(icon: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    out = icon.resize((IOS_ICON, IOS_ICON), RESAMPLE).convert("RGB")
    out.save(dest, "PNG", optimize=True)


def feature_graphic(label: str | None) -> Image.Image:
    """Brand-blue 1024x500 feature graphic with the wordmark kept off the edges."""
    canvas = Image.new("RGB", (FEATURE_W, FEATURE_H), BRAND_BLUE)
    ink = key_white_ink(WORDMARK)

    max_w = int(FEATURE_W * 0.58)
    max_h = int(FEATURE_H * 0.30)
    scale = min(max_w / ink.width, max_h / ink.height)
    ink = ink.resize(
        (max(1, round(ink.width * scale)), max(1, round(ink.height * scale))),
        RESAMPLE,
    )

    label_h = 0
    label_img = None
    if label:
        font = ImageFont.truetype(str(FONT_BOLD), 46)
        box = font.getbbox(label)
        label_w = box[2] - box[0]
        label_h = box[3] - box[1]
        label_img = Image.new("RGBA", (label_w + 8, label_h + 12), (0, 0, 0, 0))
        ImageDraw.Draw(label_img).text((4, -box[1] + 6), label, font=font, fill=(255, 255, 255, 255))

    gap = 26 if label_img else 0
    total_h = ink.height + gap + (label_img.height if label_img else 0)
    y = (FEATURE_H - total_h) // 2
    canvas.paste(ink, ((FEATURE_W - ink.width) // 2, y), ink)
    if label_img:
        canvas.paste(
            label_img,
            ((FEATURE_W - label_img.width) // 2, y + ink.height + gap),
            label_img,
        )
    return canvas


def copy_web_set() -> None:
    dest = OUT / "web"
    dest.mkdir(parents=True, exist_ok=True)
    for src_name, dst_name in WEB_FILES.items():
        src = WEB_PUBLIC / src_name
        if not src.exists():
            raise SystemExit(f"ERROR: missing canonical web asset {src}")
        shutil.copy2(src, dest / dst_name)


def main() -> int:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    wordmark = key_white_ink(WORDMARK)
    print(f"wordmark ink {wordmark.width}x{wordmark.height}")

    for variant, meta in VARIANTS.items():
        icon = open_icon(meta["icon"])
        write_play_icon(icon, OUT / "google-play" / variant / "icon-512.png")
        write_ios_icon(icon, OUT / "app-store" / variant / "AppIcon-1024.png")
        graphic = feature_graphic(meta["label"])
        graphic.save(
            OUT / "google-play" / variant / "feature-graphic-1024x500.png",
            "PNG",
            optimize=True,
        )
        print(f"{variant}: play 512 + iOS 1024 + feature graphic")

    copy_web_set()
    print(f"web: {len(WEB_FILES)} files copied from {WEB_PUBLIC.relative_to(REPO)}")
    print(f"\nwrote {OUT.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
