/**
 * iOS background heartbeat for the delivery partner.
 *
 * Android is owned by the native `FaazioDeliveryTracking` foreground service (see
 * deliveryTracking.ts). iOS has no equivalent service, so this module keeps a
 * background-enabled geolocation watch alive while the rider is online. The watch is delivered by
 * CoreLocation while the app is backgrounded (UIBackgroundModes: location) and posts a throttled
 * heartbeat whenever the rider has moved. The JS foreground interval remains the primary heartbeat
 * while the app is active; this module deliberately posts only when AppState is not active so the
 * two never race.
 *
 * Limit: if iOS terminates the app from the app switcher, the watch dies with the process. The
 * Valkey key then expires after 5 minutes and dispatch skips the rider until they reopen the app.
 */
import { AppState, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { gateway } from './api/GatewayClient';

const HEARTBEAT_MS = 120_000;

let watchId: number | null = null;
let lastSentAt = 0;

/** Start the iOS background watch. No-op on Android (the native service owns it). */
export function startIOSBackgroundLocation(): boolean {
  if (Platform.OS !== 'ios' || watchId !== null) return false;
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'always',
    enableBackgroundLocationUpdates: true,
  });
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
      enableHighAccuracy: false,
      distanceFilter: 50,
      interval: HEARTBEAT_MS,
      fastestInterval: HEARTBEAT_MS,
      maximumAge: HEARTBEAT_MS,
      timeout: 20_000,
    },
  );
  return true;
}

/** Stop the watch and reset throttling. Safe when already stopped. */
export function stopIOSBackgroundLocation(): void {
  if (watchId === null) return;
  Geolocation.clearWatch(watchId);
  watchId = null;
  lastSentAt = 0;
}
