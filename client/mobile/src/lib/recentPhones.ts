import AsyncStorage from '@react-native-async-storage/async-storage';
import { toE164 } from '@/lib/phone';

/**
 * Device-local MRU list of phone numbers used to sign in, so a returning rider/shopper can tap a
 * suggestion instead of re-typing. Stored as E.164 (`+CC...`) under a single AsyncStorage key.
 *
 * Privacy: this is a suggestion list only — it is App-Functionality data, never logged, never sent
 * to the gateway, and cleared on sign-out (`useAuthStore.logout`). A shared device never leaks the
 * previous user's number after an explicit logout.
 */
const STORAGE_KEY = 'faazio:recentPhones';
const MAX_RECENT = 5;

let cache: string[] | null = null;
let writeChain: Promise<void> = Promise.resolve();

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

async function read(): Promise<string[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = [];
      return cache;
    }
    const parsed: unknown = JSON.parse(raw);
    cache = isStringArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    // Best-effort device-local state; a corrupt/unavailable store degrades to "no suggestions".
    cache = [];
  }
  return cache;
}

function persist(next: string[]): void {
  cache = next;
  // Serialize writes so two rapid saves can never interleave a stale read-modify-write.
  writeChain = writeChain
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)))
    .catch(() => {});
}

/** Most-recent-first E.164 list, at most `MAX_RECENT` entries. Empty when nothing is stored. */
export async function getRecentPhones(): Promise<string[]> {
  const list = await read();
  return [...list];
}

/** Promote a phone (any input form) to the top of the MRU list, deduped and capped. */
export async function saveRecentPhone(e164: string): Promise<void> {
  const normalized = toE164(e164);
  if (!normalized) return;
  const current = await read();
  const next = [normalized, ...current.filter((entry) => entry !== normalized)].slice(0, MAX_RECENT);
  persist(next);
}

/** Drop a single number from the suggestion list (no-op when it is not present). */
export async function removeRecentPhone(e164: string): Promise<void> {
  const normalized = toE164(e164);
  const current = await read();
  const next = current.filter((entry) => entry !== normalized);
  if (next.length === current.length) return;
  persist(next);
}

/** Forget every remembered number (sign-out / account deletion). */
export async function clearRecentPhones(): Promise<void> {
  cache = [];
  writeChain = writeChain
    .then(() => AsyncStorage.removeItem(STORAGE_KEY))
    .catch(() => {});
}
