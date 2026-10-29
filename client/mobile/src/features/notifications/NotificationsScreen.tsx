import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, ChevronLeft, PackageOpen } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import InfoButton from '@/components/shared/InfoButton';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import { gateway, type NotificationRecord } from '@/services/api/GatewayClient';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const formatWhen = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Server-authoritative notification inbox (`notifications.outbox`). Push delivers the alert; this
 * screen is the durable in-app record and works even when FCM/APNs is unavailable.
 */
export function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const rows = await gateway.getNotifications();
      setItems(rows);
      setError(null);
    } catch {
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const empty = !loading && items.length === 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Notifications</AppText>
          <InfoButton contentKey="Notifications" />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor="#1162D3"
          />
        }
      >
        {loading && items.length === 0 ? (
          <View style={styles.emptyState}>
            <AppText style={styles.emptyTitle}>Loading notifications...</AppText>
          </View>
        ) : empty ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              {error ? (
                <Bell size={ms(32)} color="#9CA3AF" strokeWidth={2} />
              ) : (
                <PackageOpen size={ms(32)} color="#9CA3AF" strokeWidth={2} />
              )}
            </View>
            <AppText style={styles.emptyTitle}>
              {error ? 'Notifications unavailable' : 'No notifications yet'}
            </AppText>
            <AppText style={styles.emptySubtitle}>
              {error
                ? 'Pull down to try again.'
                : 'Order and prescription updates will appear here.'}
            </AppText>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <AppText style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </AppText>
                  <View
                    style={[
                      styles.statusPill,
                      item.status === 'SENT' ? styles.statusSent : styles.statusPending,
                    ]}
                  >
                    <AppText
                      style={[
                        styles.statusText,
                        item.status === 'SENT' ? styles.statusTextSent : styles.statusTextPending,
                      ]}
                    >
                      {item.status === 'SENT' ? 'Delivered' : item.status}
                    </AppText>
                  </View>
                </View>
                <AppText style={styles.cardBody}>{item.body}</AppText>
                <AppText style={styles.cardWhen}>{formatWhen(item.createdAt)}</AppText>
              </View>
            ))}
            <View style={styles.bottomSpacer} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    backgroundColor: '#FFFFFF',
    paddingBottom: SPACE.BLOCK,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
  },
  backButton: { marginRight: hs(8), padding: hs(2) },
  headerTitle: { fontSize: ms(18), fontWeight: '800', color: '#111827' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACE.LIST_BOTTOM },
  list: { paddingHorizontal: hs(16), paddingTop: SPACE.BLOCK },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    padding: hs(16),
    marginBottom: SPACE.BLOCK,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: hs(8),
  },
  cardTitle: { flex: 1, fontSize: ms(14), fontWeight: '800', color: '#111827' },
  cardBody: {
    fontSize: ms(13),
    color: '#4B5563',
    lineHeight: ms(19),
    marginTop: vs(6),
  },
  cardWhen: { fontSize: ms(11), color: '#9CA3AF', marginTop: vs(10) },
  statusPill: {
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    borderRadius: ms(6),
  },
  statusSent: { backgroundColor: '#DCFCE7' },
  statusPending: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: ms(10), fontWeight: '700' },
  statusTextSent: { color: '#16A34A' },
  statusTextPending: { color: '#D97706' },
  emptyState: {
    alignItems: 'center',
    paddingTop: vs(72),
    paddingHorizontal: hs(32),
  },
  emptyIconBox: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(36),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  emptyTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#111827',
    marginBottom: vs(6),
    textAlign: 'center',
  },
  emptySubtitle: { fontSize: ms(13), color: '#6B7280', textAlign: 'center' },
  bottomSpacer: { height: vs(40) },
});
