import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FaazioDiscountCard } from '@data/rewards/rewards';
import { isCardActive } from '@/features/rewards/rewardsLogic';
import { gateway } from '@/services/api/GatewayClient';

const STORAGE_KEY = 'faazio/rewards/v1';
/** Ledger is capped to keep the persisted blob small and render cheap. */
const LEDGER_CAP = 50;
/** Set once a server reconcile wins, so a late AsyncStorage read cannot overwrite fresh balances. */
let serverReconciled = false;

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
    // Best-effort device-local cache; failures are silent and never logged (PII rule).
  });
};

/**
 * Server-authoritative rewards. `rewards.balances` + `rewards.ledger` are the money-adjacent source
 * of truth (coins are earned inside the checkout order transaction); AsyncStorage is only an
 * offline read-through cache. There is deliberately no local earn/redeem write — a client cannot
 * forge coins.
 */
interface RewardsState {
  coinBalance: number;
  streakCount: number;
  lastOrderDay: string | null;
  discountCard: FaazioDiscountCard | null;
  ledger: RewardLedgerEntry[];
  hydrated: boolean;
  syncing: boolean;
  syncError: string | null;
  /** Pure check invoked at read time: nulls the card if it has expired. */
  expireStaleCard: (now?: Date) => void;
  /** Reconcile against the server-authoritative balance (no-op unless the gateway is remote). */
  reconcile: () => Promise<void>;
  reset: () => void;
}

const pushLedger = (ledger: RewardLedgerEntry[], entry: RewardLedgerEntry): RewardLedgerEntry[] => {
  const next = [entry, ...ledger];
  return next.length > LEDGER_CAP ? next.slice(0, LEDGER_CAP) : next;
};

export const useRewardsStore = create<RewardsState>()((set, get) => ({
  coinBalance: 0,
  streakCount: 0,
  lastOrderDay: null,
  discountCard: null,
  ledger: [],
  hydrated: false,
  syncing: false,
  syncError: null,

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
    persist({
      coinBalance: state.coinBalance,
      streakCount: state.streakCount,
      lastOrderDay: state.lastOrderDay,
      discountCard: next.discountCard,
      ledger: next.ledger,
    });
  },

  reset: () => {
    serverReconciled = false;
    const empty = {
      coinBalance: 0,
      streakCount: 0,
      lastOrderDay: null,
      discountCard: null,
      ledger: [],
      hydrated: false,
      syncing: false,
      syncError: null,
    };
    set(empty);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },

  reconcile: async () => {
    // Server is the money-adjacent authority; only reconcile when actually talking to it.
    if (!gateway.remoteEnabled) {
      set({ hydrated: true });
      return;
    }
    set({ syncing: true, syncError: null });
    try {
      const view = await gateway.getRewards();
      const next = {
        coinBalance: view.coins,
        streakCount: view.streak,
        lastOrderDay: view.lastOrderDay ?? null,
        discountCard: view.card ?? null,
        ledger: view.ledger ?? [],
      };
      set({ ...next, hydrated: true });
      // A server reconcile always wins over a late AsyncStorage read (see the module-bottom
      // hydration guard) so a slow device cache can never overwrite fresh server balances.
      serverReconciled = true;
      persist(next);
    } catch {
      set({ hydrated: true, syncError: 'Could not refresh your rewards.' });
    } finally {
      set({ syncing: false });
    }
  },
}));

// Hydrate the offline cache at store creation (server reconciliation is driven by the session).
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw || serverReconciled) return;
    const parsed = JSON.parse(raw) as PersistedBlob;
    useRewardsStore.setState({
      coinBalance: parsed.coinBalance ?? 0,
      streakCount: parsed.streakCount ?? 0,
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
