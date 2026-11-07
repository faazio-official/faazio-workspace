# Add to cart

**App / route:** customer · product cards, PDP, sponsored rails, `Cart` / Cart tab
**Status:** Shipped
**Trigger:** Tapping "Add" on a product card or PDP, or +/- on a cart line.

## Steps

1. The card/PDP calls `useCartStore.addToCart(id, name, price, emoji, restaurantId?)`.
2. The store optimistically updates the visible cart.
3. It awaits `gateway.addToCart(productId, qty)` (`POST /cart/items`) or
   `gateway.updateCartItem(productId, qty)` (`PUT /cart/items`) for an existing line.
4. On failure the optimistic change rolls back and `syncError` is set.
5. `hydrate()` pulls the server cart and rejoins catalog details at login/cold start.
6. `removeCartItem` (`DELETE /cart/items/{productId}`) removes a line.

## State

- `useCartStore` (`src/state/cartStore.ts`) — items, qty, totals, restaurant tagging, `syncError`.
- `useAuthStore` — cart writes require a session.

## Data path

- `gateway.getCart()` → `GET /cart` → `inventory.carts`.
- `gateway.addToCart` → `POST /cart/items` → `inventory.carts`.
- `gateway.updateCartItem` → `PUT /cart/items` → `inventory.carts`.
- `gateway.removeCartItem` → `DELETE /cart/items/{productId}` → `inventory.carts`.
- Product details for hydration: `POST /products/batch`.
- `POST/PUT` **set** the absolute quantity; they do not increment.

## Success / error / empty

- **Success:** optimistic line remains; server cart matches.
- **Error:** rollback + `syncError`; the UI never keeps an unconfirmed line silently.
- **Empty:** removing the last line shows the empty cart state.

## Known gaps

- `SubAppWrapper` has an unreachable fallback "Checkout" button with no `onPress`
  (`components/SubAppWrapper.tsx`). See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (cart store)
- `docs/architecture/monolith-breakdown.md` (cart/stock row)
