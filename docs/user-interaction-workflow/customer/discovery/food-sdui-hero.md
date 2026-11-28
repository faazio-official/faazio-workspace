# Food home — SDUI hero + themed header

**App / route:** customer · FoodStack `FoodHome`
(`features/food/screens/FoodHomeScreen.tsx`, `features/food/sdui/*`)
**Status:** Shipped (renderer live for `food`/`home`; config for other verticals still code-defined)
**Trigger:** opening the Food app (`Home → FoodApp`).

## Steps

1. `FoodHomeScreen` reads the customer's district from `useServiceabilityStore`
   (`districtCode` = e.g. `CHN`; null → PAN_INDIA).
2. `useSduiScreenLayout('food', 'home', districtCode)` calls
   `GatewayClient.getSduiLayout` → `GET /sdui/layout?vertical=food&screen=home&district_id=…`,
   validates the schema-1.2 shape and stores the server clock offset
   (`server_timestamp_utc − Date.now()`).
3. Layout present → the header renders its `header_theme`
   (`background_hex` / `search_bar_bg_hex` / `status_bar_style`) and the `hero_banner` slot is
   filled by `SduiHeroSlot`, which owns a one-second tick against the server-adjusted clock.
4. `selectHeroWidget` picks the hero: highest priority among windows that are open; an expired
   hero with `SWAP_TO_FALLBACK` follows the pre-delivered `fallback_widget_id` chain (no extra
   network call); `LOCK_OVERLAY` keeps it so the banner dims itself with "Offer ended" and
   disables the tap; a not-yet-started hero never blocks a live one.
5. Tap: only `faazio://food/offers/<CODE>` resolves (`resolveHeroTarget`) → root stack `Cart`
   with `couponCode`, the one surface that applies a coupon. Any other action type/route
   renders **no CTA** (no dead button).
6. No layout, no renderable hero, or a failed fetch → the screen keeps its own paid hero
   (`CampaignHero` `FOOD_HERO` → `FoodHouseHero` fallback) and an untinted header.

## State

- `useServiceabilityStore` — `districtCode` / `districtName` (district targeting + header label).
- `features/food/sdui/useSduiScreenLayout` — layout, clock offset, error (local hook state).
- `useFoodFilterStore` — unaffected: rails below the hero keep their filters.

## Data path

- `GET /sdui/layout` → `admins.sdui_layout_pointers` → `admins.sdui_layout_versions`
  (`0148`), served through Valkey `sdui:screen:{vertical}:{screen}:{district}` (60 s).
- Publish / rollback in the portal flushes that key prefix, so the next fetch serves the new pointer.

## Success / error / empty

- **Success:** themed header + scheduled hero, countdown from the server clock (device clock is
  never trusted).
- **Expired with fallback:** cross-fades to the fallback hero already in the payload.
- **Expired with lock:** dim overlay, "Offer ended", tap disabled; the coupon is likewise
  rejected server-side at checkout.
- **Error / no layout:** paid hero path above; the layout failure is never surfaced as an error
  screen, and no fixture layout is substituted.

## Known gaps

- Only the `food`/`home` screen is mounted; `mart`, `grocery`, `pharma` home screens still render
  their code-defined heroes.
- `faazio://food/offers/<CODE>` lands on the central Cart (empty-cart state if the cart has no
  items); there is no dedicated food offers screen yet.
- Lottie / micro-MP4 media are accepted by the schema, but the banner renders the static
  `fallback_image_url`/`image` until `lottie-react-native` is added to the shell.

## Linked docs

- [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md)
- `docs/architecture/monolith-breakdown.md` (§1 SDUI control plane)
- `docs/architecture/db-schema.md` §12.50
- `docs/architecture/caching-cloudflare-valkey.md` §5
