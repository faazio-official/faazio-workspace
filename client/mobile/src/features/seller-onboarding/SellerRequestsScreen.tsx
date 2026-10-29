import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Store } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import InfoButton from '@/components/shared/InfoButton';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { gateway, type SellerApplication } from '@/services/api/GatewayClient';
import { isPartnerAdmin, useAuthStore } from '@/state/authStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerRequests'>;

const FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'PENDING_REVIEW', label: 'Pending' },
  { key: 'REJECTED', label: 'Rejected' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: '#B45309',
  ACTIVE: '#15803D',
  SUSPENDED: '#DC2626',
  REJECTED: '#7C3AED',
};

/**
 * Seller application review queue for DISTRICT_ADMIN (their district) / SUPER_ADMIN (all districts). The
 * server scopes the caller; the status tabs filter on the client. KYC documents always live in the
 * private R2 bucket and are only viewable on the detail screen through a presigned GET.
 */
export function SellerRequestsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState<SellerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const rows = await gateway.listSellerRequests();
      setItems(rows);
      setError(null);
    } catch {
      setError('Could not load seller applications right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!isPartnerAdmin(user)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.gate} />
        <AppText style={styles.gateTitle}>Admins only</AppText>
        <AppText style={styles.gateBody}>
          Seller review is available to district and super admins. Sign in with an admin account.
        </AppText>
      </View>
    );
  }

  const shown = filter ? items.filter((s) => s.status === filter) : items;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Seller requests</AppText>
        <InfoButton contentKey="SellerRequests" />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key || 'all'}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <AppText style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1162D3" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <AppText style={styles.errorText}>{error}</AppText>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()} activeOpacity={0.85}>
            <AppText style={styles.retryText}>Retry</AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(s) => s.sellerId}
          contentContainerStyle={[styles.listContent, shown.length === 0 && styles.emptyContent]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1162D3" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <AppText style={styles.emptyText}>No applications in this view.</AppText>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('SellerRequestDetail', { sellerId: item.sellerId })}
              accessibilityRole="button"
            >
              <View style={styles.rowIcon}>
                <Store size={ms(18)} color="#1162D3" strokeWidth={2.2} />
              </View>
              <View style={styles.rowText}>
                <AppText style={styles.rowTitle} numberOfLines={1}>
                  {item.businessName}
                </AppText>
                <AppText style={styles.rowSubtitle}>
                  {item.category} · {item.districtCode || item.stateCode} · {item.platformFeePct}% fee
                </AppText>
              </View>
              <View style={styles.rowRight}>
                <View
                  style={[styles.statusPill, { backgroundColor: STATUS_COLORS[item.status] ?? '#94A3B8' }]}
                >
                  <AppText style={styles.statusText}>{item.status.replace('_', ' ')}</AppText>
                </View>
                <ChevronRight size={ms(18)} color="#94A3B8" strokeWidth={2.2} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerSpacer: { width: ms(40) },
  backButton: { width: ms(40), height: ms(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: ms(18), fontWeight: '900', color: '#0f172a' },
  filterRow: {
    flexDirection: 'row',
    gap: hs(8),
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
  },
  filterChip: {
    paddingHorizontal: hs(14),
    paddingVertical: vs(8),
    borderRadius: ms(20),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: { backgroundColor: '#1162D3', borderColor: '#1162D3' },
  filterText: { fontSize: ms(12), fontWeight: '700', color: '#64748B' },
  filterTextActive: { color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: hs(24) },
  listContent: { paddingHorizontal: hs(16), paddingBottom: SPACE.LIST_BOTTOM },
  emptyContent: { flexGrow: 1 },
  emptyText: { fontSize: ms(13), color: '#94A3B8', fontWeight: '600' },
  errorText: { fontSize: ms(13), color: '#DC2626', fontWeight: '700', textAlign: 'center' },
  retryBtn: {
    marginTop: vs(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(10),
    borderRadius: ms(12),
    backgroundColor: '#1162D3',
  },
  retryText: { fontSize: ms(12), fontWeight: '800', color: '#FFFFFF' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    padding: hs(14),
    marginBottom: SPACE.BLOCK,
    gap: hs(10),
  },
  rowIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: ms(14), fontWeight: '800', color: '#0f172a' },
  rowSubtitle: { fontSize: ms(11), color: '#94A3B8', marginTop: vs(3), fontWeight: '600' },
  rowRight: { alignItems: 'flex-end', gap: vs(6) },
  statusPill: { paddingHorizontal: hs(8), paddingVertical: vs(3), borderRadius: ms(10) },
  statusText: { fontSize: ms(9.5), fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  gate: { flex: 1 },
  gateTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: vs(8),
  },
  gateBody: {
    fontSize: ms(12),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: ms(18),
    marginTop: vs(6),
    paddingHorizontal: hs(24),
  },
});

export default SellerRequestsScreen;