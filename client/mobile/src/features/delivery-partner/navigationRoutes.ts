import type { NavigationProp } from '@react-navigation/native';
import type { DeliveryPartnerStackParamList, DeliveryTabParamList } from './navigation';

/**
 * Replace the current stack entry with the persistent tab shell focused on `screen`.
 * Used by the auth/offer/route flows that must land on a specific tab without leaving a
 * back entry behind (the old `replace('Dashboard')` behaviour, now that Dashboard is a tab).
 */
export function resetToTab(
  navigation: NavigationProp<DeliveryPartnerStackParamList>,
  screen: keyof DeliveryTabParamList,
): void {
  navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen } }] });
}
