import { registerCallBackgroundHandler, INCOMING_CALL_TYPE } from '@/features/call/incoming';
import { handleIncomingCall } from './callController';

/**
 * Background/quit-state call wake-up for the customer app. Registered in `index.js` before the app
 * component mounts, so a swiped-away app still rings.
 */
export function registerCustomerCallBackgroundHandler(): void {
  registerCallBackgroundHandler(INCOMING_CALL_TYPE, handleIncomingCall);
}
