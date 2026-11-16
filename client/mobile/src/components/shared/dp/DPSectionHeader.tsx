import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms } from '@/utils/responsive';

interface DPSectionHeaderProps {
  title: string;
  /** Optional trailing count next to the title (e.g. open offers). */
  count?: number;
  /** Optional text link + chevron on the right (e.g. "View earnings"). */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Section header for the rider Home / list screens: title (with an optional
 * count) on the left and an optional text action on the right. Owns the gap to
 * its own content (`DELIVERY.space.BLOCK`) so the screens stop repeating the row.
 */
export function DPSectionHeader({
  title,
  count,
  actionLabel,
  onAction,
  style,
}: DPSectionHeaderProps) {
  return (
    <View style={[styles.head, style]}>
      <View style={styles.titleRow}>
        <AppText style={styles.title}>{title}</AppText>
        {typeof count === 'number' ? <AppText style={styles.count}>{count}</AppText> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <AppText style={styles.actionText}>{actionLabel}</AppText>
          <ChevronRight size={ms(16)} color={DELIVERY.brand} strokeWidth={1.5} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(8),
    marginBottom: DELIVERY.space.BLOCK,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: hs(8), flexShrink: 1 },
  title: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '500' },
  count: { ...DP_TYPE.caption, color: DELIVERY.inkSubtle },
  action: { flexDirection: 'row', alignItems: 'center', gap: hs(2) },
  pressed: { opacity: 0.7 },
  actionText: { ...DP_TYPE.label, color: DELIVERY.brand, fontWeight: '500' },
});