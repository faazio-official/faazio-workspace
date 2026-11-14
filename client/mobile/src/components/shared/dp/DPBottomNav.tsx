import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY } from '@/theme/deliveryTokens';
import { ms, vs } from '@/utils/responsive';

export interface DPBottomNavTab {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

interface DPBottomNavProps {
  tabs: DPBottomNavTab[];
  active: string;
  onSelect: (key: string) => void;
}

/**
 * Fixed bottom tab bar matching the Vite reference delivery app: flat card bar,
 * hairline top border, five equal tabs, 20 px icon + 10 px label, active tab in
 * brand colour. Kept generic (keys + callbacks) so it lives in `components/shared`
 * without depending on any feature module. The app root (`DeliveryPartnerApp`)
 * reserves the bottom safe-area inset once, so the bar keeps a base height and
 * must not add `insets.bottom` again.
 */
export function DPBottomNav({ tabs, active, onSelect }: DPBottomNavProps) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        const Icon = tab.icon;
        const color = selected ? DELIVERY.brand : DELIVERY.inkSubtle;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onSelect(tab.key)}
            style={styles.tab}
          >
            <Icon size={ms(20)} color={color} strokeWidth={selected ? 2.4 : 2} />
            <AppText style={[styles.label, { color }, selected && styles.labelActive]}>{tab.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    minHeight: Math.max(DELIVERY.touch.min + vs(16), vs(62)),
    paddingTop: vs(6),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DELIVERY.border,
    backgroundColor: DELIVERY.card,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: vs(4) },
  label: { fontSize: ms(10), fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
