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

AppRegistry.registerComponent('main', () => App);
