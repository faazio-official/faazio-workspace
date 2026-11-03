import { Vibration } from 'react-native';
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
import type { RemoteMessage } from '@react-native-firebase/messaging';

let cachedToken: string | null = null;
let initialPushConsumed = false;
let beep: { play: (done?: (success: boolean) => void) => void; release: () => void } | null = null;

/** The current FCM token, if permission was granted and the native Firebase app is configured. */
export function getSellerPushToken(): string | null {
  return cachedToken;
}

/**
 * Best-effort order alert. Uses the bundled beep asset (react-native-sound) and a short vibration;
 * a denied permission or a missing native module must never break the WebView.
 */
function playOrderBeep(): void {
  try {
    Vibration.vibrate(180);
  } catch {
    // no-op
  }
  try {
    if (!beep) {
      const Sound = require('react-native-sound');
      Sound.setCategory('Playback', false);
      beep = new Sound(require('../assets/orderBeep.wav'), () => undefined);
    }
    beep?.play(() => undefined);
  } catch {
    // Native module unavailable (e.g. unit test) — the notification is still visible in the portal.
  }
}

function permissionGranted(status: number): boolean {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL ||
    status === AuthorizationStatus.EPHEMERAL
  );
}

/** Pull the order id + the vendor store it belongs to (if any) out of an FCM data payload. */
function orderFromMessage(message: RemoteMessage | null): { orderId: string | null; storeId: string | null } {
  const data = message?.data as Record<string, unknown> | undefined;
  const orderId = data?.orderId ?? data?.order_id;
  const storeId = data?.storeId ?? data?.store_id ?? data?.vendorId;
  return {
    orderId: typeof orderId === 'string' && orderId ? orderId : null,
    storeId: typeof storeId === 'string' && storeId ? storeId : null,
  };
}

interface SellerPushHandlers {
  /** Foreground new-order message: beep + refresh/navigate the WebView. */
  onOrder: (orderId: string | null, storeId?: string | null) => void;
  /** FCM token obtained or rotated; injected into the portal so it can register the device. */
  onToken: (token: string) => void;
}

/**
 * Registers seller push handling. The portal registers the token with the gateway through its
 * authenticated `/api/gateway` proxy (native never holds a portal token). Returns a cleanup.
 */
export async function startSellerPush(handlers: SellerPushHandlers): Promise<() => void> {
  try {
    const messaging = getMessaging();
    if (permissionGranted(await requestPermission(messaging))) {
      const token = await getToken(messaging);
      if (token) {
        cachedToken = token;
        handlers.onToken(token);
      }
    }

    const unsubToken = onTokenRefresh(messaging, (token) => {
      cachedToken = token;
      handlers.onToken(token);
    });
    const unsubMessage = onMessage(messaging, (message) => {
      const { orderId, storeId } = orderFromMessage(message);
      if (!orderId) return;
      playOrderBeep();
      handlers.onOrder(orderId, storeId);
    });
    const unsubOpen = onNotificationOpenedApp(messaging, (message) => {
      const { orderId, storeId } = orderFromMessage(message);
      if (orderId) handlers.onOrder(orderId, storeId);
    });

    if (!initialPushConsumed) {
      initialPushConsumed = true;
      void getInitialNotification(messaging)
        .then((initial) => {
          const { orderId, storeId } = orderFromMessage(initial);
          if (orderId) handlers.onOrder(orderId, storeId);
        })
        .catch(() => undefined);
    }

    return () => {
      unsubToken();
      unsubMessage();
      unsubOpen();
    };
  } catch {
    return () => undefined;
  }
}
