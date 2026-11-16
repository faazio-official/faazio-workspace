/**
 * Customer SuperApp entry point. The Delivery Partner is a separate product with its own
 * entry (`index.delivery.js`), Android flavor and iOS configuration — its modules are never
 * pulled into the customer bundle (and vice versa).
 *
 * The registered component name ("main") must match `MainActivity.getMainComponentName()` on
 * Android and `factory.startReactNative(withModuleName:)` on iOS.
 *
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { registerCustomerCallBackgroundHandler } from './src/features/customer/calling/incoming';

// Register before the app component so a swiped-away app still rings for an incoming call.
registerCustomerCallBackgroundHandler();

AppRegistry.registerComponent('main', () => App);
