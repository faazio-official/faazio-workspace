import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AlertCircle, CheckCircle2, CircleDashed, Clock3, Info } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { DELIVERY, DP_TONE, DP_TYPE, type DpTone } from '@/theme/deliveryTokens';
import { hs, ms, vs } from '@/utils/responsive';

const TONE_BY_STATUS: Record<string, DpTone> = {
  ACTIVE: 'success',
  PAID: 'success',
  DELIVERED: 'success',
  VERIFIED: 'success',
  SENT: 'success',
  ROUTE_COMPLETE: 'success',
  REJECTED: 'danger',
  BLACKLISTED: 'danger',
  SUSPENDED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'danger',
  APPLIED: 'warning',
  PENDING: 'warning',
  PENDING_REVIEW: 'warning',
  PARTIAL: 'warning',
  AT_PICKUP: 'warning',
  AT_CUSTOMER: 'warning',
  PICKED_UP: 'warning',
  ASSIGNED: 'warning',
  ACCEPTED: 'info',
  ONLINE: 'success',
  OFFLINE: 'neutral',
};

export function toneForStatus(status: string): DpTone {
  return TONE_BY_STATUS[status] ?? 'neutral';
}

const TONE_ICON: Record<DpTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: Clock3,
  danger: AlertCircle,
  info: Info,
  neutral: CircleDashed,
  brand: Info,
};

/** `PENDING_REVIEW` → `Pending review` — sentence case, never an uppercase code. */
const sentenceCase = (value: string): string => {
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

interface DPStatusPillProps {
  status: string;
  /** Optional override label; defaults to the status with underscores spaced. */
  label?: string;
}

/** Capsule with a semantic tone icon + label (reference `OrderChips` / status text). */
export function DPStatusPill({ status, label }: DPStatusPillProps) {
  const tone = toneForStatus(status);
  const colors = DP_TONE[tone];
  const StatusIcon = TONE_ICON[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <StatusIcon size={ms(12)} color={colors.fg} strokeWidth={2} />
      <AppText style={[styles.text, { color: colors.fg }]}>
        {label ?? sentenceCase(status)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    alignSelf: 'flex-start',
    borderRadius: DELIVERY.radius.pill,
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
  },
  text: { ...DP_TYPE.micro },
});
