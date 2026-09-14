import React, { memo, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { CheckCircle, Store, FileText, PackageCheck } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StoreProfile } from '@data/types';
import type { FulfillmentMode } from '@data/types';
import { PHARMA_TEAL, PHARMA_INK } from '../mocks/pharmaHomeFeed';

interface PrescriptionOrderConfirmedViewProps {
  orderId: string;
  vendor: StoreProfile | null;
  fulfillment: FulfillmentMode;
  pages: number;
  note: string;
  onTrack: () => void;
  onDone: () => void;
}

const PrescriptionOrderConfirmedView = memo(function PrescriptionOrderConfirmedView({
  orderId,
  vendor,
  fulfillment,
  pages,
  note,
  onTrack,
  onDone,
}: PrescriptionOrderConfirmedViewProps) {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + vs(16) }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Receipt Success */}
      <View style={styles.header}>
        <View style={styles.checkCircle}>
          <CheckCircle size={ms(26)} color={PHARMA_TEAL} strokeWidth={2.5} />
        </View>
        <AppText style={styles.title}>Order Confirmed!</AppText>
        <AppText style={styles.orderId}>ID: {orderId}</AppText>
      </View>

      {/* Unified Real-Time Tracking Status */}
      <View style={styles.liveTrackingBox}>
        <View style={styles.liveTrackingHeader}>
          <View style={styles.liveTrackingHeaderLeft}>
            <Animated.View style={{ opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) }}>
              <Store size={ms(10)} color="#475569" style={{ marginRight: hs(4) }} />
            </Animated.View>
            <AppText style={styles.liveTrackingLabel}>Real-Time Tracking Status</AppText>
          </View>
        </View>

        <View style={styles.liveStepsContainer}>
          <View style={styles.liveStepRow}>
            <View style={styles.liveStepDotOuter}>
              <Animated.View
                style={[
                  styles.liveStepActiveDotPulse,
                  { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
                ]}
              />
            </View>
            <View style={styles.liveStepTextCol}>
              <AppText style={styles.liveStepTitle}>Order has been placed</AppText>
              {fulfillment === 'PICKUP' && vendor?.address ? (
                <AppText style={styles.liveStepDesc} numberOfLines={2}>
                  Pickup from: {vendor.name}, {vendor.address}
                </AppText>
              ) : (
                <AppText style={styles.liveStepDesc}>Preparing your prescription for delivery</AppText>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Prescription details card */}
      <View style={styles.detailsSection}>
        <AppText style={styles.sectionLabel}>Prescription Details</AppText>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <PackageCheck size={ms(15)} color={PHARMA_TEAL} strokeWidth={2} />
            </View>
            <View style={styles.detailBody}>
              <AppText style={styles.detailLabel}>Pharmacy</AppText>
              <AppText style={styles.detailValue} numberOfLines={1}>
                {vendor?.name ?? '—'}
              </AppText>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Store size={ms(15)} color={PHARMA_TEAL} strokeWidth={2} />
            </View>
            <View style={styles.detailBody}>
              <AppText style={styles.detailLabel}>Mode</AppText>
              <AppText style={styles.detailValue}>
                {fulfillment === 'PICKUP' ? 'Self Pickup' : 'Delivery'}
              </AppText>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <FileText size={ms(15)} color={PHARMA_TEAL} strokeWidth={2} />
            </View>
            <View style={styles.detailBody}>
              <AppText style={styles.detailLabel}>Pages captured</AppText>
              <AppText style={styles.detailValue}>{pages}</AppText>
            </View>
          </View>
          {note ? (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <FileText size={ms(15)} color={PHARMA_TEAL} strokeWidth={2} />
                </View>
                <View style={styles.detailBody}>
                  <AppText style={styles.detailLabel}>Note for pharmacist</AppText>
                  <AppText style={styles.detailValue}>{note}</AppText>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.trackBtn} onPress={onTrack} activeOpacity={0.9}>
          <AppText style={styles.trackText}>Track My Order</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.85}>
          <AppText style={styles.doneText}>Done</AppText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
});

export default PrescriptionOrderConfirmedView;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: hs(16),
  },
  header: {
    alignItems: 'center',
    paddingVertical: vs(10),
  },
  checkCircle: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(10),
  },
  title: {
    fontSize: ms(15),
    fontWeight: '900',
    color: PHARMA_INK,
    textTransform: 'uppercase',
  },
  orderId: {
    fontSize: ms(9),
    color: '#94A3B8',
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: vs(4),
  },
  liveTrackingBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: ms(16),
    padding: hs(12),
    marginBottom: vs(14),
  },
  liveTrackingHeader: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    paddingBottom: vs(8),
    marginBottom: vs(10),
  },
  liveTrackingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveTrackingLabel: {
    fontSize: ms(8),
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  liveStepsContainer: {
    paddingLeft: hs(10),
  },
  liveStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  liveStepDotOuter: {
    position: 'absolute',
    left: hs(-10),
    top: vs(0),
    width: ms(14),
    height: ms(14),
    borderRadius: ms(7),
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveStepActiveDotPulse: {
    width: ms(10),
    height: ms(10),
    borderRadius: ms(5),
    backgroundColor: PHARMA_TEAL,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  liveStepTextCol: {
    marginLeft: hs(8),
    flex: 1,
  },
  liveStepTitle: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#1e293b',
  },
  liveStepDesc: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: vs(2),
  },
  detailsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(10),
  },
  sectionLabel: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: vs(8),
  },
  detailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: ms(14),
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: hs(12),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(10),
    backgroundColor: '#E0F2F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(10),
  },
  detailBody: {
    flex: 1,
  },
  detailLabel: {
    fontSize: ms(9),
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: ms(12),
    fontWeight: '800',
    color: PHARMA_INK,
    marginTop: vs(1),
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF2F6',
    marginVertical: vs(8),
  },
  actionRow: {
    flexDirection: 'row',
    gap: hs(10),
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(14),
    marginTop: vs(12),
  },
  trackBtn: {
    flex: 1,
    height: vs(46),
    borderRadius: ms(10),
    backgroundColor: PHARMA_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackText: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  doneBtn: {
    flex: 1,
    height: vs(46),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: ms(11),
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
  },
});
