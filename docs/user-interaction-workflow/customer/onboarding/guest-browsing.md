# Guest browsing (no account)

**App / routes:** customer · `Onboarding` → `Login` → `Location` (required) → `MainTabs`
**Status:** Partial (guest cart is in-memory; it merges on sign-in but is not persisted across app restarts)
**Trigger:** Skipping phone auth (**Skip** on the login phone/OTP step) and confirming a location,
sign-out, or a revoked session.

## Why

App Store Review Guideline 5.1.1(v) forbids requiring registration before a user can access
features that are not account-based. Browsing the catalogue, searching, viewing menus and adding
items to a cart are not account-based, so they are open to guests. Only checkout, orders,
favourites, rewards, wallet and prescription upload ask for an account. A delivery origin *is*
required before the catalogue, because stores, fees and delivery times depend on it.

## Steps

1. `AppNavigator` chooses the signed-out initial route from `useOnboardingStore.hasSeenOnboarding`
   and the persisted funnel stage `useAuthFunnelStore.stage` (`faazio:funnel:stage`):
   `Onboarding` (first run) → `Login` (`auth`) → `Location` (`location`) → `MainTabs` (`home`, or
   no stage stored — returning guests from before the funnel keep the catalogue).
2. **Onboarding Skip** and **Get Started** both mark onboarding seen and reset the stack to `Login`
   (stage `auth`). The carousel never jumps to `MainTabs`.
3. **Login Skip** (phone step and OTP step, top-right) marks onboarding seen, clears any pending
   gated action, sets stage `location` and resets the stack to `Location`. The name step has no
   skip. A login pushed by an account-bound action (`resume: true`) shows a close **X** instead of
   Skip and returns to the screen that opened it.
4. **Location is required.** The picker has no close button and no "Browse without a location";
   the guest allows GPS or picks an area. A confirmed origin sets stage `home` and navigates to
   `MainTabs`; the authenticated serviceability check is skipped for guests.
5. The guest browses the public surfaces: Home SDUI (`GET /sdui/home`), Mart/Food/Pharma feeds,
   category drill-in, store pages, search, product detail, deals and the public coupons list. These
   endpoints need no bearer token.
6. **Cart works for guests and stays on the device.** `/cart` is auth-scoped, so `useCartStore`
   skips every server write while signed out. Add / remove / quantity changes are applied to the
   local array only.
7. **Account-bound actions open the login screen instead of a 401.** The shared `runAuthGate`
   helper (`src/services/authGate.ts`) stores the triggering action and pushes `Login` with
   `{ resume: true }`:
   - Cart **Continue** (BAG → PAYMENT) and `handlePlaceOrder` (defence in depth).
   - Favourites tab / pushed favourites page and every heart button (search cards, food favourite
     button, product detail).
   - Prescription upload (Pharma FAB, medical-shop FAB, Rx product detail).
   - Orders, rewards, wallet, notifications and saved addresses are not rendered as live data in
     the guest account page: the "You" tab shows a sign-in card plus Orders / Favourites /
     FaazioCoins rows, and tapping one opens `Login` with that destination as the pending action.
   Registration is not needed to keep browsing: the guest can close the pushed login screen.
8. After a successful resume sign-in, `LoginScreen` closes back to the origin screen and runs the
   pending action. `hydrateUserStores()` merges the device-local guest cart into the account's
   server cart before the authoritative `GET /cart` hydrate, so the lines the guest picked survive
   the sign-in.
9. **App closed mid-funnel:** reopening resumes the stored stage — the phone-auth screen after the
   welcome was skipped (including a name typed but not submitted: no session is written until the
   name saves), or the location picker after phone auth was skipped.

## State

- `useAuthStore` — `isAuthenticated` decides guest vs account surfaces.
- `useCartStore` — signed-out mutations are device-local; signed-in mutations hit `inventory.carts`.
- `useFavoriteStore` — guest toggles are gated in the UI; the store refuses unauthenticated writes.
- `useOnboardingStore` — Skip marks onboarding seen.
- `useAuthFunnelStore` — persisted funnel stage (`auth` / `location` / `home`); sign-in and
  sign-out reset it to `home`.
- `src/services/authGate.ts` — pending gated action + `openSignIn` / `runAuthGate`.
- `useLocationStore` — the guest origin chosen on the required location step.

## Data path

- Public reads: `GET /sdui/home`, `/sdui/{mart,food,pharma}`, `/categories*`, `/product/{id}`,
  `/products/nearby`, `/stores/{id}/products`, `/search`, `/ads/*`, `/coupons`.
- Guest cart: no network write; local Zustand array only.
- Sign-in merge: `GET /cart`, then `PUT /cart/items` for each guest line (absolute quantity =
  server qty + guest qty), then the normal `hydrateUserStores()` reads.
- Authenticated coverage: `admins.district_master` via `useServiceabilityStore`. The hard
  `ServiceAreaBlockedPage` gate runs only for a signed-in origin; guests browse the catalogue
  regardless of area (checkout is still validated server-side against the delivery address).

## Success / error / empty

- **Success:** guest browses, builds a cart, and either checks out after a sign-in (cart merged) or
  keeps browsing.
- **Login dismissed:** the pending action is cleared on unmount; a later sign-in cannot replay a
  stale tap.
- **Empty:** an empty guest cart / empty favourites render their honest empty states.
- **Error:** public read failures show the normal retry/error states; no fixture is substituted.

## Known gaps

- The guest cart lives in memory only. It survives navigation and the sign-in merge, but an app
  kill before sign-in loses it (the signed-in cart is server-backed and unaffected).
- Guests bypass the district coverage hard gate by design so the catalogue is browsable before an
  origin/account exists; the order is still validated against the chosen delivery address.
- Order/reward/notification deep links still rely on the account page hiding their entry points;
  there is no in-screen guard on those pushed routes yet.

## Linked docs

- [phone-otp-login.md](./phone-otp-login.md)
- [location-picker.md](./location-picker.md)
- [../cart-checkout/add-to-cart.md](../cart-checkout/add-to-cart.md)
- [../cart-checkout/place-order.md](../cart-checkout/place-order.md)
- [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md)
