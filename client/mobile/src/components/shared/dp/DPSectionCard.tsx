import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TONE, DP_TYPE, type DpTone } from '@/theme/deliveryTokens';
import { SHADOW_COLOR } from '@/theme/tokens';
import { hs, ms, vs } from '@/utils/responsive';

interface DPSectionCardProps {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
  /** `flat` drops the surface, border, shadow and padding for a bare grouping block. */
  variant?: 'card' | 'flat';
  style?: StyleProp<ViewStyle>;
}

/**
 * Surface card: white, hairline border, radius 16, soft shadow, optional
 * title/action header. The reference mobile view stacks these full-width down a
 * single column.
 */
export function DPSectionCard({
  children,
  title,
  action,
  variant = 'card',
  style,
}: DPSectionCardProps) {
  const hasHeader = Boolean(title || action);
  return (
    <View style={[variant === 'flat' ? styles.flat : styles.card, style]}>
      {hasHeader ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <AppText style={styles.title}>{title}</AppText> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

interface DPToneDotProps {
  tone?: DpTone;
  size?: number;
}

/** Small semantic presence dot (online/offline, stop type, status). */
export function DPToneDot({ tone = 'brand', size = 8 }: DPToneDotProps) {
  return (
    <View
      style={{
        width: ms(size),
        height: ms(size),
        borderRadius: ms(size / 2),
        backgroundColor: DP_TONE[tone].fg,
      }}
    />
  );
}

/** Hairline divider matching the card border. */
export function DPSeparator({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.separator, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DELIVERY.card,
    borderRadius: DELIVERY.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DELIVERY.border,
    padding: hs(16),
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  flat: { backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: hs(8),
    marginBottom: vs(12),
  },
  headerText: { flex: 1 },
  title: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '500' },
  action: { alignItems: 'flex-end' },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DELIVERY.border,
    marginVertical: vs(12),
  },
});