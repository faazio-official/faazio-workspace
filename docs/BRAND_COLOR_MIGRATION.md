# BRAND COLOR MIGRATION — Royal Purple → Faazio Blue

> **Canonical definition:** Faazio Blue is defined once in
> `docs/UI_DESIGN_SYSTEM.md` §5 (Brand colour). This file is a **historical
> change log** — the blue values below record the accent applied at the time and
> are superseded for the *brand colour* definition. Do not cite this file as the
> colour authority.

Consolidated change log for migrating the Faazio brand accent from royal purple to
the brand blue. See root `ARCHITECTURE.md` for the brand/model context.

## Reference & baseline

- **Canonical brand colour:** see `docs/UI_DESIGN_SYSTEM.md` §5.
- **Accent applied at the time:** the brand accent defined in `docs/UI_DESIGN_SYSTEM.md` §5
  (MART tokens & splash spinner).
- **Baseline for revert:** clean working tree at commit `58c340a` (today's royal-purple setup).

## Color mapping (used everywhere)

| Old (purple) | New (blue) | Role |
|---|---|---|
| `#7C3AED` / `BRAND_PURPLE` / `ACCENT` / `ROYAL_PURPLE` / `BRAND.purple` | Faazio Blue (see `docs/UI_DESIGN_SYSTEM.md` §5) | Primary accent, buttons |
| `#6D28D9` | `#0000FF` | Header gradient start |
| `#8B5CF6` | `#2F80ED` | Header gradient mid |
| `#C4B5FD` | `#7CB3FF` (gradient tail) / `#93C5FD` (star) | Light accent |
| `#EDE9FE` | `#DBEAFE` | Light fills (avatars, bubbles, icon boxes) |
| `#F5F3FF` | `#EFF6FF` | Softer fills (selected rows) |
| `rgba(109,40,217,0.12)` | `rgba(17,98,211,0.12)` | Header shadow |

## Files changed (9)

### Homepage header
1. `client/mobile/src/features/home/HubGradient.tsx` — gradient stops:
   `#6D28D9`→`#0000FF`, `#8B5CF6`→`#2F80ED`, `#C4B5FD`→`#7CB3FF` (compact + expanded headers).
2. `client/mobile/src/features/home/HomeTabScreen.tsx` — header shadow
   `rgba(109,40,217,0.12)`→`rgba(17,98,211,0.12)`.

> Note: `CompactHubHeader.tsx` (a former duplicate Home header) was deleted; it is no longer part
> of the change set or the revert list below.

### Welcome workflow
4. `client/mobile/src/features/onboarding/OnboardingScreen.tsx` — `BRAND_PURPLE`→`BRAND_BLUE`
   (the brand accent, see `docs/UI_DESIGN_SYSTEM.md` §5)
   (cascades: subtitle, underline, dots, Next/Get-Started button, shadow).
5. `client/mobile/src/features/onboarding/LanguageSelectionScreen.tsx` —
   `ACCENT` = the brand accent (see `docs/UI_DESIGN_SYSTEM.md` §5),
   `ACCENT_LIGHT='#DBEAFE'`, `ACCENT_SOFT='#EFF6FF'`, star `#C4B5FD`→`#93C5FD`.
6. `client/mobile/src/features/auth/LocationScreen.tsx` — title accent + Allow button `#7C3AED`→
   the brand accent (see `docs/UI_DESIGN_SYSTEM.md` §5).
7. `client/mobile/src/components/SplashFallback.tsx` — royal splash bg `#7C3AED`→ the brand accent
   (see `docs/UI_DESIGN_SYSTEM.md` §5) (+ docstring).

### Profile + payment
8. `client/mobile/src/features/profile/AccountView.tsx` — `ROYAL_PURPLE`→`BRAND_BLUE`
   (the brand accent, see `docs/UI_DESIGN_SYSTEM.md` §5)
   (avatar icon, chevrons, nav icons) + light fills `#EDE9FE`→`#DBEAFE`.
9. `client/mobile/src/features/cart/payment/constants.ts` — `BRAND.purple`→`BRAND.blue`
   (the brand accent, see `docs/UI_DESIGN_SYSTEM.md` §5)
   (cascades to `DeliveryInfoCard.tsx` border + timeline dot).

## Kept purple intentionally (semantic category colors, not branding)

- `client/mobile/src/components/EnterpriseIcon.tsx` — 👕/🎵 icon colors.
- `client/mobile/src/components/shared/format.ts` — `bg-purple` category map.
- `data/` mock data badge colors.

These are per-category multi-color accents — turning them blue would break the category visual system.
Revisit only if a full category re-theme is wanted later.

## Revert

One-liner restores today's royal-purple setup (exact pre-migration files):

```bash
git checkout 58c340a -- \
  client/mobile/src/features/home/HubGradient.tsx \
  client/mobile/src/features/home/HomeTabScreen.tsx \
  client/mobile/src/features/onboarding/OnboardingScreen.tsx \
  client/mobile/src/features/onboarding/LanguageSelectionScreen.tsx \
  client/mobile/src/features/auth/LocationScreen.tsx \
  client/mobile/src/components/SplashFallback.tsx \
  client/mobile/src/features/profile/AccountView.tsx \
  client/mobile/src/features/cart/payment/constants.ts \
  client/mobile/src/features/cart/payment/components/DeliveryInfoCard.tsx
```

> Note: the migration renames the payment token `BRAND.purple`→`BRAND.blue`, so the
> `DeliveryInfoCard.tsx` reference is also part of the revert set above.

Alternatively revert the whole migration commit: `git revert <migration-commit-hash>`.

## Future purple-audit grep

Find any remaining royal-purple branding (should return only the intentionally-kept category colors):

```bash
cd client/mobile && grep -rniE "#7C3AED|#6D28D9|#8B5CF6|#C4B5FD|#EDE9FE|#F5F3FF|royal_purple|royal purple|BRAND_PURPLE" src/
```

## Follow-up (2026-09-10): Splash background → `#0000FF`

The cold-start splash background was changed from the then-brand accent (see
`docs/UI_DESIGN_SYSTEM.md` §5) to pure royal blue `#0000FF` (matching the native splash
configuration):

- `client/mobile/src/components/SplashFallback.tsx` — `royal` variant background
  the then-brand accent → `#0000FF` (+ docstring).

Native splash config lives in `client/mobile/android/app/src/main/res/values/colors.xml`
(`splashscreen_background`) and `styles.xml` (the splash theme), so no JS config change was needed.
The iOS launch-screen storyboard carries its own background color.

## Follow-up (2026-11-02): Splash unified on Faazio Blue + shared wordmark

The 2026-09-10 change above is **superseded**. All three splash layers now use Faazio blue
(see `docs/UI_DESIGN_SYSTEM.md` §5) and the same wide wordmark:

- **JS** — `SplashFallback.tsx` `royal` variant background is the Faazio Blue brand colour
  (see `docs/UI_DESIGN_SYSTEM.md` §5) (was `#0000FF`).
- **Android** — `splashscreen_background` was already the Faazio Blue brand colour
  (see `docs/UI_DESIGN_SYSTEM.md` §5); unchanged.
- **iOS** — `SplashScreenBackground.colorset` **and** the inline `<namedColor>` in
  `SplashScreen.storyboard` changed `#0000FF`→ the Faazio Blue brand colour
  (see `docs/UI_DESIGN_SYSTEM.md` §5). Both must be edited together: the
  storyboard carries its own literal and does not read the colorset at runtime.

All native splash logos are now generated from `client/mobile/src/assets/logo.png` by
`client/mobile/scripts/generate-splash-logo.py` — see `docs/architecture/mobile-app.md`
("Splash assets") for the mask and aspect-ratio constraints that script encodes.

## Follow-up (2026-11-08): Faazio Blue re-anchored to `#1627E9`

The brand anchor moved from the previous blue to the canonical value in
`docs/UI_DESIGN_SYSTEM.md` §5. Every code anchor and derived shade follows the
same value:

- **Web** — `--brand-blue` in `client/web/platform/src/styles.css`,
  `client/web/landingpage/src/styles.css` and
  `client/web/vite-reference/src/styles.css`; dark-theme lifts moved to hue 266.
- **Mobile** — `parentRamp.base` in `client/mobile/src/theme/brandTokens.ts`
  (`baseLift` recomputed to `#6A95FF` for the new hue).
- **Native** — Android `colors.xml` splash/icon background, iOS
  `SplashScreenBackground.colorset` and the inline colour in
  `SplashScreen.storyboard`, and the JS `SplashFallback` fallback.
- **Data/SDUI + seed** — `data/*` accents, `server/supabase/migrations/0059_app_config.sql`
  (`brand.primary_color`) and `server/supabase/seed/mongo/*`.
- **PWA/manifest + icon script** — `theme_color` in both `site.webmanifest`
  files and the first gradient stop in `generate-brand-icons.py`.

## Follow-up (2026-11-10): bitmap brand assets re-generated from `#1627E9` masters

The bitmap set still carried older blue/purple fields (for example `#434BFD` in
`logo.svg`, `#3952FB` in `icon.png`, `#204EFC`/`#2653FC` in the partner icons and
`#3952FA` in the landing favicons). All derived customer bitmaps were regenerated
from two flat `#1627E9` masters:

- `client/mobile/assets/brand/logo-square.png` — `Fa` mark.
- `client/mobile/assets/brand/logo-rectangle.png` — `Faazio` wordmark.

The delivery/seller icons keep their own `Faazio Delivery` / `Faazio Seller`
artwork and are recoloured to the same field.

Regenerated: mobile source assets (`icon.png`, `adaptive-icon.png`,
`faazio-logo.png`, `logo.png`, `logo-welcomepage.png`, `logo.svg`), customer +
delivery + seller Android mipmaps and the customer iOS app-icon set, native splash logos,
the partner colors, `client/faazio-logo.ico`, and both web favicon/PWA sets.
Scripts: `client/mobile/scripts/regenerate-icons.py`,
`client/mobile/scripts/generate-partner-icons.py`,
`client/mobile/scripts/generate-splash-logo.py` and
`client/web/platform/scripts/generate-brand-icons.py`. The brand definition
remains `docs/UI_DESIGN_SYSTEM.md` §5.
