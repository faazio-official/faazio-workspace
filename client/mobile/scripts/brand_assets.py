#!/usr/bin/env python3
"""Shared helpers for the Faazio bitmap brand assets."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

BRAND_BLUE = (22, 39, 233)
RESAMPLE = Image.LANCZOS
KEY_FLOOR = 24


def luma(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def key_white_ink(path: str | Path) -> Image.Image:
    """Return the white mark from a blue-field source as transparent white RGBA."""
    im = Image.open(path).convert("RGBA")
    arr = np.asarray(im).astype(np.float64)
    rgb = arr[..., :3]
    tile_alpha = arr[..., 3]
    light = luma(rgb)

    field = (tile_alpha > 200) & (light < 200)
    if field.sum() < 100:
        field = tile_alpha > 200
    field_hi = float(np.percentile(light[field], 99.0))
    ink = float(np.percentile(light[tile_alpha > 200], 99.9))
    ink = max(ink, field_hi + 40.0)

    coverage = np.clip((light - field_hi) / (ink - field_hi), 0.0, 1.0)
    coverage[coverage < 0.10] = 0.0
    alpha = np.round(coverage * 255.0 * (tile_alpha / 255.0)).astype(np.uint8)
    alpha[alpha < KEY_FLOOR] = 0

    out = np.zeros((*light.shape, 4), dtype=np.uint8)
    out[..., :3] = 255
    out[..., 3] = alpha
    image = Image.fromarray(out, "RGBA")
    bbox = image.getchannel("A").point(lambda v: 255 if v >= KEY_FLOOR else 0).getbbox()
    if bbox is None:
        raise SystemExit(f"ERROR: no white ink found in {path}")
    return image.crop(bbox)


def fit_box(ink: Image.Image, canvas: int, max_fraction: float) -> Image.Image:
    side = canvas * max_fraction
    scale = min(1.0, side / max(ink.width, ink.height))
    if scale >= 1.0:
        return ink.copy()
    return ink.resize(
        (max(1, round(ink.width * scale)), max(1, round(ink.height * scale))),
        RESAMPLE,
    )


def fit_circle(ink: Image.Image, canvas: int, diameter_fraction: float) -> Image.Image:
    radius = canvas * diameter_fraction / 2.0
    aspect = ink.width / ink.height
    max_width = 2.0 * radius / (1.0 + 1.0 / (aspect * aspect)) ** 0.5
    scale = min(1.0, max_width / ink.width)
    if scale >= 1.0:
        return ink.copy()
    return ink.resize(
        (max(1, round(ink.width * scale)), max(1, round(ink.height * scale))),
        RESAMPLE,
    )


def center_on(
    ink: Image.Image,
    width: int,
    height: int,
    background: tuple[int, int, int] | None = None,
) -> Image.Image:
    fill = (*background, 255) if background is not None else (0, 0, 0, 0)
    canvas = Image.new("RGBA", (width, height), fill)
    canvas.paste(ink, ((width - ink.width) // 2, (height - ink.height) // 2), ink)
    return canvas


def tint(ink: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    out = Image.new("RGBA", ink.size, (*color, 0))
    out.putalpha(ink.getchannel("A"))
    return out


def rounded_mask(size: int, radius_fraction: float, supersample: int = 4) -> Image.Image:
    big = size * supersample
    mask = Image.new("L", (big, big), 0)
    radius = max(1, round(size * radius_fraction)) * supersample
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, big - 1, big - 1], radius=radius, fill=255
    )
    return mask.resize((size, size), RESAMPLE)


def circle_mask(size: int, supersample: int = 4) -> Image.Image:
    big = size * supersample
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, big - 1, big - 1], fill=255)
    return mask.resize((size, size), RESAMPLE)


def with_mask(image: Image.Image, mask: Image.Image) -> Image.Image:
    out = image.convert("RGBA")
    out.putalpha(mask)
    return out


def save_webp(image: Image.Image, path: str | Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", lossless=True, quality=100, method=6)


def save_svg_wrapper(
    png: Image.Image,
    path: str | Path,
    width: int,
    height: int,
    alt: str = "Faazio logo",
) -> None:
    import base64
    import io

    buf = io.BytesIO()
    png.save(buf, "PNG", optimize=True)
    data = base64.b64encode(buf.getvalue()).decode("ascii")
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-label="{alt}">\n'
        f'  <image href="data:image/png;base64,{data}" width="{width}" '
        f'height="{height}" alt="{alt}"/>\n'
        "</svg>\n"
    )
    Path(path).write_text(svg, encoding="utf-8")


def report_center(name: str, image: Image.Image) -> None:
    arr = np.asarray(image)
    alpha = arr[..., 3]
    ys, xs = np.nonzero(alpha > 8)
    if len(xs) == 0:
        print(f"{name}: EMPTY")
        return
    width, height = image.size
    cx = (xs.min() + xs.max() + 1) / 2.0
    cy = (ys.min() + ys.max() + 1) / 2.0
    radius = float(np.sqrt(((xs - cx) ** 2) + ((ys - cy) ** 2)).max())
    print(
        f"{name}: {width}x{height} ink {xs.max() + 1 - xs.min()}x{ys.max() + 1 - ys.min()} "
        f"offset ({cx - width / 2:+.1f},{cy - height / 2:+.1f}) "
        f"radius {radius:.1f}px"
    )
