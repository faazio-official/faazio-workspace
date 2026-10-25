import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import { Card, ErrorText, PrimaryButton, Screen, SP, StatusPill } from '../components';
import {
  gateway,
  type SellerApplication,
  type SellerOrder,
} from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { hs, ms, vs } from '@/utils/responsive';
import type { SellerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<SellerStackParamList, 'Dashboard'>;

export function SellerDashboardScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [seller, setSeller] = useState<SellerApplication | null>(null);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [nextOrders, nextSeller] = await Promise.all([
        gateway.getSellerOrders(),
        user.sellerId ? gateway.getSellerDetail(user.sellerId) : Promise.resolve(null),
      ]);
      setOrders(nextOrders);
      setSeller(nextSeller);
    } catch {
      setError('Could not load your workspace. Pull to retry.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const pending = orders.filter((o) => o.status === 'NEW').length;
  const packed = orders.filter((o) => o.status === 'PACKED').length;
  const delivered = orders.filter((o) => o.status === 'DELIVERED').length;

  const onLogout = useCallback(async () => {
    await gateway.portalLogout();
    await logout();
    navigation.replace('Login');
  }, [logout, navigation]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <FaazioLogo size={28} />
          </View>
          <AppText style={styles.kicker}>Faazio Seller</AppText>
          <AppText style={styles.title}>{seller?.businessName ?? user?.name ?? 'Seller workspace'}</AppText>
          <AppText style={styles.subtitle}>{user?.email ?? ''}</AppText>
        </View>

        {seller ? (
          <Card style={styles.card}>
            <View style={styles.row}>
              <AppText style={styles.label}>Account status</AppText>
              <StatusPill status={seller.status} />
            </View>
            <View style={styles.row}>
              <AppText style={styles.label}>Category</AppText>
              <AppText style={styles.value}>{seller.category}</AppText>
            </View>
            <View style={styles.row}>
              <AppText style={styles.label}>Seller ID</AppText>
              <AppText style={styles.value}>{seller.sellerId}</AppText>
            </View>
          </Card>
        ) : null}

        <View style={styles.stats}>
          <Stat label="New" value={pending} tone={SP.warning} />
          <Stat label="Packed" value={packed} tone={SP.brand} />
          <Stat label="Delivered" value={delivered} tone={SP.success} />
        </View>

        <ErrorText>{error}</ErrorText>

        <Card style={styles.card}>
          <AppText style={styles.sectionTitle}>Orders</AppText>
          <AppText style={styles.muted}>
            Accept incoming NEW orders or reject with a reason. Rejections refund the captured payment.
          </AppText>
          <View style={styles.actions}>
            <PrimaryButton label={`New orders (${pending})`} onPress={() => navigation.navigate('Orders', { status: 'NEW' })} />
            <PrimaryButton
              label="All orders"
              variant="ghost"
              onPress={() => navigation.navigate('Orders', undefined)}
            />
          </View>
        </Card>

        <PrimaryButton label="Sign out" variant="danger" onPress={() => void onLogout()} />
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <View style={styles.stat}>
      <AppText style={[styles.statValue, { color: tone }]}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: hs(20), paddingBottom: vs(32), gap: vs(16) },
  header: { marginTop: vs(16) },
  logo: { marginBottom: vs(10) },
  kicker: { fontSize: ms(11), fontWeight: '900', color: SP.brand, textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { fontSize: ms(24), fontWeight: '900', color: SP.ink, marginTop: vs(3) },
  subtitle: { fontSize: ms(13), color: SP.muted, marginTop: vs(4) },
  card: { gap: vs(10) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: ms(12), color: SP.muted, fontWeight: '700' },
  value: { fontSize: ms(13), color: SP.ink, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: hs(10) },
  stat: {
    flex: 1,
    backgroundColor: SP.card,
    borderRadius: ms(14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SP.line,
    paddingVertical: vs(14),
    alignItems: 'center',
  },
  statValue: { fontSize: ms(24), fontWeight: '900' },
  statLabel: { fontSize: ms(11), color: SP.muted, fontWeight: '800', textTransform: 'uppercase', marginTop: vs(2) },
  sectionTitle: { fontSize: ms(16), fontWeight: '900', color: SP.ink },
  muted: { fontSize: ms(12), lineHeight: ms(18), color: SP.muted },
  actions: { gap: vs(8), marginTop: vs(4) },
});
