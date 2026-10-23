/**
 * iOS background heartbeat for the delivery partner.
 *
 * Android is owned by the native `FaazioDeliveryTracking` foreground service (see
 * deliveryTracking.ts). iOS has no equivalent service, so this module keeps a
 * background-enabled geolocation watch alive while the rider is online. The watch is delivered by
 * CoreLocation while the app is backgrounded (UIBackgroundModes: location) and posts a heartbeat
 * throttled to one request every 120 s. Coarse continuous updates (no distance filter) are used on
 * purpose: a movement-gated watch would stop firing while a rider waits at a store, letting the
 * 5 min Valkey key expire and silently dropping them from dispatch. The JS foreground interval
 * remains the primary heartbeat while the app is active; this module deliberately posts only when
 * AppState is not active so the two never race.
 *
 * Limit: if iOS terminates the app from the app switcher, the watch dies with the process. The
 * Valkey key then expires after 5 minutes and dispatch skips the rider until they reopen the app.
 */
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { gateway } from './api/GatewayClient';

const HEARTBEAT_MS = 120_000;
const CONSENT_KEY = 'faazio.delivery.iosBackgroundConsent';

let watchId: number | null = null;
let lastSentAt = 0;

/**
 * Whether this device already accepted the in-app background-location explanation. Persisting it
 * lets an already-online rider resume the watch after a cold start without re-prompting (and avoids
 * nagging riders who chose "Allow While Using" at the OS level).
 */
export async function loadIOSBackgroundConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Persist (or clear) the in-app consent. Cleared on sign-out so a new rider is asked again. */
export async function saveIOSBackgroundConsent(allowed: boolean): Promise<void> {
  try {
    if (allowed) await AsyncStorage.setItem(CONSENT_KEY, '1');
    else await AsyncStorage.removeItem(CONSENT_KEY);
  } catch {
    // Consent persistence is best-effort; the watch still works for this session.
  }
}

/**
 * Start the iOS background watch. No-op on Android (the native service owns it).
 *
 * `prompt` requests Always authorization (the consent dialog must have been shown first). Resume
 * calls pass `prompt: false` so a relaunch never surfaces an unexpected OS prompt.
 */
export function startIOSBackgroundLocation(options: { prompt?: boolean } = {}): boolean {
  if (Platform.OS !== 'ios' || watchId !== null) return false;
  const prompt = options.prompt === true;
  Geolocation.setRNConfiguration({
    skipPermissionRequests: !prompt,
    authorizationLevel: 'always',
    enableBackgroundLocationUpdates: true,
  });
  try {
    watchId = Geolocation.watchPosition(
      (position) => {
        if (AppState.currentState === 'active') return;
        const now = Date.now();
        if (now - lastSentAt < HEARTBEAT_MS) return;
        lastSentAt = now;
        void gateway
          .sendDeliveryHeartbeat(position.coords.latitude, position.coords.longitude)
          .catch(() => undefined);
      },
      () => undefined,
      {
        // 0 = no distance filter: keep receiving coarse fixes while stationary so the throttled
        // heartbeat never lets the 300 s Valkey location key lapse.
        enableHighAccuracy: false,
        distanceFilter: 0,
        interval: HEARTBEAT_MS,
        fastestInterval: HEARTBEAT_MS,
        maximumAge: HEARTBEAT_MS,
        timeout: 20_000,
      },
    );
  } catch {
    watchId = null;
    return false;
  } finally {
    if (prompt) {
      // Restore the shared location service contract (explicit permission requests only) after the
      // one-time Always prompt; the watch already holds the background authorization.
      Geolocation.setRNConfiguration({
        skipPermissionRequests: true,
        authorizationLevel: 'whenInUse',
        enableBackgroundLocationUpdates: true,
      });
    }
  }
  return true;
}

/** Stop the watch and reset throttling. Safe when already stopped. */
export function stopIOSBackgroundLocation(): void {
  if (watchId === null) return;
  Geolocation.clearWatch(watchId);
  watchId = null;
  lastSentAt = 0;
}
