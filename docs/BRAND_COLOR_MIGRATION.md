# BRAND COLOR MIGRATION — Royal Purple → Faazio Blue

Consolidated change log for migrating the Faazio brand accent from royal purple to
**Faazio Blue `#1162D3`**. See root `ARCHITECTURE.md` for the brand/model context.

## Reference & baseline

- **Reference blue:** `#1162D3` (existing brand blue used in MART tokens & splash spinner).
- **Baseline for revert:** clean working tree at commit `58c340a` (today's royal-purple setup).

## Color mapping (used everywhere)

| Old (purple) | New (blue) | Role |
|---|---|---|
| `#7C3AED` / `BRAND_PURPLE` / `ACCENT` / `ROYAL_PURPLE` / `BRAND.purple` | `#1162D3` | Primary accent, buttons |
| `#6D28D9` | `#1162D3` | Header gradient start |
| `#8B5CF6` | `#2F80ED` | Header gradient mid |
| `#C4B5FD` | `#7CB3FF` (gradient tail) / `#93C5FD` (star) | Light accent |
| `#EDE9FE` | `#DBEAFE` | Light fills (avatars, bubbles, icon boxes) |
| `#F5F3FF` | `#EFF6FF` | Softer fills (selected rows) |
| `rgba(109,40,217,0.12)` | `rgba(17,98,211,0.12)` | Header shadow |

## Files changed (9)

### Homepage header
1. `client/mobile/src/features/home/HubGradient.tsx` — gradient stops:
   `#6D28D9`→`#1162D3`, `#8B5CF6`→`#2F80ED`, `#C4B5FD`→`#7CB3FF` (compact + expanded headers).
2. `client/mobile/src/features/home/CompactHubHeader.tsx` — header shadow
   `rgba(109,40,217,0.12)`→`rgba(17,98,211,0.12)`.
3. `client/mobile/src/features/home/HomeTabScreen.tsx` — header shadow
   `rgba(109,40,217,0.12)`→`rgba(17,98,211,0.12)`.

### Welcome workflow
4. `client/mobile/src/features/onboarding/OnboardingScreen.tsx` — `BRAND_PURPLE`→`BRAND_BLUE = '#1162D3'`
   (cascades: subtitle, underline, dots, Next/Get-Started button, shadow).
5. `client/mobile/src/features/onboarding/LanguageSelectionScreen.tsx` —
   `ACCENT='#1162D3'`, `ACCENT_LIGHT='#DBEAFE'`, `ACCENT_SOFT='#EFF6FF'`, star `#C4B5FD`→`#93C5FD`.
6. `client/mobile/src/features/auth/LocationScreen.tsx` — title accent + Allow button `#7C3AED`→`#1162D3`.
7. `client/mobile/src/components/SplashFallback.tsx` — royal splash bg `#7C3AED`→`#1162D3` (+ docstring).

### Profile + payment
8. `client/mobile/src/features/profile/AccountView.tsx` — `ROYAL_PURPLE`→`BRAND_BLUE = '#1162D3'`
   (avatar icon, chevrons, nav icons) + light fills `#EDE9FE`→`#DBEAFE`.
9. `client/mobile/src/features/cart/payment/constants.ts` — `BRAND.purple`→`BRAND.blue = '#1162D3'`
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
  client/mobile/src/features/home/CompactHubHeader.tsx \
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
