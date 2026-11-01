# AGENTS.md — Faazio Mobile App

## Read first

**`docs/UI_DESIGN_SYSTEM.md`** (repo root) is the authority for all UI work
here, and root `AGENTS.md` carries the hard rules (imports, state, navigation,
boundaries, CI-only builds). This file only adds what is specific to the React
Native app.

## Styling

- **`StyleSheet.create` only.** There is no Tailwind and no `className` in this
  app. Do not introduce a styling library.
- Tokens live in `src/theme/`:
  - `brandTokens.ts` — per-`AppBrand` colour (accent, card, button, gradient,
    header, price, pill). This is the source of truth for brand colour.
  - `spacing.ts` — `SPACE.SECTION` / `BLOCK` / `ITEM` / `LIST_BOTTOM`, the
    canonical vertical rhythm.
  - `fonts.ts` — platform fonts only (Roboto on Android, `System` on iOS). No
    custom font module, no font-load gate.
  - `sectorVisuals.ts` — `SECTOR_VISUALS` for sector icon, fill and tint.
- **`SPACE` owns section rhythm.** A boundary has exactly one owner of its gap:
  a section header owns its top gap (`SPACE.SECTION`); its parent must not also
  add `paddingTop`/`marginTop` for the same boundary.
- Do not add a new hardcoded hex literal where a token exists. When you touch a
  screen, move its colours onto `brandTokens` or a shared token rather than
  adding another literal.

## Icons and emoji

- Icons come from `lucide-react-native`, one size and one stroke.
- **Emoji are not icons.** `src/components/EnterpriseIcon.tsx` maps emoji keys to
  lucide icons — that mapping layer is the correct pattern. Do not add new emoji
  to UI copy, labels, pills or status.

## Layout

- Full-viewport, non-scrollable (`h-[100dvh]` equivalent), no faux device
  borders or notches.
- Always render `<FaazioLogo />`, never raw text placeholders.
- Cross-sub-app access only via Home, enforced by `check:boundaries`.

## Known debt — do not big-bang it

The app still carries roughly 2,300 hardcoded hex literals across ~188 files,
and per-feature theme files that overlap `src/theme`
(`features/food/constants/theme.ts`,
`features/ecommerce/components/vendor/theme.ts`,
`features/pharma/blood-donor/tokens.ts`). Fix the screen you are already
touching; do not run a repo-wide colour sweep unless explicitly asked.

The app is **light-only today** — there is no `useTheme` equivalent. If dark
mode is added, follow the web contract in `docs/UI_DESIGN_SYSTEM.md` §7: one
token object per theme, resolved once, no per-component conditionals.

## Verify

```bash
npm run ts:check
npm run check:boundaries
```

Never run Gradle locally — builds are CI-only (see root `AGENTS.md`).
