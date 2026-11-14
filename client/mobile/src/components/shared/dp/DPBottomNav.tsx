import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

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
 * Fixed bottom tab bar matching the Vite reference delivery app
 * (`Shell.tsx` → `BottomNav`): a flat card bar 80 px tall with `px-3 pb-3`,
 * a hairline top border, five equal tabs, a 20 px icon above a 10 px label,
 * and the active tab in brand colour at bold weight (inactive is muted ink).
 * Kept generic (keys + callbacks) so it lives in `components/shared` without
 * depending on any feature module. The app root (`DeliveryPartnerApp`) reserves
 * the bottom safe-area inset once, so the bar keeps a base height and must not
 * add `insets.bottom` again.
 */
export function DPBottomNav({ tabs, active, onSelect }: DPBottomNavProps) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        const Icon = tab.icon;
        const color = selected ? DELIVERY.brand : DELIVERY.inkMuted;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onSelect(tab.key)}
            style={styles.tab}
          >
            <Icon size={ms(20)} color={color} strokeWidth={2} />
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
    height: vs(80),
    paddingTop: vs(6),
    paddingHorizontal: hs(12),
    paddingBottom: vs(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DELIVERY.border,
    backgroundColor: DELIVERY.card,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: vs(4) },
  label: { fontSize: ms(10), fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
