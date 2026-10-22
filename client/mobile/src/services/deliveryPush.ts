/**
 * Delivery Partner push. Reuses the shared notifications outbox: the gateway enqueues the order
 * ping for the rider's checkout user id, the notifications worker drains it through the configured
 * push bridge, and this module registers the device token and refreshes offers on arrival.
 *
 * Everything here is best-effort: a denied permission or an unconfigured native app must never
 * block the dashboard (offers are still visible on refresh).
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

async function syncToken(): Promise<void> {
  const token = await getToken(getMessaging());
  if (token) await gateway.registerPushToken(token, platform);
}

function permissionGranted(status: number): boolean {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL ||
    status === AuthorizationStatus.EPHEMERAL
  );
}

/**
 * Ask for notification permission, register the token and keep it fresh. `onOffer` runs when a
 * message arrives in the foreground or the rider taps an order notification. Returns a cleanup
 * that removes the listeners (the registered token stays valid for the user).
 */
export async function startDeliveryPush(onOffer: () => void): Promise<() => void> {
  try {
    const messaging = getMessaging();
    if (permissionGranted(await requestPermission(messaging))) await syncToken();

    const unsubToken = onTokenRefresh(messaging, (token) => {
      void gateway.registerPushToken(token, platform).catch(() => undefined);
    });
    const unsubMessage = onMessage(messaging, () => onOffer());
    const unsubOpen = onNotificationOpenedApp(messaging, () => onOffer());

    void getInitialNotification(messaging)
      .then((initial) => {
        if (initial) onOffer();
      })
      .catch(() => undefined);

    return () => {
      unsubToken();
      unsubMessage();
      unsubOpen();
    };
  } catch {
    // Permission denied or native Firebase not configured — polling still works.
    return () => undefined;
  }
}
