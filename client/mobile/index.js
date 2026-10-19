/**
 * Bare React Native entry point. The registered component name ("main") must
 * match `MainActivity.getMainComponentName()` on Android and
 * `factory.startReactNative(withModuleName:)` on iOS.
 *
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('main', () => App);
