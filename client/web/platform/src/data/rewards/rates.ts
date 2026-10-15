// Provenance: rewards.rates (single admin-tunable row, 0017). Defaults mirror the frozen
// @data/rewards constants (COIN_EARN_RATE=1000, COIN_REDEEM_RATE=100, streak 7, card 10%, 5 days).
import type { RewardsRates } from "@/data/types";

export const REWARDS_RATES: RewardsRates = {
  coinEarnRate: 1000,
  coinRedeemRate: 100,
  streakTargetDays: 7,
  discountCardPercent: 10,
  cardValidityDays: 5,
};