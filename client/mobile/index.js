/**
 * Bare React Native entry point. The registered component name ("main") must
 * match `MainActivity.getMainComponentName()` on Android and
 * `factory.startReactNative(withModuleName:)` on iOS.
 *
 * @format
 */

import { AppRegistry } from 'react-native';
import { APP_VARIANT } from './src/lib/appVariant';
import App from './App';
import DeliveryPartnerApp from './src/DeliveryPartnerApp';

// One repo, two product experiences. `APP_VARIANT=delivery` (read by scripts/configure.js) builds
// the partner app; every other value keeps the customer SuperApp exactly as before.
const Root = APP_VARIANT === 'delivery' ? DeliveryPartnerApp : App;

AppRegistry.registerComponent('main', () => Root);
