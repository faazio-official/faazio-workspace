import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, vs } from '@/utils/responsive';

export interface DPTabStripItem {
  key: string;
  label: string;
  count?: number;
}

interface DPTabStripProps {
  tabs: DPTabStripItem[];
  active: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Underline tab strip with counts (reference "My orders" Active/History switcher).
 * The count is quiet muted text, not a glowing pill.
 */
export function DPTabStrip({ tabs, active, onChange, style }: DPTabStripProps) {
  return (
    <View style={[styles.strip, style]} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              typeof tab.count === 'number' ? `${tab.label}, ${tab.count}` : tab.label
            }
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              selected ? styles.tabActive : styles.tabInactive,
              pressed && styles.pressed,
            ]}
          >
            <AppText style={[styles.label, selected ? styles.labelActive : styles.labelInactive]}>
              {tab.label}
            </AppText>
            {typeof tab.count === 'number' ? (
              <AppText style={[styles.count, selected && styles.countActive]}>{tab.count}</AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DELIVERY.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    height: vs(46),
    borderBottomWidth: 2,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabActive: { borderBottomColor: DELIVERY.brand },
  tabInactive: { borderBottomColor: 'transparent' },
  pressed: { opacity: 0.8 },
  label: { ...DP_TYPE.label },
  labelActive: { color: DELIVERY.brand, fontWeight: '600' },
  labelInactive: { color: DELIVERY.inkMuted },
  count: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle },
  countActive: { color: DELIVERY.brand },
});
