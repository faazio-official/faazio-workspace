import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CalendarClock, CheckCircle2, Minus, Plus, Users, XCircle } from 'lucide-react-native';
import AppText from '@/components/AppText';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '@/features/food/constants/theme';
import { gateway } from '@/services/api/GatewayClient';
import type { BookingAvailabilityDto, BookingRecordDto } from '@/services/api/GatewayClient';

const FEE_FALLBACK = 50;
const MAX_SEATS = 10;

export interface BookingVenue {
  id: string;
  name: string;
}

interface BookingSheetProps {
  visible: boolean;
  venue: BookingVenue | null;
  onClose: () => void;
}

/**
 * Seat-reservation bottom sheet. The venue opts into bookings; the user picks N seats and the sheet
 * shows the live N × ₹50 total. The server derives the fee and returns a Razorpay order; seat
 * internals (totals / remaining) are never rendered — only bookable + fee + timing.
 */
export default function BookingSheet({ visible, venue, onClose }: BookingSheetProps) {
  const [availability, setAvailability] = useState<BookingAvailabilityDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [seats, setSeats] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingRecordDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const venueId = venue?.id ?? '';

  useEffect(() => {
    if (!visible || !venueId) return;
    let alive = true;
    setLoading(true);
    setResult(null);
    setError(null);
    setSeats(2);
    gateway
      .getBookingAvailability(venueId)
      .then((a) => alive && setAvailability(a))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visible, venueId]);

  const feePerSeat = availability?.feePerSeat ?? FEE_FALLBACK;

  const submit = useCallback(async () => {
    if (!venue || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const booking = await gateway.createBooking({
        vendorId: venue.id,
        restaurantName: venue.name,
        date: new Date().toISOString().slice(0, 10),
        seats,
      });
      setResult(booking);
    } catch {
      setError('Could not place the request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [venue, seats, submitting]);

  const statusLine = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return 'Table confirmed';
      case 'rejected':
        return "Restaurant couldn't accommodate — likely limited seats. Refund initiated.";
      case 'cancelled':
        return 'Booking cancelled. Refund initiated.';
      case 'completed':
        return 'Visit completed';
      default:
        return 'Awaiting the restaurant — your seats are held.';
    }
  };

  return (
    <SlideUpSheet visible={visible} onRequestClose={onClose}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={foodTheme.primary} />
        </View>
      ) : result ? (
        <View style={styles.body}>
          {result.status === 'rejected' || result.status === 'cancelled' ? (
            <XCircle color={foodTheme.danger} size={ms(44)} />
          ) : (
            <CheckCircle2 color={foodTheme.ratingGreen} size={ms(44)} />
          )}
          <AppText style={styles.title}>{result.status === 'pending' ? 'Request sent' : 'Booking update'}</AppText>
          <AppText style={styles.subtle}>{statusLine(result.status)}</AppText>
          <View style={styles.summary}>
            <AppText style={styles.summaryText}>
              {venue?.name} • {result.seats} seat{result.seats === 1 ? '' : 's'}
            </AppText>
            <AppText style={styles.summaryText}>₹{result.fee} held</AppText>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={onClose} accessibilityRole="button">
            <AppText style={styles.primaryBtnText}>Done</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.body}>
          <AppText style={styles.eyebrow}>Reserve seats</AppText>
          <AppText style={styles.title}>{venue?.name}</AppText>

          <View style={styles.metaRow}>
            <CalendarClock color={foodTheme.textSecondary} size={ms(15)} />
            <AppText style={styles.metaText}>
              {availability?.timingLabel ? `Today • ${availability.timingLabel}` : 'Today'}
            </AppText>
          </View>
          <View style={styles.metaRow}>
            <Users color={foodTheme.textSecondary} size={ms(15)} />
            <AppText style={styles.metaText}>₹{feePerSeat}/seat platform fee • pay only if accepted</AppText>
          </View>

          <View style={styles.stepperRow}>
            <AppText style={styles.stepperLabel}>Seats</AppText>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepBtn, seats <= 1 && styles.stepBtnDisabled]}
                disabled={seats <= 1}
                onPress={() => setSeats((n) => Math.max(1, n - 1))}
                accessibilityRole="button"
                accessibilityLabel="Fewer seats"
              >
                <Minus color={foodTheme.textPrimary} size={ms(16)} />
              </TouchableOpacity>
              <AppText style={styles.seatCount}>{seats}</AppText>
              <TouchableOpacity
                style={[styles.stepBtn, seats >= MAX_SEATS && styles.stepBtnDisabled]}
                disabled={seats >= MAX_SEATS}
                onPress={() => setSeats((n) => Math.min(MAX_SEATS, n + 1))}
                accessibilityRole="button"
                accessibilityLabel="More seats"
              >
                <Plus color={foodTheme.textPrimary} size={ms(16)} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.totalRow}>
            <AppText style={styles.totalLabel}>{seats} × ₹{feePerSeat}</AppText>
            <AppText style={styles.totalValue}>₹{seats * feePerSeat}</AppText>
          </View>

          {error ? <AppText style={styles.error}>{error}</AppText> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.stepBtnDisabled]}
            onPress={submit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <AppText style={styles.primaryBtnText}>Request {seats} seat{seats === 1 ? '' : 's'} • ₹{seats * feePerSeat}</AppText>
            )}
          </TouchableOpacity>
          <AppText style={styles.legal}>₹{feePerSeat} refunded automatically if the restaurant can't accommodate you.</AppText>
        </View>
      )}
    </SlideUpSheet>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: vs(48) },
  body: { alignItems: 'center', width: '100%', paddingTop: vs(6) },
  eyebrow: {
    fontSize: ms(12),
    fontWeight: '700',
    color: foodTheme.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: { fontSize: ms(20), fontWeight: 'bold', color: foodTheme.textPrimary, marginTop: vs(4) },
  subtle: {
    fontSize: ms(13),
    color: foodTheme.textSecondary,
    textAlign: 'center',
    marginTop: vs(8),
    paddingHorizontal: hs(8),
    lineHeight: ms(19),
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: hs(8), marginTop: vs(12) },
  metaText: { fontSize: ms(13), color: foodTheme.textSecondary },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: vs(20),
    paddingHorizontal: hs(4),
  },
  stepperLabel: { fontSize: ms(15), fontWeight: '600', color: foodTheme.textPrimary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: hs(14) },
  stepBtn: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(19),
    borderWidth: 1,
    borderColor: foodTheme.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: foodTheme.sectionBg,
  },
  stepBtnDisabled: { opacity: 0.4 },
  seatCount: { fontSize: ms(20), fontWeight: 'bold', color: foodTheme.textPrimary, minWidth: ms(24), textAlign: 'center' },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: vs(18),
    paddingTop: vs(14),
    borderTopWidth: 1,
    borderTopColor: foodTheme.divider,
    paddingHorizontal: hs(4),
  },
  totalLabel: { fontSize: ms(14), color: foodTheme.textSecondary },
  totalValue: { fontSize: ms(20), fontWeight: 'bold', color: foodTheme.textPrimary },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: vs(16),
    padding: hs(14),
    borderRadius: ms(14),
    backgroundColor: foodTheme.background,
  },
  summaryText: { fontSize: ms(14), color: foodTheme.textPrimary, fontWeight: '600' },
  error: { fontSize: ms(13), color: foodTheme.danger, marginTop: vs(10), textAlign: 'center' },
  primaryBtn: {
    marginTop: vs(18),
    width: '100%',
    minHeight: vs(50),
    borderRadius: ms(14),
    backgroundColor: foodTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: ms(15), fontWeight: '700' },
  legal: { fontSize: ms(11), color: foodTheme.textMuted, textAlign: 'center', marginTop: vs(10), marginBottom: vs(4) },
});