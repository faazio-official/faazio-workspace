# Add to cart

**App / route:** customer · product cards, PDP, sponsored rails, `Cart` / Cart tab
**Status:** Shipped
**Trigger:** Tapping "Add" on a product card or PDP, or +/- on a cart line.

## Steps

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
- `useAuthStore` — cart writes require a session.

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
- `SubAppWrapper` has an unreachable fallback "Checkout" button with no `onPress`
  (`components/SubAppWrapper.tsx`). See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (cart store)
- `docs/architecture/monolith-breakdown.md` (cart/stock row)
