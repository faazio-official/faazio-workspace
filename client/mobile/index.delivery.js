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

registerDeliveryHeartbeatTask();

AppRegistry.registerComponent('main', () => DeliveryPartnerApp);
