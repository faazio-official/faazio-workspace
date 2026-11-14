import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { DeliveryTabParamList } from './navigation';
import { DeliveryTabBar } from './components/DeliveryTabBar';
import { DashboardScreen } from './screens/DashboardScreen';
import { PayoutScreen } from './screens/PayoutScreen';
import { OrderHistoryScreen } from './screens/OrderHistoryScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { RiderProfileScreen } from './screens/RiderProfileScreen';

const Tab = createBottomTabNavigator<DeliveryTabParamList>();

/**
 * Persistent bottom-tab navigator for the authenticated rider app (Feed · Pocket · Orders ·
 * Inbox · More). It is hosted by a single `Main` screen in the root stack, so the bar stays
 * mounted across tab switches; full-screen detail routes (Route, EarningsDetail, Settings,
 * Support, AcceptReject) sit above it on the stack without the bar.
 */
export function DeliveryTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <DeliveryTabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Payouts" component={PayoutScreen} />
      <Tab.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="RiderProfile" component={RiderProfileScreen} />
    </Tab.Navigator>
  );
}
