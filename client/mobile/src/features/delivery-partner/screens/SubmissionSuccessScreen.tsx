import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import { gateway, type DeliveryPartnerRider } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { Card, DP, ErrorText, PrimaryButton, Screen, StatusPill } from '../components';
import { hs, ms, vs } from '@/utils/responsive';
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
    <Screen>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
        <View style={styles.brandRow}>
          <FaazioLogo size={26} />
          <AppText style={styles.kicker}>Delivery Partner</AppText>
        </View>
        <AppText style={styles.title}>Application status</AppText>
        {rider ? <RiderSummary rider={rider} /> : null}
        <ErrorText>{error}</ErrorText>
        {rider ? (
          <Card style={styles.copyCard}>
            <AppText style={styles.copy}>{COPY[rider.status] ?? 'Application status updated.'}</AppText>
            {rider.rejectionReason ? (
              <AppText style={styles.reason}>Reason: {rider.rejectionReason}</AppText>
            ) : null}
          </Card>
        ) : !loading ? (
          <Card>
            <AppText style={styles.copy}>No application found for this account yet.</AppText>
          </Card>
        ) : null}

        {rider?.status === 'ACTIVE' ? (
          <PrimaryButton label="Open dashboard" onPress={() => navigation.replace('Dashboard')} />
        ) : null}
        {rider?.status === 'REJECTED' ? (
          <PrimaryButton label="Correct & re-apply" onPress={() => navigation.replace('Register')} />
        ) : rider ? (
          <PrimaryButton label="Refresh status" variant="ghost" onPress={() => void refresh()} loading={loading} />
        ) : (
          <PrimaryButton label="Start application" onPress={() => navigation.replace('Register')} />
        )}
        <TouchableOpacity onPress={() => void onLogout()} style={styles.linkWrap}>
          <AppText style={styles.link}>Sign out</AppText>
        </TouchableOpacity>
      </ScrollView>
    </Screen>
  );
}

function RiderSummary({ rider }: { rider: DeliveryPartnerRider }) {
  return (
    <Card style={styles.summary}>
      <View style={styles.summaryHead}>
        <View style={styles.flex}>
          <AppText style={styles.name}>{rider.fullName || 'Applicant'}</AppText>
          <AppText style={styles.meta}>
            {rider.city} · {rider.stateCode} · {rider.vehicleType.replace(/_/g, ' ').toLowerCase()}
          </AppText>
        </View>
        <StatusPill status={rider.status} />
      </View>
      <View style={styles.stats}>
        <Stat label="Capacity" value={String(rider.maxCapacity)} />
        <Stat label="Load" value={`${rider.currentLoad}/${rider.maxCapacity}`} />
        <Stat label="Rating" value={rider.rating ? rider.rating.toFixed(1) : '—'} />
        <Stat label="Deliveries" value={String(rider.completedOrders)} />
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: hs(16), paddingBottom: vs(40) },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: hs(8), marginTop: vs(12), marginBottom: vs(12) },
  kicker: { fontSize: ms(11), fontWeight: '900', color: DP.brand, textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: ms(28), fontWeight: '900', color: DP.ink, marginBottom: vs(16) },
  summary: { marginBottom: vs(12) },
  summaryHead: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(10) },
  flex: { flex: 1 },
  name: { fontSize: ms(17), fontWeight: '900', color: DP.ink },
  meta: { fontSize: ms(12), color: DP.muted, marginTop: vs(3), textTransform: 'capitalize' },
  stats: { flexDirection: 'row', marginTop: vs(16), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DP.line, paddingTop: vs(12) },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: ms(16), fontWeight: '900', color: DP.ink },
  statLabel: { fontSize: ms(10), fontWeight: '800', color: DP.muted, marginTop: vs(2), textTransform: 'uppercase' },
  copyCard: { marginBottom: vs(14) },
  copy: { fontSize: ms(13), lineHeight: ms(20), color: DP.ink },
  reason: { fontSize: ms(12), color: DP.danger, marginTop: vs(8) },
  linkWrap: { alignItems: 'center', marginTop: vs(18) },
  link: { fontSize: ms(12), fontWeight: '800', color: DP.muted },
});
