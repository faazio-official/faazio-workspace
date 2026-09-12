import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  COIN_REDEEM_RATE,
  STREAK_TARGET_DAYS,
  DISCOUNT_CARD_PERCENT,
} from '@data/rewards/rewards';
import type { FaazioDiscountCard } from '@data/rewards/rewards';
import {
  toDateKey,
  evaluateStreak,
  coinsEarnedFor,
  isCardActive,
  cardExpiryFrom,
} from '@/features/rewards/rewardsLogic';

const STORAGE_KEY = 'faazio/rewards/v1';
/** Ledger is capped to keep the persisted blob small and render cheap. */
const LEDGER_CAP = 50;
/** Mock seed (demo) — shown on fresh install until real orders override it. */
const SEED_COIN_BALANCE = 245;
const SEED_STREAK_COUNT = 5;

export type RewardLedgerType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'STREAK';

export interface RewardLedgerEntry {
  id: string;
  type: RewardLedgerType;
  /** Coins delta (positive = earned, negative = spent/expired). */
  coins: number;
  /** Rupees value at redemption/expiry (0 for pure-earn entries). */
  rupees: number;
  /** Order id this entry is tied to (never any PII). */
  orderId?: string;
  at: string;
}

interface PersistedBlob {
  coinBalance?: number;
  streakCount?: number;
  lastOrderDay?: string | null;
  discountCard?: FaazioDiscountCard | null;
  ledger?: RewardLedgerEntry[];
}

const persist = (blob: PersistedBlob) => {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(blob)).catch(() => {
    // Best-effort device-local state; failures are silent and never logged (PII rule).
  });
};

interface RewardsState {
  coinBalance: number;
  streakCount: number;
  lastOrderDay: string | null;
  discountCard: FaazioDiscountCard | null;
  ledger: RewardLedgerEntry[];
  hydrated: boolean;
  /**
   * Records an order that just completed. `orderTotal` is the *paid* amount
   * (post coin-redemption and post coupon), so users can't farm coins by
   * paying with coins. `coinsRedeemed` is how many coins this order used.
   * `today` defaults to the device's local date but is injectable for tests.
   */
  recordOrder: (orderTotal: number, coinsRedeemed: number, orderId: string, today?: Date) => void;
  /** Redeems whole-rupee amounts of coins (validated by the caller). */
  redeemCoins: (coins: number, orderId: string, rupees: number) => void;
  /** Pure check invoked at read time: nulls the card if it has expired. */
  expireStaleCard: (now?: Date) => void;
  reset: () => void;
}

const pushLedger = (ledger: RewardLedgerEntry[], entry: RewardLedgerEntry): RewardLedgerEntry[] => {
  const next = [entry, ...ledger];
  return next.length > LEDGER_CAP ? next.slice(0, LEDGER_CAP) : next;
};

export const useRewardsStore = create<RewardsState>()((set, get) => ({
  coinBalance: SEED_COIN_BALANCE,
  streakCount: SEED_STREAK_COUNT,
  lastOrderDay: null,
  discountCard: null,
  ledger: [],
  hydrated: false,

  recordOrder: (orderTotal, coinsRedeemed, orderId, today = new Date()) => {
    const state = get();
    const todayKey = toDateKey(today);

    // 1. Earn coins on the paid amount.
    const earned = coinsEarnedFor(Math.max(0, orderTotal));
    const earnedBalance = state.coinBalance + earned;

    // 2. Streak evaluation (calendar-date based).
    const evalResult = evaluateStreak(state.lastOrderDay, todayKey);
    let streakCount = state.streakCount;
    let streakChanged = false;
    if (state.lastOrderDay === todayKey) {
      // Same calendar day — streak unchanged (counts once per day).
      streakChanged = false;
    } else if (evalResult === 1) {
      streakCount = state.streakCount + 1;
      streakChanged = true;
    } else {
      // First-ever order or a missed day — (re)start the streak at 1.
      streakCount = 1;
      streakChanged = true;
    }

    const ledger = [...state.ledger];

    // 3. Grant the discount card at the streak target, then reset the cycle.
    let discountCard = state.discountCard;
    if (streakChanged && streakCount >= STREAK_TARGET_DAYS) {
      const nowIso = today.toISOString();
      discountCard = {
        id: `card-${Math.random().toString(36).substring(2, 10)}`,
        percent: DISCOUNT_CARD_PERCENT,
        grantedAt: nowIso,
        expiresAt: cardExpiryFrom(today).toISOString(),
      };
      ledger.unshift({
        id: Math.random().toString(36).substring(2, 10),
        type: 'STREAK',
        coins: 0,
        rupees: 0,
        orderId,
        at: nowIso,
      });
      streakCount = 0;
    }

    // 4. Deduct redeemed coins.
    if (coinsRedeemed > 0) {
      ledger.unshift({
        id: Math.random().toString(36).substring(2, 10),
        type: 'REDEEM',
        coins: -coinsRedeemed,
        rupees: Math.floor(coinsRedeemed / COIN_REDEEM_RATE),
        orderId,
        at: today.toISOString(),
      });
    }

    // Earn entry.
    if (earned > 0) {
      ledger.unshift({
        id: Math.random().toString(36).substring(2, 10),
        type: 'EARN',
        coins: earned,
        rupees: 0,
        orderId,
        at: today.toISOString(),
      });
    }

    const cappedLedger = ledger.slice(0, LEDGER_CAP);
    const next = {
      coinBalance: earnedBalance - coinsRedeemed,
      streakCount,
      lastOrderDay: todayKey,
      discountCard,
      ledger: cappedLedger,
    };
    set(next);
    persist(next);
  },

  redeemCoins: (coins, orderId, rupees) => {
    const state = get();
    if (coins <= 0 || coins > state.coinBalance) return;
    const next = {
      coinBalance: state.coinBalance - coins,
      ledger: pushLedger(state.ledger, {
        id: Math.random().toString(36).substring(2, 10),
        type: 'REDEEM' as const,
        coins: -coins,
        rupees,
        orderId,
        at: new Date().toISOString(),
      }),
    };
    set(next);
    persist(next);
  },

  expireStaleCard: (now = new Date()) => {
    const state = get();
    if (!state.discountCard || isCardActive(state.discountCard, now)) return;
    const next = {
      discountCard: null,
      ledger: pushLedger(state.ledger, {
        id: Math.random().toString(36).substring(2, 10),
        type: 'EXPIRE' as const,
        coins: 0,
        rupees: 0,
        at: now.toISOString(),
      }),
    };
    set(next);
    persist(next);
  },

  reset: () => {
    const empty = {
      coinBalance: 0,
      streakCount: 0,
      lastOrderDay: null,
      discountCard: null,
      ledger: [],
    };
    set(empty);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

// Hydrate at store creation (fire-and-forget, bloodDonorStore-style).
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedBlob;
    useRewardsStore.setState({
      coinBalance: parsed.coinBalance ?? SEED_COIN_BALANCE,
      streakCount: parsed.streakCount ?? SEED_STREAK_COUNT,
      lastOrderDay: parsed.lastOrderDay ?? null,
      discountCard: parsed.discountCard ?? null,
      ledger: parsed.ledger ?? [],
    });
  })
  .catch(() => {})
  .finally(() => {
    useRewardsStore.setState({ hydrated: true });
    // A stale card is cleared on hydration so the account screen never shows it.
    useRewardsStore.getState().expireStaleCard();
  });
