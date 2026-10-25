import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { Card, ErrorText, PrimaryButton, Screen, SP, StatusPill } from '../components';
import { gateway, type SellerOrder } from '@/services/api/GatewayClient';
import { hs, ms, vs } from '@/utils/responsive';
import type { SellerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<SellerStackParamList, 'Orders'>;

const FILTERS = ['NEW', 'PACKED', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELLED'] as const;

const rupees = (paisa?: number) => `₹${Math.round((paisa ?? 0) / 100)}`;

export function SellerOrdersScreen({ navigation, route }: Props) {
  const initial = route.params?.status;
  const [status, setStatus] = useState<string | undefined>(initial);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await gateway.getSellerOrders(status));
    } catch {
      setError('Could not load orders. Pull to retry.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const decide = useCallback(
    (order: SellerOrder, action: 'accept' | 'reject') => {
      const run = async () => {
        setBusy(order.id);
        setError(null);
        try {
          if (action === 'accept') {
            await gateway.acceptSellerOrder(order.id);
          } else {
            await gateway.rejectSellerOrder(order.id, 'Seller could not fulfil the order.');
          }
          await refresh();
        } catch {
          setError(action === 'accept' ? 'Could not accept this order.' : 'Could not reject this order.');
        } finally {
          setBusy(null);
        }
      };
      if (action === 'accept') {
        Alert.alert('Accept order?', `${order.id} will move to PACKED and dispatch.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Accept', onPress: () => void run() },
        ]);
      } else {
        Alert.alert('Reject order?', `${order.id} will be rejected and the customer refunded.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reject', style: 'destructive', onPress: () => void run() },
        ]);
      }
    },
    [refresh],
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
            <AppText style={styles.back}>‹ Back</AppText>
          </TouchableOpacity>
          <AppText style={styles.title}>Orders</AppText>
          <View style={styles.backSpacer} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <FilterChip label="All" active={!status} onPress={() => setStatus(undefined)} />
          {FILTERS.map((f) => (
            <FilterChip key={f} label={f} active={status === f} onPress={() => setStatus(f)} />
          ))}
        </ScrollView>

        <ErrorText>{error}</ErrorText>

        {orders.length === 0 && !loading ? (
          <Card>
            <AppText style={styles.empty}>No orders in this bucket.</AppText>
          </Card>
        ) : null}

        {orders.map((order) => (
          <Card key={order.id} style={styles.orderCard}>
            <TouchableOpacity onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}>
              <View style={styles.row}>
                <AppText style={styles.orderId}>{order.orderNumber || order.id}</AppText>
                <StatusPill status={order.status} />
              </View>
              <AppText style={styles.muted}>
                {order.lineItems?.length ?? 0} item(s) · {order.fulfillment || 'DELIVERY'}
                {order.totalChargedPaisa ? ` · ${rupees(order.totalChargedPaisa)}` : ''}
              </AppText>
              <AppText style={styles.muted}>Placed {order.placedAt}</AppText>
            </TouchableOpacity>
            {order.status === 'NEW' ? (
              <View style={styles.actions}>
                <View style={styles.action}>
                  <PrimaryButton
                    label="Accept"
                    loading={busy === order.id}
                    onPress={() => decide(order, 'accept')}
                  />
                </View>
                <View style={styles.action}>
                  <PrimaryButton
                    label="Reject"
                    variant="danger"
                    loading={busy === order.id}
                    onPress={() => decide(order, 'reject')}
                  />
                </View>
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : null]}
      accessibilityRole="button"
    >
      <AppText style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  body: { padding: hs(16), paddingBottom: vs(32), gap: vs(10) },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(4) },
  back: { fontSize: ms(14), fontWeight: '800', color: SP.brand },
  backSpacer: { width: hs(40) },
  title: { fontSize: ms(18), fontWeight: '900', color: SP.ink },
  filters: { gap: hs(8), paddingVertical: vs(4) },
  chip: {
    paddingHorizontal: hs(12),
    paddingVertical: vs(6),
    borderRadius: ms(999),
    borderWidth: 1,
    borderColor: SP.line,
    backgroundColor: SP.card,
  },
  chipActive: { backgroundColor: SP.brand, borderColor: SP.brand },
  chipText: { fontSize: ms(11), fontWeight: '800', color: SP.muted },
  chipTextActive: { color: '#fff' },
  empty: { fontSize: ms(13), color: SP.muted },
  orderCard: { gap: vs(8) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(8) },
  orderId: { fontSize: ms(14), fontWeight: '900', color: SP.ink, flexShrink: 1 },
  muted: { fontSize: ms(12), color: SP.muted },
  actions: { flexDirection: 'row', gap: hs(8), marginTop: vs(4) },
  action: { flex: 1 },
});
