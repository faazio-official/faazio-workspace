import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, Percent, X } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { gateway, type FeeChangeRequest } from '@/services/api/GatewayClient';
import { isPartnerAdmin, useAuthStore } from '@/state/authStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FeeChangeRequests'>;

const FILTERS: { key: string; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: '', label: 'All' },
];

/**
 * Platform-fee change review queue. A district admin sees only their district (server-scoped);
 * a super admin sees every district. Approval applies the new fee to the seller.
 */
export function FeeChangeRequestsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState('PENDING');
  const [items, setItems] = useState<FeeChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<FeeChangeRequest | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      try {
        setItems(await gateway.listFeeChangeRequests(undefined, status || undefined));
        setError(null);
      } catch {
        setError('Could not load fee-change requests right now.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [status],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const approve = (item: FeeChangeRequest) => {
    Alert.alert(
      'Approve fee change',
      `${item.businessName || item.sellerId}: ${item.currentFeePct}% → ${item.requestedFeePct}%?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => {
            setBusyId(item.requestId);
            gateway
              .approveFeeChangeRequest(item.requestId)
              .then(() => load())
              .catch(() => setError('Could not approve the request.'))
              .finally(() => setBusyId(null));
          },
        },
      ],
    );
  };

  const reject = () => {
    if (!rejecting || reason.trim().length < 4) return;
    const id = rejecting.requestId;
    setRejecting(null);
    setReason('');
    setBusyId(id);
    gateway
      .rejectFeeChangeRequest(id, reason.trim())
      .then(() => load())
      .catch(() => setError('Could not reject the request.'))
      .finally(() => setBusyId(null));
  };

  if (!isPartnerAdmin(user)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppText style={styles.gateTitle}>Admins only</AppText>
        <AppText style={styles.gateBody}>
          Fee-change review is available to district and super admins.
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Fee change requests</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = status === f.key;
          return (
            <TouchableOpacity
              key={f.key || 'all'}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatus(f.key)}
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
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.requestId}
          contentContainerStyle={[styles.listContent, items.length === 0 && styles.emptyContent]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1162D3" />
          }
          ListHeaderComponent={
            error ? (
              <AppText style={styles.error}>{error}</AppText>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <AppText style={styles.emptyText}>No requests in this view.</AppText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Percent size={ms(18)} color="#1162D3" strokeWidth={2.2} />
              </View>
              <View style={styles.rowText}>
                <AppText style={styles.rowTitle} numberOfLines={1}>
                  {item.businessName || item.sellerId}
                </AppText>
                <AppText style={styles.rowSubtitle}>
                  {item.currentFeePct}% → {item.requestedFeePct}%
                  {item.districtCode ? ` · ${item.districtCode}` : ''}
                </AppText>
                {item.reviewReason ? (
                  <AppText style={styles.rowReason}>{item.reviewReason}</AppText>
                ) : null}
              </View>
              {item.status === 'PENDING' ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => approve(item)}
                    disabled={busyId === item.requestId}
                    accessibilityRole="button"
                    accessibilityLabel={`Approve request from ${item.businessName || item.sellerId}`}
                  >
                    <Check size={ms(16)} color="#FFFFFF" strokeWidth={2.6} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => setRejecting(item)}
                    disabled={busyId === item.requestId}
                    accessibilityRole="button"
                    accessibilityLabel={`Reject request from ${item.businessName || item.sellerId}`}
                  >
                    <X size={ms(16)} color="#FFFFFF" strokeWidth={2.6} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.statusPill}>
                  <AppText style={styles.statusText}>{item.status}</AppText>
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={!!rejecting} transparent animationType="fade" onRequestClose={() => setRejecting(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <AppText style={styles.modalTitle}>Reject request</AppText>
            <AppText style={styles.muted}>
              Give the seller a short reason. It is stored on the request and in the audit log.
            </AppText>
            <AppTextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (min 4 characters)"
              style={styles.input}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => {
                  setRejecting(null);
                  setReason('');
                }}
              >
                <AppText style={styles.modalCancelText}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirm]}
                onPress={reject}
                disabled={reason.trim().length < 4}
              >
                <AppText style={styles.modalConfirmText}>Reject</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  filterRow: { flexDirection: 'row', gap: hs(8), paddingHorizontal: hs(16), paddingVertical: vs(12) },
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
  error: { fontSize: ms(12), color: '#DC2626', fontWeight: '700', marginBottom: vs(8) },
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
  rowReason: { fontSize: ms(11), color: '#64748B', marginTop: vs(3) },
  actions: { flexDirection: 'row', gap: hs(6) },
  actionBtn: { width: ms(34), height: ms(34), borderRadius: ms(10), alignItems: 'center', justifyContent: 'center' },
  approveBtn: { backgroundColor: '#15803D' },
  rejectBtn: { backgroundColor: '#DC2626' },
  statusPill: { backgroundColor: '#94A3B8', paddingHorizontal: hs(8), paddingVertical: vs(3), borderRadius: ms(10) },
  statusText: { fontSize: ms(9.5), fontWeight: '800', color: '#FFFFFF' },
  gateTitle: { fontSize: ms(16), fontWeight: '900', color: '#0f172a', textAlign: 'center', marginTop: vs(40) },
  gateBody: {
    fontSize: ms(12),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: ms(18),
    marginTop: vs(6),
    paddingHorizontal: hs(24),
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: hs(20),
  },
  modalCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: ms(18), padding: hs(18) },
  modalTitle: { fontSize: ms(16), fontWeight: '900', color: '#0f172a', marginBottom: vs(6) },
  muted: { fontSize: ms(12), color: '#64748B', lineHeight: ms(18) },
  input: {
    marginTop: vs(12),
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: ms(12),
    paddingHorizontal: hs(12),
    paddingVertical: vs(10),
    fontSize: ms(14),
    color: '#0f172a',
    minHeight: vs(72),
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: hs(10), marginTop: vs(16) },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: vs(12), borderRadius: ms(12) },
  modalCancel: { backgroundColor: '#F1F5F9' },
  modalCancelText: { fontSize: ms(13), fontWeight: '800', color: '#475569' },
  modalConfirm: { backgroundColor: '#DC2626' },
  modalConfirmText: { fontSize: ms(13), fontWeight: '800', color: '#FFFFFF' },
});

export default FeeChangeRequestsScreen;
