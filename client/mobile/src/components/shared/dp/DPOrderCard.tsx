import React from 'react';
import { Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MapPin, Route as RouteIcon } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';
import { DPButton } from './DPButton';
import { DPSectionCard } from './DPSectionCard';
import { DPStatusPill } from './DPStatusPill';
import { usePressScale } from './DPPress';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DPOrderCardProps {
  /** Store / party name shown top-left. */
  title: string;
  /** Timestamp or order id under the title. */
  meta?: string;
  status?: string;
  statusLabel?: string;
  /** Optional route rail (signature DPRouteRail). */
  rail?: React.ReactNode;
  party?: { name: string; address?: string };
  /** Pre-formatted money string (use `formatRupees`). */
  amount?: string;
  amountNote?: string;
  /** e.g. "3 stops · 4 km · Cash". */
  submeta?: string;
  actionLabel?: string;
  onAction?: () => void;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Summary card for an order on the Feed / Orders lists: title + status, the
 * route rail, the party row, then money and meta with one action. Not a
 * one-size screen — offer-specific actions stay in the screen that owns them.
 */
export function DPOrderCard({
  title,
  meta,
  status,
  statusLabel,
  rail,
  party,
  amount,
  amountNote,
  submeta,
  actionLabel,
  onAction,
  onPress,
  accessibilityLabel,
  style,
}: DPOrderCardProps) {
  const { onPressIn, onPressOut, animatedStyle } = usePressScale();
  const card = (
    <DPSectionCard style={style}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <AppText style={styles.title} numberOfLines={1}>
            {title}
          </AppText>
          {meta ? <AppText style={styles.meta}>{meta}</AppText> : null}
        </View>
        {status ? <DPStatusPill status={status} label={statusLabel} /> : null}
      </View>

      {rail ? <View style={styles.railWrap}>{rail}</View> : null}

      {party ? (
        <View style={styles.party}>
          <MapPin size={ms(16)} color={DELIVERY.brand} strokeWidth={2} style={styles.partyIcon} />
          <View style={styles.partyText}>
            <AppText style={styles.partyName} numberOfLines={1}>
              {party.name}
            </AppText>
            {party.address ? (
              <AppText style={styles.partyAddress} numberOfLines={2}>
                {party.address}
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}

      {amount || actionLabel ? (
        <View style={styles.foot}>
          <View style={styles.footText}>
            {amount ? (
              <AppText style={styles.amount}>
                {amount}
                {amountNote ? <AppText style={styles.amountNote}> {amountNote}</AppText> : null}
              </AppText>
            ) : null}
            {submeta ? (
              <View style={styles.submeta}>
                <RouteIcon size={ms(12)} color={DELIVERY.inkMuted} strokeWidth={2} />
                <AppText style={styles.submetaText} numberOfLines={1}>
                  {submeta}
                </AppText>
              </View>
            ) : null}
          </View>
          {actionLabel && onAction ? (
            <DPButton label={actionLabel} onPress={onAction} variant="outline" size="sm" fullWidth={false} />
          ) : null}
        </View>
      ) : null}
    </DPSectionCard>
  );

  if (!onPress) return card;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={animatedStyle}
    >
      {card}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(10) },
  headText: { flex: 1 },
  title: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  meta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
  railWrap: { marginTop: vs(12) },
  party: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(8), marginTop: vs(12) },
  partyIcon: { marginTop: vs(2) },
  partyText: { flex: 1 },
  partyName: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '500' },
  partyAddress: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DELIVERY.border,
    paddingTop: vs(12),
    marginTop: vs(12),
  },
  footText: { flex: 1 },
  amount: { ...DP_TYPE.title, color: DELIVERY.ink },
  amountNote: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, fontWeight: '400' },
  submeta: { flexDirection: 'row', alignItems: 'center', gap: hs(4), marginTop: vs(2) },
  submetaText: { ...DP_TYPE.caption, color: DELIVERY.inkMuted },
});
