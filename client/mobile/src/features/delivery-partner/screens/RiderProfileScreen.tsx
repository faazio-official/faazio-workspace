import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPSectionCard,
  DPStatusPill,
  DPKeyValueRow,
  DPListRow,
  DPAvatar,
  DPErrorState,
  DPSkeleton,
  DPSeparator,
  DPButton,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type DeliveryPartnerRider } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { hs, vs } from '@/utils/responsive';
import { type DeliveryPartnerStackParamList, type DeliveryTabParamList } from '../navigation';

type Props = CompositeScreenProps<
  BottomTabScreenProps<DeliveryTabParamList, 'RiderProfile'>,
  NativeStackScreenProps<DeliveryPartnerStackParamList>
>;

/**
 * Rider profile hub built from `GET /delivery/me` only. The full application
 * detail endpoint (`GET /delivery/register/{id}`) is admin/superadmin-gated, so a
 * rider cannot read their documents here — the profile reflects the rider's own
 * record and links to Settings / Support.
 */
export function RiderProfileScreen({ navigation }: Props) {
  const rider = useDeliveryPartnerStore((s) => s.rider);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const reset = useDeliveryPartnerStore((s) => s.reset);
  const logout = useAuthStore((s) => s.logout);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRider(await gateway.getDeliveryPartnerMe());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, [setRider]);

  useEffect(() => {
    void load();
  }, [load]);

  const onLogout = useCallback(async () => {
    await logout();
    reset();
    navigation
      .getParent<NativeStackNavigationProp<DeliveryPartnerStackParamList>>()
      ?.reset({ index: 0, routes: [{ name: 'PhoneEntry' }] });
  }, [logout, navigation, reset]);

  return (
    <DPPage
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <DPPageHeader kicker="More" title="Profile & services" />

      {loading && !rider ? (
        <DPSkeleton lines={6} />
      ) : error && !rider ? (
        <DPErrorState description={error} onRetry={() => void load()} />
      ) : rider ? (
        <ProfileBody rider={rider} />
      ) : null}

      <DPSectionCard style={styles.menu} title="Services">
        <DPListRow title="Earnings & payouts" subtitle="Per-job payout and settlement" onPress={() => navigation.navigate('Payouts')} />
        <DPListRow title="Order history" subtitle="Completed deliveries" onPress={() => navigation.navigate('OrderHistory')} />
        <DPListRow title="Notifications" subtitle="Order and payout updates" onPress={() => navigation.navigate('Notifications')} />
        <DPListRow
          title="Settings"
          subtitle="Preferences and app version"
          onPress={() => navigation.navigate('Settings')}
          style={styles.lastRow}
        />
      </DPSectionCard>

      <DPSectionCard style={styles.menu} title="Help">
        <DPListRow
          title="Support"
          subtitle="Contact the partner support team"
          onPress={() => navigation.navigate('Support')}
          style={styles.lastRow}
        />
      </DPSectionCard>

      <DPButton label="Sign out" variant="outline" onPress={() => void onLogout()} style={styles.signOut} />
    </DPPage>
  );
}

function ProfileBody({ rider }: { rider: DeliveryPartnerRider }) {
  return (
    <>
      <DPSectionCard style={styles.card}>
        <View style={styles.identity}>
          <DPAvatar name={rider.fullName || 'Rider'} size={56} />
          <View style={styles.flex}>
            <AppText style={styles.name}>{rider.fullName || 'Rider'}</AppText>
            <AppText style={styles.meta}>
              {rider.city} · {rider.stateCode}
            </AppText>
          </View>
          <DPStatusPill status={rider.status} />
        </View>
        <DPSeparator />
        <DPKeyValueRow label="Phone" value={rider.phone || '—'} />
        <DPKeyValueRow label="Vehicle" value={rider.vehicleType.replace(/_/g, ' ').toLowerCase()} />
        <DPKeyValueRow label="Capacity" value={String(rider.maxCapacity)} />
        <DPKeyValueRow label="Hub zone" value={rider.hubZone || '—'} />
        <DPKeyValueRow label="Rating" value={rider.rating ? `${rider.rating.toFixed(1)} / 5` : '—'} />
        <DPKeyValueRow label="Completed deliveries" value={String(rider.completedOrders)} />
      </DPSectionCard>

      <DPSectionCard style={styles.card} title="Documents" kicker="Review">
        <AppText style={styles.note}>
          KYC documents are collected at registration and reviewed by the Faazio admin team. Contact
          support if any document needs a replacement.
        </AppText>
      </DPSectionCard>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: vs(12) },
  identity: { flexDirection: 'row', alignItems: 'center', gap: hs(12) },
  flex: { flex: 1 },
  name: { ...DP_TYPE.title, color: DELIVERY.ink, fontWeight: '700' },
  meta: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(3) },
  menu: { marginTop: vs(12) },
  lastRow: { borderBottomWidth: 0 },
  note: { ...DP_TYPE.body, color: DELIVERY.inkMuted },
  signOut: { marginTop: vs(16) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger },
});