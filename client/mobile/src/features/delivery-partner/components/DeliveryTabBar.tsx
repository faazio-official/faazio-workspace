import React from 'react';
import { Bell, ClipboardList, CircleUser, Radio, Wallet } from 'lucide-react-native';
import { DPBottomNav, type DPBottomNavTab } from '@/components/shared/dp';

export type DeliveryTabKey = 'Dashboard' | 'Payouts' | 'OrderHistory' | 'Notifications' | 'RiderProfile';

/** Five tabs mirroring the Vite reference delivery app (Feed · Pocket · Orders · Inbox · More). */
export const DELIVERY_TABS: DPBottomNavTab[] = [
  { key: 'Dashboard', label: 'Feed', icon: Radio },
  { key: 'Payouts', label: 'Pocket', icon: Wallet },
  { key: 'OrderHistory', label: 'Orders', icon: ClipboardList },
  { key: 'Notifications', label: 'Inbox', icon: Bell },
  { key: 'RiderProfile', label: 'More', icon: CircleUser },
];

/** Minimal navigation surface the bar needs; avoids the screen-route generic mismatch. */
interface TabNavigation {
  navigate: (route: DeliveryTabKey) => void;
}

interface Props {
  active: DeliveryTabKey;
  navigation: TabNavigation;
}

/** Bottom tab bar for the main delivery screens. Route names are the tab keys. */
export function DeliveryTabBar({ active, navigation }: Props) {
  return (
    <DPBottomNav
      tabs={DELIVERY_TABS}
      active={active}
      onSelect={(key) => navigation.navigate(key as DeliveryTabKey)}
    />
  );
}