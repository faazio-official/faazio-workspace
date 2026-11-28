# Rewards ledger (FaazioCoins)

**App / route:** customer · `FaazioRewards` (`features/rewards/FaazioRewardsScreen.tsx`)
**Status:** Shipped (server-authoritative)
**Trigger:** Profile → Faazio Rewards, or post-checkout reconcile. Account-bound: guests do not see the rewards entry point; the rewards card is hidden on the guest account page.

## Steps

1. `useRewardsStore.reconcile()` calls `gateway.getRewards()` (`GET /rewards`).
2. The server returns coins, streak, discount card, and a capped ledger.
3. AsyncStorage `faazio/rewards/v1` is a **read-through cache only**; it never overwrites a fresher
   server reconcile (race-guarded).
4. Coins are earned **inside the checkout order transaction**; there is no client earn/redeem path.
5. Redemption is validated against the server-held balance during `POST /orders`; an over-balance
   redemption is rejected with `400 insufficient_coins`.
6. Streak milestones (`STREAK_MILESTONES` in `data/rewards/rewards.ts`) are a run of consecutive
   order-days: **5% off at day 6**, **10% off at day 7** (`STREAK_TARGET_DAYS`). The account streak
   card labels the 6th and 7th flame with those percentages and heads with the unlocked milestone,
   or the next one while climbing (`rewardsLogic.unlockedStreakPercent`/`nextStreakPercent`).
   The card grant itself still fires only on the completed 7-day streak — the day-6 tier is
   presentation today; the cart coupon stays `DISCOUNT_CARD_PERCENT` (10).

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
