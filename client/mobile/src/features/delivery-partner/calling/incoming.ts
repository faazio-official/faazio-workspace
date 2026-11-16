import { registerCallBackgroundHandler, INCOMING_CALL_TYPE } from '@/features/call/incoming';
import { handleIncomingCall } from './callController';

/** FCM data payload for an incoming call. The caller's raw number is never included. */
export { INCOMING_CALL_TYPE };

/**
 * Background/quit-state call wake-up. Must be registered at the entry module, before the app
 * component mounts, so a swiped-away app still rings.
 */
export function registerDeliveryCallBackgroundHandler(): void {
  registerCallBackgroundHandler(INCOMING_CALL_TYPE, handleIncomingCall);
}
