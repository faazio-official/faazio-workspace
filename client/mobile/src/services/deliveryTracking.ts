/**
 * Android foreground tracking bridge. The native service keeps an ongoing notification and wakes
 * the `FaazioDeliveryHeartbeat` headless task every 120 s, so a rider who is online remains in the
 * dispatch candidate pool while the UI is backgrounded. iOS has no native service; its background
 * watch lives in `deliveryBackgroundLocation.ts` (`UIBackgroundModes: location`).
 */
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

interface DeliveryTrackingNative {
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
}

const native = (NativeModules as { FaazioDeliveryTracking?: DeliveryTrackingNative })
  .FaazioDeliveryTracking;

export function isBackgroundTrackingAvailable(): boolean {
  return Platform.OS === 'android' && Boolean(native?.start);
}

async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // The foreground notification still exists; only its drawer visibility may be reduced.
  }
}

/** Start the ongoing location service (no-op on unsupported platforms). */
export async function startDeliveryTracking(): Promise<boolean> {
  if (!isBackgroundTrackingAvailable()) return false;
  await requestNotificationPermission();
  try {
    return await native!.start();
  } catch {
    return false;
  }
}

/** Stop the service and its notification. Safe to call when already stopped. */
export async function stopDeliveryTracking(): Promise<void> {
  if (!isBackgroundTrackingAvailable()) return;
  try {
    await native!.stop();
  } catch {
    // Service already gone.
  }
}
