import { Platform } from 'react-native';
import { APP_VERSION, GATEWAY_URL, USE_GATEWAY } from '@/lib/config';

// Fire-and-forget client error reporting to gateway `POST /errors` (ops.error_events). The message
// is a PII-free diagnostic by contract (screen/action/error text — never tokens, keys or order
// payloads). Rate-limited per unique message so a flapping endpoint cannot spam the sink.

const MIN_INTERVAL_MS = 60_000;
const MAX_LEN = 1000;

const lastSentAt = new Map<string, number>();

/** Reports a load failure the user chose to flag. Returns true when the gateway accepted it. */
export async function reportIssue(message: string, context?: string): Promise<boolean> {
  if (!GATEWAY_URL || !USE_GATEWAY) return false;
  const detail = context ? `${message} — ${context}` : message;
  if (!detail.trim()) return false;
  const key = detail;
  const now = Date.now();
  if ((lastSentAt.get(key) ?? 0) > now - MIN_INTERVAL_MS) return false;
  lastSentAt.set(key, now);

  try {
    const res = await fetch(`${GATEWAY_URL}/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appVariant: 'customer',
        release: APP_VERSION,
        message: detail.trim().slice(0, MAX_LEN),
        stack: `${Platform.OS} ${Platform.Version}`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}