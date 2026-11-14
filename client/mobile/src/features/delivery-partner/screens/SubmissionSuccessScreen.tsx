import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import {
  DPPage,
  DPPageHeader,
  DPButton,
  DPSectionCard,
  DPStatusPill,
  DPKpiStrip,
  DPKpiCard,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type DeliveryPartnerRider } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { hs, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'SubmissionSuccess'>;

const COPY: Record<string, string> = {
  APPLIED: 'Your application has been received. An admin will review it shortly.',
  PENDING_REVIEW: 'Your documents are with the admin team. This usually takes 1–2 working days.',
  VERIFIED: 'Verified. A super admin will activate your account before you can go online.',
  ACTIVE: 'You are active. Go online to receive delivery offers.',
  SUSPENDED: 'Your account is suspended. Contact Faazio support for a review.',
  BLACKLISTED: 'Your account is blocked. Contact Faazio support.',
  REJECTED: 'Your application was rejected. You can correct the details and re-apply.',
};

export function SubmissionSuccessScreen({ navigation }: Props) {
  const rider = useDeliveryPartnerStore((s) => s.rider);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const reset = useDeliveryPartnerStore((s) => s.reset);
  const logout = useAuthStore((s) => s.logout);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await gateway.getDeliveryPartnerMe();
      setRider(next);
      if (next.status === 'ACTIVE') navigation.replace('Dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh your application.');
    } finally {
      setLoading(false);
    }
  }, [navigation, setRider]);

  useEffect(() => {
    if (!rider) void refresh();
  }, [rider, refresh]);

  const onLogout = useCallback(async () => {
    await logout();
    reset();
    navigation.replace('PhoneEntry');
  }, [logout, navigation, reset]);

  return (
    <DPPage
      contentStyle={styles.body}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    >
      <DPPageHeader
        leading={<FaazioLogo size={26} />}
        kicker="Delivery Partner"
        title="Application status"
        tone={rider ? undefined : 'neutral'}
      />

      {rider ? <RiderSummary rider={rider} /> : null}
      {error ? <AppText style={styles.error}>{error}</AppText> : null}

      {rider ? (
        <DPSectionCard style={styles.copyCard}>
          <AppText style={styles.copy}>{COPY[rider.status] ?? 'Application status updated.'}</AppText>
          {rider.rejectionReason ? (
            <AppText style={styles.reason}>Reason: {rider.rejectionReason}</AppText>
          ) : null}
        </DPSectionCard>
      ) : !loading ? (
        <DPSectionCard>
          <AppText style={styles.copy}>No application found for this account yet.</AppText>
        </DPSectionCard>
      ) : null}

      {rider?.status === 'ACTIVE' ? (
        <DPButton label="Open dashboard" onPress={() => navigation.replace('Dashboard')} />
      ) : null}
      {rider?.status === 'REJECTED' ? (
        <DPButton label="Correct & re-apply" onPress={() => navigation.replace('Register')} />
      ) : rider ? (
        <DPButton label="Refresh status" variant="outline" onPress={() => void refresh()} loading={loading} />
      ) : (
        <DPButton label="Start application" onPress={() => navigation.replace('Register')} />
      )}
      <TouchableOpacity onPress={() => void onLogout()} style={styles.linkWrap} accessibilityRole="button">
        <AppText style={styles.link}>Sign out</AppText>
      </TouchableOpacity>
    </DPPage>
  );
}

function RiderSummary({ rider }: { rider: DeliveryPartnerRider }) {
  return (
    <DPSectionCard style={styles.summary}>
      <View style={styles.summaryHead}>
        <View style={styles.flex}>
          <AppText style={styles.name}>{rider.fullName || 'Applicant'}</AppText>
          <AppText style={styles.meta}>
            {rider.city} · {rider.stateCode} · {rider.vehicleType.replace(/_/g, ' ').toLowerCase()}
          </AppText>
        </View>
        <DPStatusPill status={rider.status} />
      </View>
      <DPKpiStrip style={styles.stats}>
        <DPKpiCard label="Capacity" value={String(rider.maxCapacity)} />
        <DPKpiCard label="Load" value={`${rider.currentLoad}/${rider.maxCapacity}`} />
        <DPKpiCard label="Rating" value={rider.rating ? rider.rating.toFixed(1) : '—'} />
        <DPKpiCard label="Deliveries" value={String(rider.completedOrders)} />
      </DPKpiStrip>
    </DPSectionCard>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: vs(8) },
  summary: { marginBottom: vs(12) },
  summaryHead: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(10) },
  flex: { flex: 1 },
  name: { ...DP_TYPE.title, color: DELIVERY.ink, fontWeight: '700' },
  meta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(3), textTransform: 'capitalize' },
  stats: { marginTop: vs(14) },
  copyCard: { marginBottom: vs(14) },
  copy: { ...DP_TYPE.body, color: DELIVERY.ink },
  reason: { ...DP_TYPE.caption, color: DELIVERY.danger, marginTop: vs(8) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginBottom: vs(10) },
  linkWrap: { minHeight: DELIVERY.touch.min, alignItems: 'center', justifyContent: 'center', marginTop: vs(12) },
  link: { ...DP_TYPE.label, color: DELIVERY.inkMuted, fontWeight: '500' },
});