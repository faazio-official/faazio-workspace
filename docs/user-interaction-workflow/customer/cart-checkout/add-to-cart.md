# Add to cart

**App / route:** customer · product cards, PDP, sponsored rails, `Cart` / Cart tab
**Status:** Shipped (guest adds are device-local)
**Trigger:** Tapping the card "Add" pill (or PDP CTA), or +/− on a cart line.

## Steps

0. **Card affordance.** Product cards use the shared `AddToCartControl`
   (`src/components/shared/AddToCartControl.tsx`): a sentence-case **Add** pill that, once the line
   exists (`quantity > 0`), cross-fades + scales into a **`− qty +`** stepper in the same footprint —
   the price row never reflows. The count is the live cart quantity, so the card updates in place on
   every tap; Reduce Motion swaps the two states instantly. It is mounted on every non-ad product
   card: Mart grids and home rails, the Home 3-up grids and rails, the Pharma popular / quick-reorder
   / category cards, the Food menu and search dish cards, and the dense search rows. Card body order
   is unit + **Add** on one line directly under the image, then price, then name. Paid placements
   (`AdProductCard`, sponsored rail) keep their ad treatment and no shopper add action.
0a. **Guests:** the cart is device-local. `useCartStore` skips the auth-scoped `/cart` writes while
   `isAuthenticated` is false, so the optimistic line stays instead of rolling back on a 401. The
   lines merge into the account when the guest signs in (`hydrateUserStores()`).
1. The card/PDP calls `useCartStore.addToCart(id, name, price, iconKey, restaurantId?)`. The fourth
   argument is a semantic `EnterpriseIcon` key (`dining`, `pharma`, `mart`, …) for screen-sourced
   items; server/catalog products still pass their legacy emoji, which `EnterpriseIcon` resolves
   through its alias table.
2. **Food dish with approved add-ons:** the restaurant menu/profile "Add" first calls
   `gateway.getDishAddons(venueId, dishId)` (`GET /venues/{venueId}/menu/{dishId}/addons`). If the
   dish has no ACTIVE linked add-ons (or the read is offline) it adds directly, exactly as before.
   Otherwise it opens `AddonPickerSheet` (multi-select, shows `name`, `groupName`, ₹ price). Confirming
   calls `addToCart(id, name, price, emoji, restaurantId, addonIds, addonPrice, addonSummary)` so the
   line carries the selected extras.
3. The store optimistically updates the visible cart, including `addonPrice` in the line total.
4. It awaits `gateway.addToCart(productId, qty, addonIds, addonPrice, addonSummary)` (`POST
   /cart/items`) or `gateway.updateCartItem(...)` (`PUT /cart/items`) for an existing line. The
   gateway stores the add-on ids/price/summary as display hints on `inventory.carts`; the cart POST
   never prices an order.
5. On failure the optimistic change rolls back and `syncError` is set.
6. `hydrate()` pulls the server cart (including the add-on hints) and rejoins catalog details at
   login/cold start.
7. `removeCartItem` (`DELETE /cart/items/{productId}`) removes a line.
8. The cart line renders `+ <addonSummary>` under the dish name; `computeTotals` adds
   `addonPrice × qty` to the subtotal. Checkout re-validates every add-on and snapshots it into
   `checkout.order_item_addons`.

## State

- `useCartStore` (`src/state/cartStore.ts`) — items, qty, totals, restaurant tagging, add-on
  `addonIds`/`addonPrice`/`addonSummary`, `syncError`.
- `useAuthStore` — signed-in cart writes sync to the server; guest writes stay on the device.

## Data path

- `gateway.getCart()` → `GET /cart` → `inventory.carts`.
- `gateway.addToCart` → `POST /cart/items` → `inventory.carts`.
- `gateway.updateCartItem` → `PUT /cart/items` → `inventory.carts`.
- `gateway.removeCartItem` → `DELETE /cart/items/{productId}` → `inventory.carts`.
- `gateway.getDishAddons` → `GET /venues/{venueId}/menu/{dishId}/addons` → `directory.addons` joined
  `directory.menu_addon_links` (ACTIVE + enabled only).
- Product details for hydration: `POST /products/batch`.
- `POST/PUT` **set** the absolute quantity; they do not increment.

## Success / error / empty

- **Success:** optimistic line remains; server cart matches.
- **Error:** rollback + `syncError`; the UI never keeps an unconfirmed line silently.
- **Empty:** removing the last line shows the empty cart state.

## Known gaps

- The Food **search result** dish card and the shared product-detail view still add directly without
  opening the add-on sheet; the picker is wired on the restaurant menu + restaurant profile, where
  dish → venue is known. Add-ons remain optional (a dish with extras can still be added directly from
  search, just without extras).

## Linked docs

- `docs/architecture/mobile-app.md` (cart store)
- `docs/architecture/monolith-breakdown.md` (cart/stock row)
