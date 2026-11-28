/**
 * Customer push registration. The gateway's notifications outbox drains through the configured
 * push bridge (FCM/APNs/webhook); this module registers the device token so the signed-in customer
 * receives order/Rx notifications and incoming delivery calls on any device.
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
import type { RemoteMessage } from '@react-native-firebase/messaging';
import { gateway } from './api/GatewayClient';
import { boardForNotificationKind, refreshBoards } from './pushRefresh';
import { handleIncomingCall } from '@/features/customer/calling/callController';
import { INCOMING_CALL_TYPE } from '@/features/call/incoming';
import { getVoipToken, subscribeVoipToken } from '@/features/call/callkeep';
import { navigationRef } from '@/navigation/navigationRef';
import { useNotificationsStore } from '@/state/notificationsStore';

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
 * Register the PushKit VoIP token. This is a second, separately-scoped credential: only it can make
 * CallKit ring an incoming call (an APNs `voip` push), while order/Rx pushes still use the FCM
 * token. PushKit may deliver the token before or after sign-in, so this reads the persisted value
 * rather than waiting for an event.
 */
async function syncVoipToken(): Promise<void> {
  const token = await getVoipToken();
  if (token) await gateway.registerPushToken(token, 'ios', 'voip');
}

function handleMessage(message: RemoteMessage, tapped: boolean, onNotification?: () => void): void {
  const data = message.data as Record<string, unknown> | undefined;
  // Call pushes are handled by the calling surface, never treated as an inbox notification.
  if (data?.type === INCOMING_CALL_TYPE) {
    void handleIncomingCall(data);
    return;
  }
  // A board-changing write (e.g. a blood request posted on another phone) refreshes the open board
  // in place; the fetch — not the push — remains the source of truth for what is shown.
  const board = boardForNotificationKind(data?.kind);
  if (board) refreshBoards(board);
  // Keep the unread badge warm for any push (foreground or background).
  void useNotificationsStore.getState().refreshUnread();
  // A tap on a non-call alert opens the durable inbox so the customer sees it in context — except a
  // seller document request, which jumps straight to Sell with us where the upload happens.
  if (tapped) {
    const sellerDocRequest =
      data?.kind === 'SELLER_DOC_REQUEST' || data?.screen === 'SellWithUs';
    if (navigationRef.isReady()) {
      navigationRef.navigate(sellerDocRequest ? 'SellWithUs' : 'Notifications');
    }
  }
  onNotification?.();
}

/**
 * Ask for notification permission, register the token and keep it fresh. `onNotification` runs when
 * a non-call message arrives in the foreground or the customer taps a notification. Returns a
 * cleanup that removes the listeners (the registered token stays valid for the user).
 */
export async function startCustomerPush(onNotification?: () => void): Promise<() => void> {
  if (!gateway.remoteEnabled) return () => {};
  // iOS rings through PushKit, not FCM, so the VoIP token must be registered even when the user
  // denies notification permission (a call ring needs the microphone, not the alert authorization).
  let unsubVoip = () => {};
  if (platform === 'ios') {
    void syncVoipToken().catch(() => undefined);
    // PushKit delivers/rotates the token after launch, so listen for it too: reading once at start
    // would leave a first-launch device unregistered until the next app start.
    const voipSub = subscribeVoipToken((token) => {
      void gateway.registerPushToken(token, 'ios', 'voip').catch(() => undefined);
    });
    unsubVoip = () => voipSub.remove();
  }
  try {
    const messaging = getMessaging();
    if (permissionGranted(await requestPermission(messaging))) await syncToken();

    const unsubToken = onTokenRefresh(messaging, (token) => {
      void gateway.registerPushToken(token, platform).catch(() => undefined);
    });
    const unsubMessage = onMessage(messaging, (message) => handleMessage(message, false, onNotification));
    const unsubOpen = onNotificationOpenedApp(messaging, (message) =>
      handleMessage(message, true, onNotification),
    );

    // Cold-start notification: report it once so the inbox can refresh on mount.
    void getInitialNotification(messaging)
      .then((initial) => {
        if (initial) handleMessage(initial, true, onNotification);
      })
      .catch(() => undefined);

    return () => {
      unsubToken();
      unsubMessage();
      unsubOpen();
      unsubVoip();
    };
  } catch {
    // Permission denied or native Firebase not configured — the in-app inbox still works.
    unsubVoip();
    return () => {};
  }
}
