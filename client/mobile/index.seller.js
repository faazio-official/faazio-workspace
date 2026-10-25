/**
 * Seller Partner entry point. This bundle contains only the seller experience (login with web
 * portal credentials + order accept/reject) — customer and delivery screens are never bundled.
 *
 * `MainApplication`/`AppDelegate` select this root for the `seller` flavor/configuration.
 *
 * @format
 */

import { AppRegistry } from 'react-native';
import SellerPartnerApp from './src/SellerPartnerApp';

AppRegistry.registerComponent('main', () => SellerPartnerApp);
