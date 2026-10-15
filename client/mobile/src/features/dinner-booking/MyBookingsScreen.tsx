import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, CalendarClock, Users } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '@/features/food/constants/theme';
import { gateway } from '@/services/api/GatewayClient';
import type { BookingRecordDto } from '@/services/api/GatewayClient';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MyBookings'>;

const STATUS_COPY: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: foodTheme.primary },
  confirmed: { label: 'Confirmed', color: foodTheme.ratingGreen },
  rejected: { label: 'Not available', color: foodTheme.danger },
  cancelled: { label: 'Cancelled', color: foodTheme.textSecondary },
  completed: { label: 'Completed', color: foodTheme.textSecondary },
};

/** The caller's seat reservations (server-backed, local fallback empty). */
export function MyBookingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<BookingRecordDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    gateway
      .getBookings()
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const cancel = useCallback(
    async (id: string) => {
      await gateway.cancelBooking(id);
      load();
    },
    [load],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft color={foodTheme.textPrimary} size={ms(20)} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>My bookings</AppText>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={foodTheme.primary} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<AppText style={styles.empty}>No reservations yet.</AppText>}
          renderItem={({ item }) => {
            const status = STATUS_COPY[item.status] ?? STATUS_COPY.pending;
            const cancellable = item.status === 'pending' || item.status === 'confirmed';
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <AppText style={styles.venue} numberOfLines={1}>
                    {item.restaurantName || 'Restaurant'}
                  </AppText>
                  <View style={[styles.statusPill, { borderColor: status.color }]}>
                    <AppText style={[styles.statusText, { color: status.color }]}>{status.label}</AppText>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <CalendarClock color={foodTheme.textSecondary} size={ms(14)} />
                  <AppText style={styles.metaText}>{item.date}</AppText>
                  <Users color={foodTheme.textSecondary} size={ms(14)} style={styles.metaIconSpaced} />
                  <AppText style={styles.metaText}>
                    {item.seats} seat{item.seats === 1 ? '' : 's'} • ₹{item.fee}
                  </AppText>
                </View>
                {item.status === 'rejected' ? (
                  <AppText style={styles.reasonCopy}>
                    Restaurant couldn't accommodate — likely limited seats. Refund initiated.
                  </AppText>
                ) : null}
                {cancellable ? (
                  <TouchableOpacity onPress={() => cancel(item.id)} style={styles.cancelBtn} accessibilityRole="button">
                    <AppText style={styles.cancelText}>Cancel & refund</AppText>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

export default MyBookingsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: foodTheme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingBottom: vs(12),
    backgroundColor: foodTheme.sectionBg,
  },
  backBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: foodTheme.background,
  },
  headerTitle: { fontSize: ms(18), fontWeight: 'bold', color: foodTheme.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: hs(16), gap: vs(12) },
  empty: { textAlign: 'center', color: foodTheme.textSecondary, marginTop: vs(40) },
  card: {
    backgroundColor: foodTheme.sectionBg,
    borderRadius: ms(16),
    padding: hs(14),
    ...foodTheme.shadowCard,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(8) },
  venue: { flex: 1, fontSize: ms(15), fontWeight: '700', color: foodTheme.textPrimary },
  statusPill: { borderWidth: 1, borderRadius: ms(10), paddingHorizontal: hs(8), paddingVertical: vs(2) },
  statusText: { fontSize: ms(11), fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: vs(10), gap: hs(6) },
  metaIconSpaced: { marginLeft: hs(10) },
  metaText: { fontSize: ms(13), color: foodTheme.textSecondary },
  reasonCopy: { marginTop: vs(10), fontSize: ms(12), color: foodTheme.danger, lineHeight: ms(17) },
  cancelBtn: { marginTop: vs(12), alignSelf: 'flex-start' },
  cancelText: { fontSize: ms(13), fontWeight: '700', color: foodTheme.primary },
});