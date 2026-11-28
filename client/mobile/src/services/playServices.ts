/**
 * Google Play Services availability for the Android OTP auto-retriever.
 *
 * Firebase's SMS auto-retrieval is silently owned by Play Services. On an HMS-only Huawei phone,
 * a de-bloated/custom ROM, or any install without Google Play Services it can never run, and asking
 * it to is wasted background work. Enterprise apps therefore check availability once and treat
 * auto-fill as a bonus on top of the always-manual code form.
 *
 * The probe is kicked off from the layer-2 splash (in parallel with session hydration, never
 * awaited by it) and cached here. `resolvePlayServicesAvailability` is the bounded fallback for a
 * send that happens before the probe settled, so the OTP flow never blocks on a hung native call.
 * Every failure path resolves `unavailable`: manual code entry is the permanent path, and no OTP
 * screen ever crashes because Google is absent.
 */
import { Platform } from 'react-native';
import { getApps, getUtils } from '@react-native-firebase/app';
import { FIREBASE_AUTH_ENABLED } from '../lib/config';

export type PlayServicesAvailability = 'unknown' | 'available' | 'unavailable';

/** Upper bound for the native status call during startup; it is normally immediate. */
const PROBE_TIMEOUT_MS = 4000;
/** Upper bound for a send that arrives before the startup probe settled. */
const RESOLVE_TIMEOUT_MS = 1500;

let availability: PlayServicesAvailability = Platform.OS === 'ios' ? 'available' : 'unknown';
let probeInFlight: Promise<PlayServicesAvailability> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('play-services probe timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readAvailability(): Promise<PlayServicesAvailability> {
  if (Platform.OS !== 'android') return 'available';
  // Firebase is the OTP authority; without its native app the status call has no meaning.
  if (!FIREBASE_AUTH_ENABLED) return 'unavailable';
  if (getApps().length === 0) return 'unavailable';
  const status = await withTimeout(getUtils().getPlayServicesStatus(), PROBE_TIMEOUT_MS);
  return status?.isAvailable ? 'available' : 'unavailable';
}

/**
 * Probe Google Play Services once per process and cache the verdict. Safe to call fire-and-forget
 * from startup: every rejection is swallowed and recorded as `unavailable`.
 */
export function probePlayServicesAvailability(): Promise<PlayServicesAvailability> {
  if (Platform.OS !== 'android') return Promise.resolve('available');
  if (availability !== 'unknown') return Promise.resolve(availability);
  if (probeInFlight) return probeInFlight;

  probeInFlight = (async () => {
    try {
      availability = await readAvailability();
    } catch {
      availability = 'unavailable';
    } finally {
      probeInFlight = null;
    }
    return availability;
  })();

  return probeInFlight;
}

/** Last known verdict without waiting (may be `unknown` before the startup probe settles). */
export function getPlayServicesAvailability(): PlayServicesAvailability {
  return availability;
}

/**
 * Resolve the verdict for a caller that is about to arm the auto-retriever. Returns the cached
 * value when known; otherwise waits at most `timeoutMs` for the in-flight startup probe and falls
 * back to `unavailable` — never `available` — so Google is never assumed to exist.
 */
export async function resolvePlayServicesAvailability(
  timeoutMs: number = RESOLVE_TIMEOUT_MS,
): Promise<PlayServicesAvailability> {
  if (availability !== 'unknown') return availability;
  try {
    await withTimeout(probePlayServicesAvailability(), timeoutMs);
  } catch {
    // The probe is still running or failed; fail safe to manual entry.
  }
  return availability;
}
