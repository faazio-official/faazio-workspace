# Rewards ledger (FaazioCoins)

**App / route:** customer · `FaazioRewards` (`features/rewards/FaazioRewardsScreen.tsx`)
**Status:** Shipped (server-authoritative)
**Trigger:** Profile → Faazio Rewards, or post-checkout reconcile.

## Steps

1. `useRewardsStore.reconcile()` calls `gateway.getRewards()` (`GET /rewards`).
2. The server returns coins, streak, discount card, and a capped ledger.
3. AsyncStorage `faazio/rewards/v1` is a **read-through cache only**; it never overwrites a fresher
   server reconcile (race-guarded).
4. Coins are earned **inside the checkout order transaction**; there is no client earn/redeem path.
5. Redemption is validated against the server-held balance during `POST /orders`; an over-balance
   redemption is rejected with `400 insufficient_coins`.

## State

- `useRewardsStore` (`src/state/rewardsStore.ts`) — balance/streak/card/ledger, `reconcile()`,
  reset on logout.

## Data path

- `gateway.getRewards()` → `GET /rewards` → `rewards.balances`, `rewards.ledger`, `rewards.rates`.
- Cache: `faazio:v1:rewards:view:{userId}` 60 s; never edge-cached.
- No seeded 245-coin/5-streak fiction; the old fixture is gone.

## Success / error / empty

- **Success:** server balance + capped ledger.
- **Error/offline:** cached read-through value, clearly not a new earn; reconcile retries.
- **Empty:** zero-balance state with no fabricated history.

## Known gaps

- None specific.

## Linked docs

- `docs/architecture/mobile-app.md` (rewards store)
- `docs/architecture/monolith-breakdown.md` (rewards row)
- `data/DATA_CONTROL.md` (`@data/rewards` is `@static` constants only)
