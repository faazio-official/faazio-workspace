import {
  COIN_EARN_RATE,
  COIN_REDEEM_RATE,
  DISCOUNT_CARD_VALIDITY_DAYS,
} from '@data/rewards/rewards';
import type { FaazioDiscountCard } from '@data/rewards/rewards';

/** Local calendar date as 'YYYY-MM-DD' (machine-format, offset-corrected). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Number of whole calendar days from `a` to `b` (b - a), signed. */
export function daysBetween(aKey: string, bKey: string): number {
  const a = new Date(`${aKey}T00:00:00`);
  const b = new Date(`${bKey}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Computes the new streak count after an order lands on `today`.
 * - Same day as last order → unchanged (one streak day per calendar day).
 * - Exactly yesterday → +1 (consecutive days maintained).
 * - Any longer gap (or no previous day) → reset to 1 (a missed day kills the cycle).
 */
export function evaluateStreak(lastOrderDay: string | null, today: string): number {
  if (lastOrderDay === null) return 1;
  const gap = daysBetween(lastOrderDay, today);
  if (gap === 0) return 0; // no change — caller keeps the existing count
  if (gap === 1) return 1; // +1 — caller adds to the existing count
  return -1; // hard reset — caller sets streak to 1
}

/** Rupees of redemption value a coin balance can cover (floored to whole rupees). */
export function computeRedeemableRupees(coins: number): number {
  return Math.floor(coins / COIN_REDEEM_RATE);
}

/** True when the card exists and has not expired yet. */
export function isCardActive(card: FaazioDiscountCard | null, now: Date): boolean {
  if (!card) return false;
  return new Date(card.expiresAt).getTime() > now.getTime();
}

/** Coins earned for a given paid order total (floor of total / earn rate). */
export function coinsEarnedFor(orderTotal: number): number {
  return Math.floor(orderTotal / COIN_EARN_RATE);
}

/** Coins needed to redeem a whole-rupee amount. */
export function coinsForRedemption(rupees: number): number {
  return rupees * COIN_REDEEM_RATE;
}

/** Helper to build an expiry timestamp for a freshly granted card. */
export function cardExpiryFrom(grantedAt: Date): Date {
  const expiry = new Date(grantedAt);
  expiry.setDate(expiry.getDate() + DISCOUNT_CARD_VALIDITY_DAYS);
  return expiry;
}
