import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

/**
 * Height a tab screen must reserve at the bottom so its last row is not hidden
 * under the floating hub tab capsule (`navigation/MainTabs` `HubTabBar`).
 *
 * The dock is an absolute transparent overlay so screen content scrolls behind
 * it; every tab screen therefore insets its own scroll tail / fixed footer.
 * Pushed screens have no tab navigator ancestor, so this returns `0` there and
 * the same presentational component can be reused from both places.
 */
export function useTabBarClearance(): number {
  return useContext(BottomTabBarHeightContext) ?? 0;
}
