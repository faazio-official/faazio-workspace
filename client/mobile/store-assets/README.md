# Store upload assets

Upload-ready icons for the three stores. These are **separate from the in-app
launcher/adaptive icons** — do not paste them back into `android/` or `ios/`.
Regenerate with:

```bash
python3 client/mobile/scripts/generate-store-assets.py
```

The script reads the canonical masters (`src/assets/icon*.png`,
`assets/brand/logo-rectangle.png`) and the canonical web favicon/PWA set
(`client/web/platform/public/`), then rewrites this folder.

## What to upload where

| Store | File | Exact requirement |
|---|---|---|
| Google Play Console → Main store listing → App icon | `google-play/<app>/icon-512.png` | 512×512 px, 32-bit PNG with alpha, ≤ 1024 KB |
| Google Play Console → Main store listing → Feature graphic | `google-play/<app>/feature-graphic-1024x500.png` | 1024×500 px, JPEG or 24-bit PNG, **no alpha** |
| App Store Connect → App information → App icon | `app-store/<app>/AppIcon-1024.png` | 1024×1024 px, PNG, **opaque**, full-bleed square; do not bake rounded corners |
| Web / PWA | `web/*` | favicon 16/32 + ICO, apple-touch-icon 180, PWA 192/512, maskable |

`<app>` is `customer`, `delivery`, or `seller`.

## Platform rules encoded here

**Google Play**

- Store icon is 512×512. It does **not** replace the launcher icon; the APK/AAB
  still uses `android/app/src/*/res/mipmap-*`.
- 32-bit PNG with alpha, max 1024 KB. The generated files are RGBA and ~45 KB.
- No badges, ranking claims, price, or store-category text.
- Feature graphic: keep the wordmark centred, away from the outer cutoff zones.

**Apple App Store**

- App Store Connect takes one 1024×1024 PNG. Xcode generates the device slices
  (20/29/40/60/76/83.5 pt at @1x/@2x/@3x) from the asset catalog.
- The 1024 upload must be **opaque** — iOS masks the squircle itself. The
  generated file is RGB (no alpha channel) and full-bleed.

**Web / PWA**

- `purpose: "any"` icons may be transparent; `purpose: "maskable"` must be
  opaque with the mark inside the central safe circle (radius = 40% of width).
- `apple-touch-icon` is 180×180 and flattened (no transparency).
- The portal and landing page already generate this same set with
  `client/web/platform/scripts/generate-brand-icons.py`; the copies here are for
  uploading/exporting, not a second source of truth.

## Sources

- Customer mark: `client/mobile/src/assets/icon.png`
- Delivery mark: `client/mobile/src/assets/icon-delivery.png`
- Seller mark: `client/mobile/src/assets/icon-seller.png`
- Wordmark: `client/mobile/assets/brand/logo-rectangle.png`
- Web set: `client/web/platform/public/`

Brand colour and asset ownership are defined in `docs/UI_DESIGN_SYSTEM.md` §5
(brand colour + brand bitmap sources).
