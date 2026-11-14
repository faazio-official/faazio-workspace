import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

export interface DPBottomNavTab {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  badge?: number;
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
 * without depending on any feature module.
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
            <View>
              <Icon size={ms(20)} color={color} strokeWidth={selected ? 2.4 : 2} />
              {tab.badge && tab.badge > 0 ? (
                <View style={styles.badge}>
                  <AppText style={styles.badgeText}>{tab.badge > 9 ? '9+' : tab.badge}</AppText>
                </View>
              ) : null}
            </View>
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
    height: Math.max(DELIVERY.touch.min + vs(20), vs(62)),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DELIVERY.border,
    backgroundColor: DELIVERY.card,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: vs(4) },
  label: { fontSize: ms(10), fontWeight: '500' },
  labelActive: { fontWeight: '700' },
  badge: {
    position: 'absolute',
    right: hs(-8),
    top: ms(-4),
    minWidth: ms(14),
    height: ms(14),
    borderRadius: ms(7),
    paddingHorizontal: hs(3),
    backgroundColor: DELIVERY.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: ms(8), fontWeight: '700', color: DELIVERY.onBrand },
});