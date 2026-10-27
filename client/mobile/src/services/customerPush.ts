/**
 * Customer push registration. The gateway's notifications outbox drains through the configured
 * push bridge (FCM/APNs/webhook); this module registers the device token so the signed-in customer
 * receives order/Rx notifications on any device.
 *
 * Best-effort by design: a denied permission or an unconfigured native Firebase app must never
 * block the app. The in-app inbox (GET /notifications) remains available as the fallback.
 */
import { Platform } from 'react-native';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import { gateway } from './api/GatewayClient';

const platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';

function permissionGranted(status: number): boolean {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL ||
    status === AuthorizationStatus.EPHEMERAL
  );
}

async function syncToken(): Promise<void> {
  const token = await getToken(getMessaging());
  if (token) await gateway.registerPushToken(token, platform);
}

/**
 * Ask for notification permission, register the token and keep it fresh. `onNotification` runs when
 * a message arrives in the foreground or the customer taps a notification. Returns a cleanup that
 * removes the listeners (the registered token stays valid for the user).
 */
export async function startCustomerPush(onNotification?: () => void): Promise<() => void> {
  if (!gateway.remoteEnabled) return () => {};
  try {
    const messaging = getMessaging();
    if (permissionGranted(await requestPermission(messaging))) await syncToken();

    const unsubToken = onTokenRefresh(messaging, (token) => {
      void gateway.registerPushToken(token, platform).catch(() => undefined);
    });
    const unsubMessage = onMessage(messaging, () => onNotification?.());
    const unsubOpen = onNotificationOpenedApp(messaging, () => onNotification?.());

    // Cold-start notification: report it once so the inbox can refresh on mount.
    void getInitialNotification(messaging)
      .then((initial) => {
        if (initial) onNotification?.();
      })
      .catch(() => undefined);

    return () => {
      unsubToken();
      unsubMessage();
      unsubOpen();
    };
  } catch {
    // Permission denied or native Firebase not configured — the in-app inbox still works.
    return () => {};
  }
}
