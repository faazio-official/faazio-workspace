import React from 'react';
import { StyleSheet, View } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import type { FulfillmentMode } from '@data/types';
import type { DeliveryFeeBreakdown } from '../../utils';

interface BreakdownCardProps {
  /** Amount the user will pay (after any coin redemption). */
  total: number;
  /** Ordered value (GST-inclusive product subtotal). */
  subtotal?: number;
  /** Customer-visible delivery fee. */
  deliveryFee?: number;
  /** Server quote (distance + surges) so the bill is never a mystery number. */
  deliveryBreakdown?: DeliveryFeeBreakdown;
  /** PICKUP hides the delivery-fee row (waived). */
  fulfillment?: FulfillmentMode;
}

/**
 * Pale-blue "to pay" card at the top of the payment/fulfillment steps. Shows the
 * exact 2-row customer breakdown (ordered value + delivery fee) and the total.
 * GST is inside the product prices, so there is deliberately no tax row.
 */
/** Rupees with paise only when the amount is not whole (fractional km can bill 50.40). */
function formatRupees(rupees: number): string {
  const whole = Number.isInteger(rupees);
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
const formatPaisa = (paisa: number) => formatRupees(paisa / 100);

export default function BreakdownCard({
  total,
  subtotal,
  deliveryFee,
  deliveryBreakdown,
  fulfillment,
}: BreakdownCardProps) {
  const showDelivery = fulfillment !== 'PICKUP';
  return (
    <View style={styles.card}>
      <View style={styles.totalRow}>
        <AppText style={styles.toPayLabel}>to pay:</AppText>
        <AppText style={styles.totalValue}>{formatRupees(total)}</AppText>
      </View>
      {(subtotal !== undefined || deliveryFee !== undefined) && (
        <View style={styles.rows}>
          <View style={styles.row}>
            <AppText style={styles.rowLabel}>Ordered value</AppText>
            <AppText style={styles.rowValue}>{formatRupees(subtotal ?? 0)}</AppText>
          </View>
          {showDelivery && deliveryBreakdown ? (
            <>
              <View style={styles.row}>
                <AppText style={styles.rowLabel}>
                  Delivery base ({deliveryBreakdown.baseDistanceKm ?? 3} km)
                </AppText>
                <AppText style={styles.rowValue}>
                  {formatPaisa(deliveryBreakdown.baseFeePaisa)}
                </AppText>
              </View>
              {deliveryBreakdown.extraKmPaisa > 0 && (
                <View style={styles.row}>
                  <AppText style={styles.rowLabel}>
                    Extra distance ({deliveryBreakdown.distanceKm.toFixed(1)} km)
                  </AppText>
                  <AppText style={styles.rowValue}>
                    {formatPaisa(deliveryBreakdown.extraKmPaisa)}
                  </AppText>
                </View>
              )}
              {deliveryBreakdown.nightSurgePaisa > 0 && (
                <View style={styles.row}>
                  <AppText style={styles.rowLabel}>Night surge</AppText>
                  <AppText style={styles.rowValue}>
                    {formatPaisa(deliveryBreakdown.nightSurgePaisa)}
                  </AppText>
                </View>
              )}
              {deliveryBreakdown.weatherSurgePaisa > 0 && (
                <View style={styles.row}>
                  <AppText style={styles.rowLabel}>Rain surge</AppText>
                  <AppText style={styles.rowValue}>
                    {formatPaisa(deliveryBreakdown.weatherSurgePaisa)}
                  </AppText>
                </View>
              )}
              {deliveryBreakdown.festivalSurgePaisa > 0 && (
                <View style={styles.row}>
                  <AppText style={styles.rowLabel}>Festival surge</AppText>
                  <AppText style={styles.rowValue}>
                    {formatPaisa(deliveryBreakdown.festivalSurgePaisa)}
                  </AppText>
                </View>
              )}
            </>
          ) : (
            showDelivery && (
              <View style={styles.row}>
                <AppText style={styles.rowLabel}>Delivery fee</AppText>
                <AppText style={styles.rowValue}>
                  {deliveryFee ? formatRupees(deliveryFee) : 'Free'}
                </AppText>
              </View>
            )
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