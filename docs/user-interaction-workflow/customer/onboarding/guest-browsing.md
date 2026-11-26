# Guest browsing (no account)

**App / routes:** customer · `Onboarding` → `MainTabs`, `Login` (skip), `Location` (optional)
**Status:** Partial (guest cart is in-memory; it merges on sign-in but is not persisted across app restarts)
**Trigger:** Cold start with no session (after onboarding has been seen), **Skip** on the
onboarding carousel, **Skip** on the login screen, sign-out, or a revoked session.

## Why

App Store Review Guideline 5.1.1(v) forbids requiring registration before a user can access
features that are not account-based. Browsing the catalogue, searching, viewing menus and adding
items to a cart are not account-based, so they are open to guests. Only checkout, orders,
favourites, rewards, wallet and prescription upload ask for an account.

## Steps

1. `AppNavigator` chooses the signed-out initial route: `MainTabs` when
   `useOnboardingStore.hasSeenOnboarding` is true, else `Onboarding` (`AppNavigator.tsx`). A
   signed-out user is never held on a login screen.
2. **Onboarding Skip** marks onboarding seen and resets the root stack to `MainTabs`. **Get
   Started** still opens `Login` for a user who wants an account; the login screen keeps a visible
   **Skip** action.
3. **Login Skip** (`Browse as guest`) marks onboarding seen, clears any pending gated action and
   returns to `MainTabs` (or closes the pushed login screen and returns to the screen that opened
   it).
4. The guest browses the public surfaces: Home SDUI (`GET /sdui/home`), Mart/Food/Pharma feeds,
   category drill-in, store pages, search, product detail, deals and the public coupons list. These
   endpoints need no bearer token.
5. **Location is optional.** `useLiveLocation` performs only a silent fix when permission was
   already granted (never prompts on launch). The Home header shows "Set your location"; a guest can
   open `Location`, allow GPS or pick an area, and continue to the catalogue. The `Location` screen
   skips the authenticated serviceability check for guests and offers **Browse without a location**.
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
   Registration is not needed to keep browsing: the guest can close the login screen at any time.
8. After a successful resume sign-in, `LoginScreen` closes back to the origin screen and runs the
   pending action. `hydrateUserStores()` merges the device-local guest cart into the account's
   server cart before the authoritative `GET /cart` hydrate, so the lines the guest picked survive
   the sign-in.

## State

- `useAuthStore` — `isAuthenticated` decides guest vs account surfaces.
- `useCartStore` — signed-out mutations are device-local; signed-in mutations hit `inventory.carts`.
- `useFavoriteStore` — guest toggles are gated in the UI; the store refuses unauthenticated writes.
- `useOnboardingStore` — Skip / Browse-as-guest marks onboarding seen.
- `src/services/authGate.ts` — pending gated action + `openSignIn` / `runAuthGate`.
- `useLocationStore` — optional guest origin.

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
