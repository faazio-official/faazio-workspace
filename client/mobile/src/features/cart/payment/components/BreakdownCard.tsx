import React from 'react';
import { StyleSheet, View } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import type { FulfillmentMode } from '@data/types';

interface BreakdownCardProps {
  /** Amount the user will pay (after any coin redemption). */
  total: number;
  /** Ordered value (GST-inclusive product subtotal). */
  subtotal?: number;
  /** Customer-visible delivery fee. */
  deliveryFee?: number;
  /** PICKUP hides the delivery-fee row (waived). */
  fulfillment?: FulfillmentMode;
}

/**
 * Pale-blue "to pay" card at the top of the payment/fulfillment steps. Shows the
 * exact 2-row customer breakdown (ordered value + delivery fee) and the total.
 * GST is inside the product prices, so there is deliberately no tax row.
 */
export default function BreakdownCard({ total, subtotal, deliveryFee, fulfillment }: BreakdownCardProps) {
  const showDelivery = fulfillment !== 'PICKUP';
  return (
    <View style={styles.card}>
      <View style={styles.totalRow}>
        <AppText style={styles.toPayLabel}>to pay:</AppText>
        <AppText style={styles.totalValue}>₹{total.toLocaleString('en-IN')}</AppText>
      </View>
      {(subtotal !== undefined || deliveryFee !== undefined) && (
        <View style={styles.rows}>
          <View style={styles.row}>
            <AppText style={styles.rowLabel}>Ordered value</AppText>
            <AppText style={styles.rowValue}>₹{(subtotal ?? 0).toLocaleString('en-IN')}</AppText>
          </View>
          {showDelivery && (
            <View style={styles.row}>
              <AppText style={styles.rowLabel}>Delivery fee</AppText>
              <AppText style={styles.rowValue}>
                {deliveryFee ? `₹${deliveryFee.toLocaleString('en-IN')}` : 'Free'}
              </AppText>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#E3F2FD',
    borderRadius: ms(16),
    borderWidth: 1,
    borderColor: '#BBDEFB',
    paddingHorizontal: hs(16),
    paddingVertical: vs(14),
    marginBottom: vs(14),
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  toPayLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#0F4C81',
  },
  totalValue: {
    fontSize: ms(20),
    fontWeight: '900',
    color: '#0F4C81',
  },
  rows: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(15, 76, 129, 0.14)',
    marginTop: vs(10),
    paddingTop: vs(8),
    gap: vs(4),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: ms(11),
    color: '#4A6E93',
    fontWeight: '600',
  },
  rowValue: {
    fontSize: ms(11),
    color: '#0D2E4D',
    fontWeight: '800',
  },
});