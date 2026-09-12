/**
 * @static Rewards program rules — enterprise-controlled tunable constants.
 * These drive the local FaazioCoins + streak logic in `client/mobile` until the
 * Go Chi backend (server/) issues server-side balances. See data/DATA_CONTROL.md.
 */

/** Rupees spent on a paid order to earn a single FaazioCoin. */
export const COIN_EARN_RATE = 1000;
/** Coins required per ₹1 of redemption value (redemption is in whole rupees). */
export const COIN_REDEEM_RATE = 100;
/** Consecutive order-days required to grant the 10% discount card. */
export const STREAK_TARGET_DAYS = 7;
/** Percent discount granted by the completed-streak Faazio discount card. */
export const DISCOUNT_CARD_PERCENT = 10;
/** How long a granted discount card stays valid (days from grant). */
export const DISCOUNT_CARD_VALIDITY_DAYS = 5;
/** Smallest redemption unit in coins (keeps redemptions to whole rupees). */
export const COIN_REDEEM_MIN = COIN_REDEEM_RATE;

/** A granted streak-reward discount card. */
export interface FaazioDiscountCard {
  id: string;
  percent: number;
  /** ISO timestamp when the card was granted. */
  grantedAt: string;
  /** ISO timestamp after which the card is no longer valid. */
  expiresAt: string;
}
