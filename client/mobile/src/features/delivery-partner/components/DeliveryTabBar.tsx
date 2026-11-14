import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Bike, ChevronRight, CircleUser, ClipboardList, Radio, Wallet } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DPBottomNav, type DPBottomNavTab } from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { hs, ms, vs } from '@/utils/responsive';
import { type DeliveryPartnerStackParamList } from '../navigation';

/** Five tabs mirroring the Vite reference delivery app (Feed · Pocket · Orders · Inbox · More). */
export const DELIVERY_TABS: DPBottomNavTab[] = [
  { key: 'Dashboard', label: 'Feed', icon: Radio },
  { key: 'Payouts', label: 'Pocket', icon: Wallet },
  { key: 'OrderHistory', label: 'Orders', icon: ClipboardList },
  { key: 'Notifications', label: 'Inbox', icon: Bell },
  { key: 'RiderProfile', label: 'More', icon: CircleUser },
];

/**
 * Custom bottom-tab bar. Renders the shared `DPBottomNav` from real tab-navigator state,
 * plus the reference's active-order CTA above the bar while a job is in progress. The CTA
 * is in normal flow, so the navigator measures it as part of the bar height and tab content
 * is inset above it instead of being covered. It is the tab navigator's `tabBar`, so it
 * stays mounted across tab switches.
 */
export function DeliveryTabBar({ state, navigation }: BottomTabBarProps) {
  const activeOrder = useDeliveryPartnerStore((s) => s.activeOrder);
  const active = state.routes[state.index]?.name ?? 'Dashboard';

  return (
    <View style={styles.bar}>
      {activeOrder ? (
        <View style={styles.ctaWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Active delivery: ${activeOrder.label}`}
            onPress={() =>
              navigation
                .getParent<NativeStackNavigationProp<DeliveryPartnerStackParamList>>()
                ?.navigate('Route')
            }
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Bike size={ms(18)} color={DELIVERY.onBrand} strokeWidth={2.2} />
            <AppText numberOfLines={1} style={styles.ctaText}>
              {activeOrder.label}
            </AppText>
            <ChevronRight size={ms(16)} color={DELIVERY.onBrand} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : null}
      <DPBottomNav
        tabs={DELIVERY_TABS}
        active={active}
        onSelect={(key) => {
          const route = state.routes.find((r) => r.name === key);
          if (!route) return;
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!event.defaultPrevented) navigation.navigate(route.name);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: DELIVERY.card },
  ctaWrap: {
    paddingHorizontal: hs(16),
    paddingTop: vs(8),
    paddingBottom: vs(8),
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    height: vs(48),
    paddingHorizontal: hs(14),
    borderRadius: DELIVERY.radius.md,
    backgroundColor: DELIVERY.success,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaPressed: { opacity: 0.9 },
  ctaText: { ...DP_TYPE.caption, color: DELIVERY.onBrand, fontWeight: '700', flex: 1 },
});
