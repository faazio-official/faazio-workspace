import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import type { RemoteMessage } from '@react-native-firebase/messaging';

/** FCM data payload for an incoming call. The caller's raw number is never included. */
export const INCOMING_CALL_TYPE = 'incoming_call';

/**
 * Background/quit-state call wake-up, shared by both products. Must be registered at the entry
 * module, before the app component mounts, so a swiped-away app still rings.
 *
 * Android: the payload is data-only (no notification block) so the system delivers it to this
 * handler rather than the tray. It carries: type, callId, callUuid, orderId, peerRole, callerLabel.
 * The VOIP token is minted server-side on answer, never carried in a push.
 *
 * iOS: this handler never fires for a ring. An iOS incoming call arrives as a PushKit VoIP push
 * (`apns-push-type: voip`) handled natively in `ios/Faazio/VoipCallManager.swift`, because only
 * CallKit can ring and iOS terminates an app that takes a VoIP push without reporting a call. The
 * native side persists the payload and the JS layer adopts it via `takePendingNativeCall()`.
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
