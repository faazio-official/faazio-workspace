/**
 * Delivery Partner entry point. This bundle contains only the partner experience (plus the
 * shared transport/state primitives it imports) — the customer navigator is never bundled.
 *
 * `MainApplication`/`AppDelegate` select this root for the `delivery` flavor/configuration, and
 * the Android foreground service runs the `FaazioDeliveryHeartbeat` headless task while online.
 *
 * @format
 */

import { AppRegistry } from 'react-native';
import DeliveryPartnerApp from './src/DeliveryPartnerApp';
import { registerDeliveryHeartbeatTask } from './src/services/deliveryHeartbeatTask';
import { registerDeliveryCallBackgroundHandler } from './src/features/delivery-partner/calling/incoming';

registerDeliveryHeartbeatTask();
// Register before the app component so a swiped-away app still rings for an incoming call.
registerDeliveryCallBackgroundHandler();

AppRegistry.registerComponent('main', () => DeliveryPartnerApp);
