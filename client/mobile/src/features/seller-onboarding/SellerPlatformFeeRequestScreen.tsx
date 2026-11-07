import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Percent } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { gateway, type FeeChangeRequest, type SellerApplicationVendor } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import type { RootStackParamList } from '@/navigation/types';
import { parentRamp } from '@/theme/brandTokens';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerPlatformFeeRequest'>;

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#B45309',
  APPROVED: '#15803D',
  REJECTED: '#DC2626',
  CANCELLED: '#64748B',
};

/**
 * Seller-facing platform-fee change request. The fee is a property of the SHOP (not the account), so
 * the seller first picks the vendor store that needs a new rate; the live fee is read from that
 * vendor and the request is filed against its store id for a district/super admin to approve.
 */
export function SellerPlatformFeeRequestScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const sellerId = route.params?.sellerId ?? user?.sellerId ?? '';

  const [vendors, setVendors] = useState<SellerApplicationVendor[]>([]);
  const [storeId, setStoreId] = useState(route.params?.storeId ?? '');
  const [app, setApp] = useState(route.params?.app ?? '');
  const [currentFeePct, setCurrentFeePct] = useState(route.params?.currentFeePct ?? 0);

  const [pct, setPct] = useState(route.params?.currentFeePct ? String(route.params.currentFeePct) : '');
  const [history, setHistory] = useState<FeeChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const activeVendor = vendors.find((v) => v.id === storeId) ?? null;

  const load = useCallback(async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoadError(false);
    try {
      setHistory(await gateway.listSellerFeeChangeRequests(sellerId));
    } catch {
      // history is a convenience; submission still works
    }
    let storesOk = true;
    try {
      const rows = await gateway.listSellerStores();
      setVendors(rows);
      if (!storeId && rows.length > 0) {
        setStoreId(rows[0]!.id);
        setApp(rows[0]!.app);
        setCurrentFeePct(rows[0]!.platformFeePct);
        setPct((prev) => prev || String(rows[0]!.platformFeePct));
      } else if (storeId) {
        const active = rows.find((v) => v.id === storeId);
        if (active) {
          setApp(active.app);
          setCurrentFeePct(active.platformFeePct);
        }
      }
    } catch {
      // stores stay unknown; validation still guards the submitted value
      storesOk = false;
    }
    setLoadError(!storesOk);
    setLoading(false);
  }, [route.params?.currentFeePct, sellerId, storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = history.find((h) => h.status === 'PENDING');

  const selectVendor = (id: string) => {
    const v = vendors.find((item) => item.id === id);
    if (!v) return;
    setStoreId(id);
    setApp(v.app);
    setCurrentFeePct(v.platformFeePct);
    setPct(String(v.platformFeePct));
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    const next = Number(pct);
    if (!Number.isInteger(next) || next < 1 || next > 100) {
      setError('Enter a whole percentage between 1 and 100.');
      return;
    }
    if (app.toUpperCase() === 'FOOD' && next < 5) {
      setError('Food vendors must keep the platform fee at 5% or higher.');
      return;
    }
    if (!storeId) {
      setError('Select the vendor store that needs the new fee.');
      return;
    }
    if (currentFeePct && next === currentFeePct) {
      setError('That is already this vendor\u2019s current platform fee.');
      return;
    }
    if (pending) {
      setError('A fee request is already pending approval.');
      return;
    }
    setBusy(true);
    try {
      await gateway.requestSellerPlatformFeeChange(sellerId, storeId, next);
      setNotice('Request submitted. An admin will review it.');
      await load();
    } catch {
      setError('Could not submit the request. A pending request may already exist.');
    } finally {
      setBusy(false);
    }
  };

  if (!sellerId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppText style={styles.gateTitle}>Seller account required</AppText>
        <AppText style={styles.gateBody}>
          Sign in with the seller account that owns this store to request a fee change.
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
        <AppText style={styles.headerTitle}>Platform fee</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Percent size={ms(18)} color={parentRamp.base} strokeWidth={2.2} />
            <AppText style={styles.cardTitle}>Request a fee change</AppText>
          </View>
          <AppText style={styles.muted}>
            Your platform fee is fixed when your store is approved. Ask for a new rate per shop here
            and an admin will review it.
          </AppText>

          {loading ? (
            <ActivityIndicator color={parentRamp.base} style={styles.loader} />
          ) : loadError ? (
            <>
              <AppText style={styles.muted}>
                Could not load your vendor stores. Check your connection and try again.
              </AppText>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => void load()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Retry loading vendor stores"
              >
                <AppText style={styles.retryText}>Try again</AppText>
              </TouchableOpacity>
            </>
          ) : vendors.length === 0 ? (
            <AppText style={styles.muted}>No vendor stores are linked to this account yet.</AppText>
          ) : (
            <>
              <AppText style={styles.label}>Vendor store</AppText>
              <View style={styles.chipRow}>
                {vendors.map((v) => {
                  const active = v.id === storeId;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => selectVendor(v.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <AppText style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {v.name} · {v.app}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.currentRow}>
                <AppText style={styles.currentLabel}>
                  Current fee · {activeVendor ? `${activeVendor.name}` : ''}
                </AppText>
                <AppText style={styles.currentValue}>{currentFeePct || '--'}%</AppText>
              </View>
              <AppText style={styles.label}>Requested fee (%)</AppText>
              <AppTextInput
                value={pct}
                onChangeText={setPct}
                keyboardType="number-pad"
                placeholder="e.g. 12"
                editable={!busy && !pending && Boolean(storeId)}
                style={styles.input}
              />
            </>
          )}

          {pending ? (
            <AppText style={styles.pendingNote}>
              A request for {pending.requestedFeePct}% is pending review.
            </AppText>
          ) : null}
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {notice ? <AppText style={styles.notice}>{notice}</AppText> : null}
          <TouchableOpacity
            style={[styles.primaryBtn, (busy || !!pending || !storeId) && styles.primaryBtnDisabled]}
            onPress={submit}
            disabled={busy || !!pending || !storeId}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <AppText style={styles.primaryBtnText}>Submit request</AppText>
            )}
          </TouchableOpacity>
        </View>

        <AppText style={styles.sectionTitle}>History</AppText>
        {loading ? (
          <ActivityIndicator color={parentRamp.base} style={styles.loader} />
        ) : history.length === 0 ? (
          <AppText style={styles.muted}>No requests yet.</AppText>
        ) : (
          history.map((item) => (
            <View key={item.requestId} style={styles.row}>
              <View style={styles.rowText}>
                <AppText style={styles.rowTitle}>
                  {item.currentFeePct}% → {item.requestedFeePct}%
                </AppText>
                <AppText style={styles.rowSubtitle}>
                  {new Date(item.requestedAt).toLocaleDateString()}
                  {item.reviewReason ? ` · ${item.reviewReason}` : ''}
                </AppText>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: STATUS_COLORS[item.status] ?? '#64748B' },
                ]}
              >
                <AppText style={styles.statusText}>{item.status}</AppText>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  headerSpacer: { width: 44 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: ms(18), fontWeight: '900', color: '#0f172a' },
  content: { padding: hs(16), paddingBottom: SPACE.LIST_BOTTOM },
  card: { backgroundColor: '#FFFFFF', borderRadius: ms(18), padding: hs(16) },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: hs(8), marginBottom: vs(6) },
  cardTitle: { fontSize: ms(15), fontWeight: '900', color: '#0f172a' },
  muted: { fontSize: ms(12), color: '#64748B', lineHeight: ms(18) },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: hs(8), marginTop: vs(6) },
  chip: {
    paddingHorizontal: hs(12),
    paddingVertical: vs(7),
    borderRadius: ms(18),
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    maxWidth: '100%',
  },
  chipActive: { backgroundColor: parentRamp.base, borderColor: parentRamp.base },
  chipText: { fontSize: ms(11.5), fontWeight: '800', color: '#334155' },
  chipTextActive: { color: '#FFFFFF' },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(14),
    paddingVertical: vs(10),
    paddingHorizontal: hs(12),
    borderRadius: ms(12),
    backgroundColor: '#EFF6FF',
  },
  currentLabel: { fontSize: ms(12), fontWeight: '700', color: '#1D4ED8' },
  currentValue: { fontSize: ms(16), fontWeight: '900', color: parentRamp.base },
  label: { fontSize: ms(12), fontWeight: '800', color: '#334155', marginTop: vs(14), marginBottom: vs(6) },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: ms(12),
    paddingHorizontal: hs(12),
    paddingVertical: vs(10),
    fontSize: ms(15),
    color: '#0f172a',
    backgroundColor: '#FFFFFF',
  },
  pendingNote: { marginTop: vs(10), fontSize: ms(12), color: '#B45309', fontWeight: '700' },
  error: { marginTop: vs(10), fontSize: ms(12), color: '#DC2626', fontWeight: '700' },
  retryBtn: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginTop: vs(8) },
  retryText: { fontSize: ms(13), fontWeight: '600', color: parentRamp.base, textDecorationLine: 'underline' },
  notice: { marginTop: vs(10), fontSize: ms(12), color: '#15803D', fontWeight: '700' },
  primaryBtn: {
    marginTop: vs(16),
    borderRadius: ms(14),
    backgroundColor: parentRamp.base,
    paddingVertical: vs(13),
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: ms(14), fontWeight: '900', color: '#FFFFFF' },
  sectionTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: '#0f172a',
    marginTop: vs(22),
    marginBottom: vs(10),
  },
  loader: { marginTop: vs(10) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(14),
    padding: hs(14),
    marginBottom: SPACE.BLOCK,
    gap: hs(10),
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: ms(14), fontWeight: '800', color: '#0f172a' },
  rowSubtitle: { fontSize: ms(11), color: '#94A3B8', marginTop: vs(3), fontWeight: '600' },
  statusPill: { paddingHorizontal: hs(8), paddingVertical: vs(3), borderRadius: ms(10) },
  statusText: { fontSize: ms(11), fontWeight: '800', color: '#FFFFFF' },
  gateTitle: { fontSize: ms(16), fontWeight: '900', color: '#0f172a', textAlign: 'center', marginTop: vs(40) },
  gateBody: {
    fontSize: ms(12),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: ms(18),
    marginTop: vs(6),
    paddingHorizontal: hs(24),
  },
});

export default SellerPlatformFeeRequestScreen;
