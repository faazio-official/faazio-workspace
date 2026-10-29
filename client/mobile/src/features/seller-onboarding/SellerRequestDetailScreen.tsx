import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, Ban, ChevronLeft, FileCheck2, Eye, Store } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import InfoButton from '@/components/shared/InfoButton';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { gateway, type SellerDetail, type SellerKycDocument } from '@/services/api/GatewayClient';
import { isPartnerAdmin, useAuthStore } from '@/state/authStore';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SellerRequestDetail'>;

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: '#B45309',
  ACTIVE: '#15803D',
  SUSPENDED: '#DC2626',
  REJECTED: '#7C3AED',
};

function statusLabel(s: string): string {
  return s.replace('_', ' ');
}

/**
 * Full seller application review: registration fields, masked bank account, KYC documents (private
 * R2, viewed via a short-lived presigned GET), platform-fee editor, per-document verification,
 * reject-with-reason, and "Verify KYC" which creates the Razorpay tied account and activates the
 * seller. Client-side admin gate; the server re-verifies role + district scope on every call.
 */
export function SellerRequestDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { sellerId } = route.params;

  const [detail, setDetail] = useState<SellerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [fee, setFee] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await gateway.getSellerDetail(sellerId);
      setDetail(d);
      setFee(String(d.platformFeePct));
    } catch {
      setError('Could not load this application.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, failMsg: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch {
      setError(failMsg);
    } finally {
      setBusy(false);
    }
  };

  const saveFee = () => {
    const pct = Number(fee);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100 || !detail) return;
    run(
      () => gateway.updateSellerPlatformFee(sellerId, pct),
      'Could not update the platform fee.',
    );
  };

  const verifyDoc = (doc: SellerKycDocument) => {
    run(
      () => gateway.verifySellerDoc(sellerId, doc.docType),
      'Could not verify the document.',
    );
  };

  const verifyKyc = () => {
    run(
      () => gateway.verifySellerKyc(sellerId),
      'Could not activate the seller (Razorpay unavailable).',
    );
  };

  const doReject = () => {
    if (rejectReason.trim().length < 4) return;
    setShowReject(false);
    setBusy(true);
    setError(null);
    gateway
      .rejectSeller(sellerId, rejectReason.trim())
      .then(() => load())
      .catch(() => setError('Could not reject the application.'))
      .finally(() => setBusy(false));
  };

  const openDoc = async (doc: SellerKycDocument) => {
    if (!doc.assetId) {
      setPreview({ src: '', title: doc.docType });
      return;
    }
    try {
      const { url } = await gateway.getPrivateMediaUrl(doc.assetId);
      setPreview({ src: url, title: doc.docType });
    } catch {
      setError('Could not open the KYC document.');
    }
  };

  if (!isPartnerAdmin(user)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <AppText style={styles.gateTitle}>Admins only</AppText>
        <AppText style={styles.gateBody}>
          Seller review is available to district and super admins. Sign in with an admin account.
        </AppText>
      </View>
    );
  }

  if (loading || !detail) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color="#1162D3" />
      </View>
    );
  }

  const d = detail;

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
        <AppText style={styles.headerTitle}>Review application</AppText>
        <InfoButton contentKey="SellerRequestDetail" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Store size={ms(20)} color="#1162D3" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.heroTitle}>{d.businessName}</AppText>
              <AppText style={styles.heroSub}>
                {d.category} · {d.districtCode || d.stateCode}
              </AppText>
            </View>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[d.status] ?? '#94A3B8' }]}>
              <AppText style={styles.statusText}>{statusLabel(d.status)}</AppText>
            </View>
          </View>
        </View>

        {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

        <View style={styles.sectionCard}>
          <AppText style={styles.sectionTitle}>Business details</AppText>
          <InfoRow label="Owner" value={d.ownerName} />
          <InfoRow label="GSTIN" value={d.gstin} uppercase />
          <InfoRow label="PAN" value={d.pan} uppercase />
          <InfoRow label="Address" value={d.businessAddress || '—'} />
          <InfoRow label="Phone" value={d.contactPhone || '—'} />
          <InfoRow label="Email" value={d.contactEmail || '—'} />
          {d.fssaiNumber ? <InfoRow label="FSSAI no." value={d.fssaiNumber} /> : null}
        </View>

        <View style={styles.sectionCard}>
          <AppText style={styles.sectionTitle}>Payout account</AppText>
          {d.bankAccount ? (
            <>
              <InfoRow label="Bank" value={d.bankAccount.bankName} />
              <InfoRow label="Account" value={d.bankAccount.accountNumberMasked} />
              <InfoRow label="IFSC" value={d.bankAccount.ifsc} uppercase />
              <InfoRow label="Beneficiary" value={d.bankAccount.beneficiaryName} />
            </>
          ) : (
            <AppText style={styles.mutedText}>No bank account on file.</AppText>
          )}
          {d.razorpayLinkedAccountId ? (
            <AppText style={styles.razorpayNote}>Razorpay tied account: {d.razorpayLinkedAccountId}</AppText>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <AppText style={styles.sectionTitle}>Platform fee</AppText>
          <AppText style={styles.sectionNote}>
            The platform retains this share of every order; the rest settles to the seller after the
            hold window.
          </AppText>
          <View style={styles.feeRow}>
            <AppTextInput
              style={[styles.input, styles.feeInput]}
              value={fee}
              onChangeText={setFee}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="%"
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={saveFee} disabled={busy} activeOpacity={0.85}>
              <AppText style={styles.primaryBtnText}>Save</AppText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <AppText style={styles.sectionTitle}>KYC documents</AppText>
          {d.kycDocuments.length === 0 ? (
            <AppText style={styles.mutedText}>No documents uploaded.</AppText>
          ) : (
            d.kycDocuments.map((doc) => {
              const verified = doc.verified;
              return (
                <View key={doc.kycId} style={styles.docRow}>
                  <View style={[styles.docIcon, verified && styles.docIconDone]}>
                    {verified ? (
                      <BadgeCheck size={ms(18)} color="#16A34A" strokeWidth={2.2} />
                    ) : (
                      <FileCheck2 size={ms(18)} color="#1162D3" strokeWidth={2.2} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.docLabel}>{doc.docType}</AppText>
                    <AppText style={styles.docStatus}>
                      {verified ? 'Verified' : 'Pending verification'}
                    </AppText>
                  </View>
                  <TouchableOpacity style={styles.docButton} onPress={() => openDoc(doc)} activeOpacity={0.8}>
                    <Eye size={ms(14)} color="#1162D3" strokeWidth={2.2} />
                    <AppText style={styles.docButtonText}>View</AppText>
                  </TouchableOpacity>
                  {!verified ? (
                    <TouchableOpacity
                      style={[styles.docButton, styles.docButtonPrimary]}
                      onPress={() => verifyDoc(doc)}
                      disabled={busy}
                      activeOpacity={0.8}
                    >
                      <BadgeCheck size={ms(14)} color="#FFFFFF" strokeWidth={2.4} />
                      <AppText style={styles.docButtonTextPrimary}>Verify</AppText>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {d.status !== 'ACTIVE' ? (
          <>
            <TouchableOpacity
              style={[styles.activateBtn, busy && styles.btnDisabled]}
              onPress={verifyKyc}
              disabled={busy}
              activeOpacity={0.9}
            >
              <BadgeCheck size={ms(18)} color="#FFFFFF" strokeWidth={2.2} />
              <AppText style={styles.activateText}>Verify KYC & activate</AppText>
            </TouchableOpacity>

            {d.status !== 'REJECTED' ? (
              <TouchableOpacity
                style={[styles.rejectBtn, busy && styles.btnDisabled]}
                onPress={() => setShowReject(true)}
                disabled={busy}
                activeOpacity={0.9}
              >
                <Ban size={ms(18)} color="#DC2626" strokeWidth={2.2} />
                <AppText style={styles.rejectText}>Reject application</AppText>
              </TouchableOpacity>
            ) : (
              <AppText style={styles.mutedText}>
                Rejected: {d.rejectionReason || 'No reason recorded'}.
              </AppText>
            )}
          </>
        ) : (
          <AppText style={styles.mutedText}>
            This seller is live. The application history is preserved in the portal.
          </AppText>
        )}
      </ScrollView>

      <Modal
        visible={showReject}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReject(false)}
      >
        <View style={styles.rejectOverlay}>
          <View style={styles.rejectCard}>
            <AppText style={styles.rejectTitle}>Reject application</AppText>
            <AppText style={styles.sectionNote}>
              The reason is appended to the rejection history and shown to the seller.
            </AppText>
            <AppTextInput
              style={[styles.input, styles.rejectInput]}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Reason (min 4 characters)"
              placeholderTextColor="#94A3B8"
              multiline
            />
            <TouchableOpacity
              style={[styles.rejectSubmit, rejectReason.trim().length < 4 && styles.btnDisabled]}
              onPress={doReject}
              disabled={rejectReason.trim().length < 4}
              activeOpacity={0.85}
            >
              <AppText style={styles.activateText}>Confirm rejection</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowReject(false)} activeOpacity={0.8}>
              <AppText style={styles.cancelText}>Cancel</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={preview !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPreview(null)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewHeader}>
            <AppText style={styles.previewTitle}>{preview?.title}</AppText>
            <TouchableOpacity onPress={() => setPreview(null)} activeOpacity={0.8}>
              <AppText style={styles.cancelText}>Close</AppText>
            </TouchableOpacity>
          </View>
          {preview?.src ? (
            <Image source={{ uri: preview.src }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.previewEmpty}>
              <AppText style={styles.previewEmptyText}>No linked image asset.</AppText>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ label, value, uppercase = false }: { label: string; value: string; uppercase?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <AppText style={styles.infoLabel}>{label}</AppText>
      <AppText style={[styles.infoValue, uppercase && styles.infoValueUpper]} numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F9' },
  center: { alignItems: 'center', justifyContent: 'center' },
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
  scroll: { flex: 1 },
  scrollContent: { paddingTop: SPACE.SECTION, paddingHorizontal: hs(16), paddingBottom: SPACE.LIST_BOTTOM },
  hero: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(18),
    padding: hs(16),
    marginBottom: SPACE.SECTION,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: hs(10) },
  heroIcon: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(12),
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: ms(16), fontWeight: '900', color: '#0f172a' },
  heroSub: { fontSize: ms(11), color: '#94A3B8', marginTop: vs(3), fontWeight: '700' },
  statusPill: { paddingHorizontal: hs(8), paddingVertical: vs(3), borderRadius: ms(10) },
  statusText: { fontSize: ms(9.5), fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(18),
    padding: hs(16),
    marginBottom: SPACE.SECTION,
  },
  sectionTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionNote: { fontSize: ms(11), color: '#94A3B8', marginTop: vs(2), marginBottom: SPACE.BLOCK },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
    paddingVertical: vs(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF1F5',
  },
  infoLabel: { fontSize: ms(11.5), fontWeight: '700', color: '#94A3B8' },
  infoValue: { flex: 1, fontSize: ms(13), fontWeight: '700', color: '#0f172a', textAlign: 'right' },
  infoValueUpper: { textTransform: 'uppercase' },
  mutedText: { fontSize: ms(12), color: '#64748B', fontWeight: '600', marginTop: vs(6) },
  razorpayNote: { fontSize: ms(11), color: '#B45309', fontWeight: '700', marginTop: vs(8) },
  feeRow: { flexDirection: 'row', gap: hs(8), alignItems: 'center' },
  input: {
    height: Math.max(46, vs(46)),
    backgroundColor: '#F8FAFC',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    fontWeight: '600',
    color: '#0f172a',
  },
  feeInput: { flex: 1 },
  primaryBtn: {
    height: Math.max(46, vs(46)),
    paddingHorizontal: hs(20),
    borderRadius: ms(12),
    backgroundColor: '#1162D3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: ms(12), fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingVertical: vs(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEF1F5',
  },
  docIcon: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(11),
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconDone: { backgroundColor: '#DCFCE7' },
  docLabel: { fontSize: ms(13), fontWeight: '800', color: '#0f172a' },
  docStatus: { fontSize: ms(10.5), color: '#94A3B8', marginTop: vs(2) },
  docButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    paddingHorizontal: hs(10),
    paddingVertical: vs(8),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  docButtonPrimary: { backgroundColor: '#1162D3', borderColor: '#1162D3' },
  docButtonText: { fontSize: ms(11), fontWeight: '800', color: '#1162D3' },
  docButtonTextPrimary: { fontSize: ms(11), fontWeight: '800', color: '#FFFFFF' },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    height: Math.max(50, vs(50)),
    borderRadius: ms(14),
    backgroundColor: '#15803D',
    marginBottom: SPACE.BLOCK,
  },
  activateText: { fontSize: ms(13), fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    height: Math.max(50, vs(50)),
    borderRadius: ms(14),
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: SPACE.SECTION,
  },
  rejectText: { fontSize: ms(13), fontWeight: '800', color: '#DC2626', textTransform: 'uppercase' },
  btnDisabled: { opacity: 0.55 },
  errorText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: vs(10),
  },
  rejectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(24),
  },
  rejectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(20),
    padding: hs(20),
    alignSelf: 'stretch',
  },
  rejectTitle: { fontSize: ms(16), fontWeight: '900', color: '#0f172a', marginBottom: vs(4) },
  rejectInput: { minHeight: vs(88), textAlignVertical: 'top', marginBottom: SPACE.BLOCK },
  rejectSubmit: {
    height: Math.max(48, vs(48)),
    borderRadius: ms(12),
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { paddingVertical: vs(12), alignItems: 'center' },
  cancelText: { fontSize: ms(12), fontWeight: '800', color: '#1162D3' },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingTop: 60,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(20),
    paddingBottom: vs(12),
  },
  previewTitle: { fontSize: ms(16), fontWeight: '900', color: '#FFFFFF' },
  previewImage: { flex: 1, width: '100%' },
  previewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewEmptyText: { fontSize: ms(13), color: '#E2E8F0', fontWeight: '600' },
  gateTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: vs(48),
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

export default SellerRequestDetailScreen;