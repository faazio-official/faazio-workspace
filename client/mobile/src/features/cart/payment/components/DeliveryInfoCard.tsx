import React from 'react';
import { StyleSheet, View } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { BRAND } from '../constants';
import { DELIVERY_ORIGIN } from '../paymentData';
import type { FulfillmentMode, PickupPoint } from '@data/types';

interface DeliveryInfoCardProps {
  origin?: string;
  originAddress: string;
  destination?: string;
  destinationAddress: string;
  eta: string;
  /** Fulfillment mode. PICKUP renders a single pickup card instead of the timeline. */
  fulfillment?: FulfillmentMode;
  /** The chosen pickup point — required when fulfillment is PICKUP. */
  pickup?: PickupPoint;
  /** Contact phone shown on the pickup card (no fabricated PII — user profile). */
  contactPhone?: string;
}

/**
 * White card with rounded bottom corners + subtle shadow. For delivery it renders
 * a vertical timeline (origin dot → destination dot + "Delivery in: X"). For
 * self-pickup it collapses to a single "Pickup at" card with hours + contact.
 */
export default function DeliveryInfoCard({
  origin = DELIVERY_ORIGIN,
  originAddress,
  destination,
  destinationAddress,
  eta,
  fulfillment = 'DELIVERY',
  pickup,
  contactPhone,
}: DeliveryInfoCardProps) {
  if (fulfillment === 'PICKUP') {
    return (
      <View style={styles.card}>
        <TimelineRow
          label={pickup?.name ?? destination ?? 'Pickup point'}
          address={pickup?.address ?? destinationAddress}
          dot={<View style={styles.destDot} />}
          last
        />
        {pickup ? (
          <View style={styles.pickupMeta}>
            {pickup.hours ? (
              <AppText style={styles.pickupMetaText}>Open {pickup.hours}</AppText>
            ) : null}
            {contactPhone ? (
              <AppText style={styles.pickupMetaText}>Pickup contact: {contactPhone}</AppText>
            ) : null}
          </View>
        ) : null}
        <View style={styles.etaRow}>
          <AppText style={styles.etaLabel}>Ready for pickup in: </AppText>
          <AppText style={styles.etaValue}>{eta}</AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <TimelineRow
        label={origin}
        address={originAddress}
        dot={<View style={styles.originDot} />}
      />
      <TimelineRow
        label={destination}
        address={destinationAddress}
        dot={<View style={styles.destDot} />}
        last
      />
      <View style={styles.etaRow}>
        <AppText style={styles.etaLabel}>Delivery in: </AppText>
        <AppText style={styles.etaValue}>{eta}</AppText>
      </View>
    </View>
  );
}

function TimelineRow({
  label,
  address,
  dot,
  last = false,
}: {
  label?: string;
  address: string;
  dot: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineCol}>
        {dot}
        {!last && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.textCol}>
        <AppText style={styles.label} numberOfLines={1}>
          {label}
        </AppText>
        <AppText style={styles.address} numberOfLines={1}>
          {address}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: ms(16),
    borderBottomRightRadius: ms(16),
    paddingHorizontal: hs(16),
    paddingTop: vs(2),
    paddingBottom: vs(16),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineCol: {
    width: ms(20),
    alignItems: 'center',
    marginRight: hs(12),
  },
  originDot: {
    width: ms(12),
    height: ms(12),
    borderRadius: ms(6),
    borderWidth: 2,
    borderColor: BRAND.purple,
    backgroundColor: '#ffffff',
    marginTop: vs(4),
  },
  destDot: {
    width: ms(12),
    height: ms(12),
    borderRadius: ms(6),
    backgroundColor: BRAND.purple,
    marginTop: vs(4),
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: vs(26),
    backgroundColor: '#E5E7EB',
    marginVertical: vs(3),
  },
  textCol: {
    flex: 1,
    paddingBottom: vs(14),
  },
  pickupMeta: {
    marginTop: vs(2),
    gap: vs(4),
    paddingBottom: vs(14),
  },
  pickupMetaText: {
    fontSize: ms(11),
    color: '#6B7280',
    fontWeight: '600',
  },
  label: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BRAND.ink,
    marginTop: vs(2),
  },
  address: {
    fontSize: ms(11),
    color: '#6B7280',
    marginTop: vs(2),
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: vs(14),
    marginTop: vs(2),
  },
  etaLabel: {
    fontSize: ms(13),
    color: '#4B5563',
  },
  etaValue: {
    fontSize: ms(13),
    fontWeight: '700',
    color: BRAND.ink,
  },
});
