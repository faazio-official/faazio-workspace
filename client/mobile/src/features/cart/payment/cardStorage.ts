/**
 * Durable "saved cards" backed by the platform Keychain/Keystore. Raw PAN/CVV are
 * NEVER stored or logged: only an opaque gateway token + last4 + expiry + network
 * that the shopper reuses for the tokenized flow.
 *
 * Service is `FaazioCardToken` (single generic-password payload holding the list),
 * matching the AGENTS.md token/storage rule. The mock-gateway posture means this is
 * a device token; a real deployment would mint it via a PCI gateway.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE = 'FaazioCardToken';
const ACCOUNT = 'cards';

const OPTIONS: Keychain.SetOptions = {
  service: SERVICE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
};

/** A tokenized saved card — never contains the PAN or CVV. */
export interface SavedCard {
  id: string;
  token: string;
  network: string;
  last4: string;
  exp: string;
}

/** Infer a display network from the IIN (first digit). */
function inferCardNetwork(digits: string): string {
  if (digits.startsWith('4')) return 'Visa';
  if (digits.startsWith('5')) return 'Mastercard';
  if (/^(34|37)/.test(digits)) return 'American Express';
  if (/^(60|65|81|82|50)/.test(digits)) return 'RuPay';
  return 'Card';
}

interface StoredCardList {
  cards: SavedCard[];
}

function validList(value: unknown): value is StoredCardList {
  return !!value && typeof value === 'object' && Array.isArray((value as StoredCardList).cards);
}

async function readList(): Promise<SavedCard[]> {
  try {
    const credentials = await Keychain.getGenericPassword({ service: SERVICE });
    if (!credentials || !credentials.password) return [];
    const parsed = JSON.parse(credentials.password) as unknown;
    return validList(parsed) ? parsed.cards : [];
  } catch {
    return [];
  }
}

async function writeList(cards: SavedCard[]): Promise<void> {
  const payload: StoredCardList = { cards };
  // Encrypted at rest by the Keychain/Keystore; PAN/CVV never appear in the payload.
  await Keychain.setGenericPassword(ACCOUNT, JSON.stringify(payload), OPTIONS);
}

/** All tokenized cards saved on this device (newest last). */
export async function loadSavedCards(): Promise<SavedCard[]> {
  return readList();
}

/** Returns a new card's token, or a zero-value `{ error }` result when invalid. */
export interface AddCardResult {
  card?: SavedCard;
  error?: string;
}

/**
 * Validates the entered card (16-digit PAN / MM/YY / 3-digit CVV / name), mints an
 * opaque token and persists only the token + last4 + expiry + network in the
 * Keychain. The PAN and CVV exist only in local form variables and are discarded
 * (never stored, never logged).
 */
export async function addCard(input: {
  cardNumber: string;
  expiry: string;
  cvv: string;
  name: string;
}): Promise<AddCardResult> {
  const digits = input.cardNumber.replace(/\D/g, '');
  if (digits.length !== 16) {
    return { error: 'Enter the 16-digit card number.' };
  }
  const expMatch = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/.exec(input.expiry.trim());
  if (!expMatch) {
    return { error: 'Use expiry in MM/YY format.' };
  }
  const exp = `${expMatch[1]}/${expMatch[2]}`;
  if (!/^\d{3}$/.test(input.cvv.trim())) {
    return { error: 'CVV must be 3 digits.' };
  }
  if (!input.name.trim()) {
    return { error: 'Enter the cardholder name.' };
  }

  const netRandom = Math.random().toString(36).slice(2, 10);
  const token = `tok_${Date.now().toString(36)}${netRandom}`;
  const card: SavedCard = {
    id: token,
    token,
    network: inferCardNetwork(digits),
    last4: digits.slice(-4),
    exp,
  };

  const cards = await readList();
  cards.push(card);
  await writeList(cards);
  return { card };
}