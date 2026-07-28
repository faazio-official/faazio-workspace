# Assets Guidelines

This directory houses static visual assets for Faazio, including brand logos and onboarding illustrations.

## 📦 Asset Catalog
- `logo.svg`: Official Faazio corporate logo.
- `wellcome_illustration_1.png` to `4.png`: High-fidelity vector renders for onboarding steps.
- `phone_auth_background.png`: Premium visual backdrop for the phone auth screen.
- `location_access_page.png`: Map pin request graphic.

## 🛠️ Performance & Maintenance
- **Auto-Update Directive**: If any image asset is modified or renamed, verify and update its corresponding static import declaration inside `/src/App.tsx`.
- **Preloading**: All images registered in this directory MUST be added to the preloading queue inside `/src/App.tsx`'s initial mount effect to avoid visual flashing.
- **Reference**: Keep files small, compressed, and web-ready (SVG or WebP/PNG-8 format).
