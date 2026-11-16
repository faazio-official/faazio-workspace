import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import type { RemoteMessage } from '@react-native-firebase/messaging';

/** FCM data payload for an incoming call. The caller's raw number is never included. */
export const INCOMING_CALL_TYPE = 'incoming_call';

/**
 * Background/quit-state call wake-up, shared by both products. Must be registered at the entry
 * module, before the app component mounts, so a swiped-away app still rings.
 *
 * The payload is data-only (no notification block) so Android delivers it to this handler rather
 * than the system tray. It carries: type, callId, orderId, peerRole. The VOIP token is minted
 * server-side on answer, never carried in a push.
 */
export function registerCallBackgroundHandler(
  type: string,
  handler: (data: Record<string, unknown>) => Promise<void>,
): void {
  try {
    setBackgroundMessageHandler(getMessaging(), async (message: RemoteMessage) => {
      const data = message.data as Record<string, unknown> | undefined;
      if (data?.type !== type) return;
      await handler(data);
    });
  } catch {
    // Native Firebase not configured — foreground polling and the in-app surface still work.
  }
}
