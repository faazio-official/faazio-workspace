#!/usr/bin/env python3
"""
Regenerate the three brand icon assets from the source-of-truth 1254x1254 artwork
(src/assets/icon.png) so each is distinct and correctly sized:

  - icon.png            -> 1024x1024  full-bleed launcher icon
  - adaptive-icon.png   -> 1024x1024  foreground scaled into the adaptive safe
                                      zone (center ~66%) with transparent padding
                                      (Android masks/crops the outer edge)
  - faazio-logo.png     -> 400x400    small splash logo (scaled to ~90%)

Requires Pillow (PIL). Usage: python3 scripts/regenerate-icons.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "src", "assets"))
SRC = os.path.join(ASSETS, "icon.png")

# Adaptive-icon safe zone: Android's circle mask keeps ~66% of the canvas,
# so the artwork must sit inside the center 66% with transparent margins.
ADAPTIVE_FILL = 0.66
# Splash logo: keep a small margin so it never touches the splash edges.
LOGO_FILL = 0.90

RESAMPLE = Image.LANCZOS


def rescale_center(src: Image.Image, size: int, fill_ratio: float) -> Image.Image:
    """Scale src (square) to fill `fill_ratio` of a `size`x`size` canvas, centered."""
    target = size * fill_ratio
    scaled = src.resize((int(target), int(target)), RESAMPLE)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = (size - scaled.width) // 2
    canvas.paste(scaled, (offset, offset), scaled)
    return canvas


def main() -> None:
    art = Image.open(SRC).convert("RGBA")

    # 1. Launcher icon: full-bleed 1024x1024.
    icon = art.resize((1024, 1024), RESAMPLE)
    icon.save(os.path.join(ASSETS, "icon.png"))
    print("icon.png            -> 1024x1024 full-bleed")

    # 2. Adaptive foreground: artwork inside the center safe zone.
    adaptive = rescale_center(art, 1024, ADAPTIVE_FILL)
    adaptive.save(os.path.join(ASSETS, "adaptive-icon.png"))
    print("adaptive-icon.png   -> 1024x1024 foreground (%.0f%% safe-zone)" % (ADAPTIVE_FILL * 100))

    # 3. Splash logo: 400x400 with a small margin.
    logo = rescale_center(art, 400, LOGO_FILL)
    logo.save(os.path.join(ASSETS, "faazio-logo.png"))
    print("faazio-logo.png     -> 400x400 splash logo (%.0f%% fill)" % (LOGO_FILL * 100))

    print("done")


if __name__ == "__main__":
    main()
