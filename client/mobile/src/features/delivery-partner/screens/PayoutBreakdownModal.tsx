import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import AppText from '@/components/AppText';
import {
  DPButton,
  DPKeyValueRow,
  DPSectionCard,
  DPSeparator,
  DPStatusPill,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import type { RiderPayout } from '@/services/api/GatewayClient';
import { hs, ms, vs } from '@/utils/responsive';
import { formatNumber, headlineRupees, lineRupees } from '../format';

interface Props {
  visible: boolean;
  payout: RiderPayout | null;
  /** Collision-safe short order reference shown in the header (defaults to the last 6 chars). */
  orderRef?: string;
  /** Live base distance from the rate card, so the "Base (first N km)" label never drifts. */
  baseDistanceKm?: number;
  onClose: () => void;
}

function paidAmount(payout: RiderPayout): number {
  return payout.status === 'PAID' ? payout.totalPaisa : payout.paidAmountPaisa ?? 0;
}

function formatPaidOn(paidAt?: string): string | null {
  if (!paidAt) return null;
  const date = new Date(paidAt);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-IN');
}

export function PayoutBreakdownModal({ visible, payout, orderRef, baseDistanceKm, onClose }: Props) {
  // Modals render in their own native window; a nested provider reports that window's
  // real insets instead of the app root's.
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <BreakdownBody
          payout={payout}
          orderRef={orderRef}
          baseDistanceKm={baseDistanceKm}
          onClose={onClose}
        />
      </SafeAreaProvider>
    </Modal>
  );
}

function BreakdownBody({ payout, orderRef, baseDistanceKm, onClose }: Omit<Props, 'visible'>) {
  const insets = useSafeAreaInsets();

  if (!payout) {
    return <View style={styles.page} />;
  }

  const paidNow = paidAmount(payout);
  const balance = payout.balancePaisa ?? Math.max(0, payout.totalPaisa - paidNow);
  const paidOn = formatPaidOn(payout.paidAt);
  const baseLabel =
    baseDistanceKm && baseDistanceKm > 0
      ? `Base (first ${formatNumber(baseDistanceKm, Number.isInteger(baseDistanceKm) ? 0 : 1)} km)`
      : 'Base';

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
        <View style={styles.headerText}>
          <AppText style={styles.title}>Payout breakdown</AppText>
          <AppText style={styles.subtitle}>Order {orderRef ?? payout.orderId.slice(-6)}</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close payout breakdown"
          onPress={onClose}
          hitSlop={hs(8)}
          style={styles.close}
        >
          <X size={ms(20)} color={DELIVERY.ink} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <DPSectionCard>
          <View style={styles.rowBetween}>
            <AppText style={styles.totalLabel}>Total payout</AppText>
            <DPStatusPill status={payout.status} />
          </View>
          <AppText style={styles.total}>{headlineRupees(payout.totalPaisa)}</AppText>
          <DPSeparator />
          <DPKeyValueRow label="Distance" value={`${formatNumber(payout.distanceKm, 1)} km`} />
          <DPKeyValueRow label={baseLabel} value={lineRupees(payout.baseRatePaisa)} />
          <DPKeyValueRow label="Extra km" value={lineRupees(payout.extraKmChargePaisa)} />
          <DPKeyValueRow
            label={payout.surgeReason ? `Surge · ${payout.surgeReason}` : 'Surge'}
            value={lineRupees(payout.surgePaisa)}
            valueTone={payout.surgePaisa > 0 ? 'warning' : undefined}
          />
          <DPSeparator />
          <DPKeyValueRow label="Paid so far" value={lineRupees(paidNow)} valueTone="success" />
          <DPKeyValueRow
            label="Balance"
            value={lineRupees(balance)}
            valueTone={balance > 0 ? 'warning' : 'success'}
          />
          {paidOn ? <DPKeyValueRow label="Paid on" value={paidOn} /> : null}
        </DPSectionCard>

        <AppText style={styles.note}>
          Amounts are server-derived from the stored distance and surge basis. Disbursement is
          recorded by a Faazio admin; bank credit timing depends on the payout run.
        </AppText>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + vs(16) }]}>
        <DPButton label="Done" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: DELIVERY.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingBottom: vs(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DELIVERY.border,
    backgroundColor: DELIVERY.card,
  },
  headerText: { flexShrink: 1 },
  title: { ...DP_TYPE.title, color: DELIVERY.ink, fontWeight: '600' },
  subtitle: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(2) },
  close: {
    width: DELIVERY.touch.min,
    height: DELIVERY.touch.min,
    borderRadius: DELIVERY.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DELIVERY.surfaceAlt,
  },
  body: { padding: hs(16), paddingBottom: vs(24) },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(10),
  },
  totalLabel: { ...DP_TYPE.micro, color: DELIVERY.inkMuted },
  total: {
    ...DP_TYPE.display,
    color: DELIVERY.ink,
    marginTop: vs(4),
    fontVariant: ['tabular-nums'],
  },
  note: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(12) },
  footer: {
    paddingHorizontal: hs(16),
    paddingTop: vs(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DELIVERY.border,
    backgroundColor: DELIVERY.card,
  },
});