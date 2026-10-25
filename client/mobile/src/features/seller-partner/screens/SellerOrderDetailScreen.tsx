import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { Card, ErrorText, PrimaryButton, Screen, SP, StatusPill } from '../components';
import { gateway, type SellerOrder } from '@/services/api/GatewayClient';
import { hs, ms, vs } from '@/utils/responsive';
import type { SellerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<SellerStackParamList, 'OrderDetail'>;

const rupees = (paisa?: number) => `₹${Math.round((paisa ?? 0) / 100)}`;

export function SellerOrderDetailScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<SellerOrder | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrder(await gateway.getSellerOrder(orderId));
    } catch {
      setError('Could not load this order.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setOrder(await gateway.acceptSellerOrder(orderId));
    } catch {
      setError('Could not accept this order.');
    } finally {
      setBusy(false);
    }
  }, [orderId]);

  const reject = useCallback(() => {
    Alert.alert('Reject order?', 'The customer will be notified and refunded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              setOrder(
                await gateway.rejectSellerOrder(
                  orderId,
                  reason.trim() || 'Seller could not fulfil the order.',
                ),
              );
            } catch {
              setError('Could not reject this order.');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }, [orderId, reason]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
            <AppText style={styles.back}>‹ Back</AppText>
          </TouchableOpacity>
          <AppText style={styles.title}>Order detail</AppText>
          <View style={styles.backSpacer} />
        </View>

        <ErrorText>{error}</ErrorText>
        {loading && !order ? <AppText style={styles.muted}>Loading…</AppText> : null}

        {order ? (
          <>
            <Card style={styles.card}>
              <View style={styles.row}>
                <AppText style={styles.orderId}>{order.orderNumber || order.id}</AppText>
                <StatusPill status={order.status} />
              </View>
              <Row label="Placed" value={order.placedAt} />
              <Row label="Fulfillment" value={order.fulfillment || 'DELIVERY'} />
              <Row label="Items" value={String(order.lineItems?.length ?? 0)} />
              {order.totalChargedPaisa ? (
                <Row label="Order value" value={rupees(order.totalChargedPaisa)} />
              ) : null}
              {order.refundedPaisa ? <Row label="Refunded" value={rupees(order.refundedPaisa)} /> : null}
              {order.rejectionReason ? <Row label="Rejection reason" value={order.rejectionReason} /> : null}
            </Card>

            <Card style={styles.card}>
              <AppText style={styles.sectionTitle}>Items</AppText>
              {(order.lineItems ?? []).map((item) => (
                <View key={item.lineId} style={styles.itemRow}>
                  <AppText style={styles.itemName}>
                    {item.qty} × {item.name}
                    {item.variant ? ` (${item.variant})` : ''}
                  </AppText>
                  <AppText style={styles.itemPrice}>{rupees(item.unitPrice * 100 * item.qty)}</AppText>
                </View>
              ))}
            </Card>

            {order.status === 'NEW' ? (
              <Card style={styles.card}>
                <AppText style={styles.sectionTitle}>Decision</AppText>
                <AppText style={styles.label}>Reason (used only when rejecting)</AppText>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. Out of stock"
                  placeholderTextColor="#94a3b8"
                  maxLength={500}
                  style={styles.input}
                />
                <PrimaryButton label="Accept order" onPress={() => void accept()} loading={busy} />
                <PrimaryButton label="Reject and refund" variant="danger" onPress={reject} loading={busy} />
              </Card>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText style={styles.label}>{label}</AppText>
      <AppText style={styles.value}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: hs(16), paddingBottom: vs(32), gap: vs(10) },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: vs(4) },
  back: { fontSize: ms(14), fontWeight: '800', color: SP.brand },
  backSpacer: { width: hs(40) },
  title: { fontSize: ms(18), fontWeight: '900', color: SP.ink },
  card: { gap: vs(10) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(8) },
  orderId: { fontSize: ms(15), fontWeight: '900', color: SP.ink, flexShrink: 1 },
  label: { fontSize: ms(12), color: SP.muted, fontWeight: '700' },
  value: { fontSize: ms(13), color: SP.ink, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  sectionTitle: { fontSize: ms(15), fontWeight: '900', color: SP.ink },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: hs(8) },
  itemName: { fontSize: ms(13), color: SP.ink, flex: 1 },
  itemPrice: { fontSize: ms(13), color: SP.ink, fontWeight: '700' },
  input: {
    minHeight: vs(46),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: SP.line,
    backgroundColor: '#fff',
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    color: SP.ink,
  },
  muted: { fontSize: ms(13), color: SP.muted },
});
