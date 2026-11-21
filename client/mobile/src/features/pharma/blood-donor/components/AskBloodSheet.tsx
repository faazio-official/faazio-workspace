import React, { memo, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowLeft, CheckCircle2, CloudOff, Droplet, LoaderCircle, UploadCloud, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { BLOOD_GROUPS, ASK_BLOOD_COPY } from '@data/index';
import type { BloodGroup, DonorProfile } from '@data/index';
import type { RootStackParamList } from '@/navigation/types';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { OptionChipGrid } from './OptionChipGrid';
import { MatchingDonorCard } from './MatchingDonorCard';
import { findMatchingDonors } from '../services/donorDirectory';
import type { ReadSource } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useBloodDonorStore, type BloodWriteStatus } from '@/state/bloodDonorStore';
import { BLOOD_RED, BLOOD_RED_DARK, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';
import { semantic } from '@/theme/brandTokens';

interface AskBloodSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a successful public-board post so the dashboard can reload the feed. */
  onPosted?: () => void;
}
type AskMode = 'search' | 'results' | 'posted';

const POSTED_COPY: Record<BloodWriteStatus, { title: string; body: string }> = {
  synced: { title: 'Posted to the board', body: 'Your request is live for donors to see.' },
  queued: { title: 'Saved — will post shortly', body: "We'll post it automatically when you're back online." },
  offline: { title: "Couldn't post to the board", body: 'Check your connection and try again.' },
  'signed-out': { title: 'Sign in to post', body: 'Sign in to publish a request to the public board.' },
  rejected: { title: "Couldn't post to the board", body: 'Check the city and try again, or post again tomorrow — the daily limit is reached.' },
};

/**
 * Mirrors the server's check so the button disables before a round-trip: a 10-digit Indian mobile,
 * optionally prefixed with +91/0 and spaces. The server canonicalises whatever passes.
 */
function isValidIndianMobile(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return local.length === 10 && local[0] >= '6' && local[0] <= '9';
}

/** Two-stage targeted donor discovery, plus a public-board post, in the shared bottom sheet. */
const AskBloodSheet = memo(function AskBloodSheet({ visible, onClose, onPosted }: AskBloodSheetProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const requesterUserId = useAuthStore((s) => s.user?.id);
  const postBloodRequest = useBloodDonorStore((s) => s.postBloodRequest);
  const [mode, setMode] = useState<AskMode>('search');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [city, setCity] = useState('');
  const [patientName, setPatientName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contact, setContact] = useState('');
  const [donors, setDonors] = useState<DonorProfile[]>([]);
  const [source, setSource] = useState<ReadSource>('live');
  const [searching, setSearching] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<BloodWriteStatus | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode('search');
    setBloodGroup(null);
    setCity('');
    setPatientName('');
    setContactPerson('');
    setContact('');
    setDonors([]);
    setSource('live');
    setSearching(false);
    setPosting(false);
    setPostStatus(null);
  }, [visible]);

  /** Donor discovery only needs city + group; a public post needs the actionable identity too. */
  const canContinue = bloodGroup !== null && city.trim().length >= 3;
  const canPost = canContinue && patientName.trim().length >= 2
    && contactPerson.trim().length >= 2 && isValidIndianMobile(contact);

  const handleContinue = async () => {
    if (!canContinue || !bloodGroup) return;
    setSearching(true);
    const { donors: matches, source: matchSource } = await findMatchingDonors(city, bloodGroup, requesterUserId);
    setDonors(matches);
    setSource(matchSource);
    setSearching(false);
    setMode('results');
  };

  const handleSelectDonor = (donor: DonorProfile) => {
    onClose();
    navigation.navigate('BloodDonorDetails', {
      donorId: donor.id,
      requestCity: city.trim(),
      bloodGroup: donor.bloodGroup,
      source,
    });
  };

  const handlePost = async () => {
    if (!canPost || !bloodGroup || posting) return;
    setPosting(true);
    const result = await postBloodRequest({
      city: city.trim(),
      bloodGroup,
      patientName: patientName.trim(),
      contactPerson: contactPerson.trim(),
      contact: contact.trim(),
    });
    setPosting(false);
    setPostStatus(result.status);
    setMode('posted');
    if (result.ok) onPosted?.();
  };

  const handleClose = () => { if (!searching && !posting) onClose(); };

  const offlineSource = source === 'offline-fallback' || source === 'cache-stale';
  const emptyAuthoritative = source === 'empty-authoritative';

  return (
    <SlideUpSheet visible={visible} onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <View style={styles.header}>
          {mode === 'results' ? (
            <TouchableOpacity onPress={() => setMode('search')} style={styles.headerAction} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Edit donor search">
              <ArrowLeft size={ms(20)} color={BLOOD_TEXT} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : <View style={styles.headerAction} />}
          <AppText style={styles.title}>{ASK_BLOOD_COPY.sheetTitle}</AppText>
          <TouchableOpacity onPress={handleClose} style={styles.headerAction} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Close">
            <X size={ms(20)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {mode !== 'posted' ? (
          <AppText style={styles.subtitle}>
            {mode === 'search' ? ASK_BLOOD_COPY.searchSubtitle : ASK_BLOOD_COPY.resultsSubtitle}
          </AppText>
        ) : null}

        {mode === 'search' ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.searchContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.block}>
              <AppText style={styles.label}>City <AppText style={styles.req}>*</AppText></AppText>
              <View style={styles.field}>
                <AppTextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Chennai" placeholderTextColor={BLOOD_TEXT_MUTED} autoCapitalize="words" returnKeyType="done" />
              </View>
            </View>
            <View style={styles.block}>
              <AppText style={styles.label}>Blood Group <AppText style={styles.req}>*</AppText></AppText>
              <OptionChipGrid<BloodGroup> options={BLOOD_GROUPS} selected={bloodGroup} onSelect={setBloodGroup} />
            </View>
            <View style={styles.block}>
              <AppText style={styles.label}>Patient Name <AppText style={styles.req}>*</AppText></AppText>
              <View style={styles.field}>
                <AppTextInput style={styles.input} value={patientName} onChangeText={setPatientName} placeholder="Who needs the blood" placeholderTextColor={BLOOD_TEXT_MUTED} autoCapitalize="words" returnKeyType="next" maxLength={80} />
              </View>
            </View>
            <View style={styles.block}>
              <AppText style={styles.label}>Contact Person <AppText style={styles.req}>*</AppText></AppText>
              <View style={styles.field}>
                <AppTextInput style={styles.input} value={contactPerson} onChangeText={setContactPerson} placeholder="Who donors should ask for" placeholderTextColor={BLOOD_TEXT_MUTED} autoCapitalize="words" returnKeyType="next" maxLength={80} />
              </View>
            </View>
            <View style={styles.block}>
              <AppText style={styles.label}>Contact Number <AppText style={styles.req}>*</AppText></AppText>
              <View style={styles.field}>
                <AppTextInput style={styles.input} value={contact} onChangeText={setContact} placeholder="10-digit mobile number" placeholderTextColor={BLOOD_TEXT_MUTED} keyboardType="phone-pad" returnKeyType="done" maxLength={16} />
              </View>
              <AppText style={styles.helper}>Only shown to signed-in donors. Never posted publicly.</AppText>
            </View>
          </ScrollView>
        ) : mode === 'results' ? (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>
            <View style={styles.criteriaRow}>
              <AppText style={styles.criteriaText}>{city.trim()}</AppText>
              <AppText style={styles.criteriaDivider}>·</AppText>
              <AppText style={styles.criteriaText}>{bloodGroup}</AppText>
            </View>
            {offlineSource && !searching ? (
              <View style={styles.offlineChip}>
                <CloudOff size={ms(13)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
                <AppText style={styles.offlineChipText}>Showing saved donors — offline</AppText>
              </View>
            ) : null}
            {searching ? (
              <View style={styles.loadingState}><LoaderCircle size={ms(28)} color={BLOOD_RED} strokeWidth={2.2} /><AppText style={styles.emptyTitle}>Finding matching donors…</AppText></View>
            ) : donors.length === 0 ? (
              <View style={styles.emptyState}><Droplet size={ms(32)} color={BLOOD_RED} strokeWidth={2} /><AppText style={styles.emptyTitle}>{emptyAuthoritative ? 'No consented donors right now' : 'No matching donors found'}</AppText><AppText style={styles.emptyText}>{emptyAuthoritative ? 'No one matching this blood group has shared consent in this city. Post a public request to the board below.' : 'Try another city or blood group — or post a public request to the board below.'}</AppText></View>
            ) : (
              <View style={styles.resultsList}>{donors.map((donor) => <MatchingDonorCard key={donor.id} donor={donor} onPress={handleSelectDonor} />)}</View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.postedState}>
            <View style={[styles.postedIcon, postStatus === 'synced' && styles.postedIconOk]}>
              {postStatus === 'synced'
                ? <CheckCircle2 size={ms(30)} color={semantic.success} strokeWidth={2.4} />
                : <UploadCloud size={ms(30)} color={BLOOD_RED} strokeWidth={2.2} />}
            </View>
            <AppText style={styles.postedTitle}>{POSTED_COPY[postStatus ?? 'offline'].title}</AppText>
            <AppText style={styles.postedBody}>{POSTED_COPY[postStatus ?? 'offline'].body}</AppText>
          </View>
        )}

        {mode === 'search' ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, vs(8)) }]}>
            <TouchableOpacity onPress={handleContinue} disabled={!canContinue || searching} style={[styles.continueBtn, (!canContinue || searching) && styles.disabledBtn]} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ disabled: !canContinue || searching }}>
              <AppText style={styles.continueText}>{searching ? 'Finding Donors…' : ASK_BLOOD_COPY.continueLabel}</AppText>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePost} disabled={!canPost || posting} style={[styles.postBtn, (!canPost || posting) && styles.disabledBtn]} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ disabled: !canPost || posting }}>
              <UploadCloud size={ms(15)} color={canPost && !posting ? BLOOD_RED_DARK : '#94A3B8'} strokeWidth={2.2} />
              <AppText style={[styles.postText, (!canPost || posting) && styles.postTextDisabled]}>{posting ? 'Posting…' : 'Post to the public board'}</AppText>
            </TouchableOpacity>
          </View>
        ) : null}

        {mode === 'results' ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, vs(8)) }]}>
            <TouchableOpacity onPress={handlePost} disabled={!canPost || posting} style={[styles.postBtn, (!canPost || posting) && styles.disabledBtn]} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ disabled: !canPost || posting }}>
              <UploadCloud size={ms(15)} color={canPost && !posting ? BLOOD_RED_DARK : '#94A3B8'} strokeWidth={2.2} />
              <AppText style={[styles.postText, (!canPost || posting) && styles.postTextDisabled]}>{posting ? 'Posting…' : 'Post to the public board instead'}</AppText>
            </TouchableOpacity>
          </View>
        ) : null}

        {mode === 'posted' ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, vs(8)) }]}>
            <TouchableOpacity onPress={handleClose} style={styles.continueBtn} activeOpacity={0.85} accessibilityRole="button">
              <AppText style={styles.continueText}>Done</AppText>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SlideUpSheet>
  );
});

export default AskBloodSheet;

const styles = StyleSheet.create({
  kav: { width: '100%', maxHeight: '86%' },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: ms(18), fontWeight: '900', color: BLOOD_TEXT },
  subtitle: { width: '100%', marginTop: vs(5), color: BLOOD_TEXT_MUTED, fontSize: ms(12), lineHeight: vs(17) },
  scroll: { width: '100%' },
  searchContent: { paddingTop: SPACE.BLOCK, paddingBottom: SPACE.BLOCK, gap: SPACE.SECTION },
  resultsContent: { paddingTop: SPACE.BLOCK, paddingBottom: SPACE.BLOCK },
  block: { gap: SPACE.BLOCK },
  label: { fontSize: ms(12), fontWeight: '900', color: BLOOD_TEXT },
  req: { color: BLOOD_RED },
  field: { borderWidth: 1, borderColor: BLOOD_BORDER, borderRadius: BLOOD_RADII.chip, backgroundColor: '#ffffff' },
  input: { minHeight: ms(48), paddingHorizontal: hs(14), color: BLOOD_TEXT, fontSize: ms(13) },
  helper: { color: BLOOD_TEXT_MUTED, fontSize: ms(11), lineHeight: vs(15) },
  footer: { width: '100%', paddingTop: SPACE.BLOCK, gap: SPACE.BLOCK },
  continueBtn: { minHeight: ms(48), borderRadius: BLOOD_RADII.pill, backgroundColor: BLOOD_RED, alignItems: 'center', justifyContent: 'center' },
  disabledBtn: { backgroundColor: '#CBD5E1' },
  continueText: { color: '#ffffff', fontSize: ms(14), fontWeight: '900' },
  postBtn: { minHeight: ms(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: hs(7), borderRadius: BLOOD_RADII.pill, borderWidth: 1, borderColor: BLOOD_BORDER, backgroundColor: '#ffffff' },
  postText: { color: BLOOD_RED_DARK, fontSize: ms(12.5), fontWeight: '800' },
  postTextDisabled: { color: '#94A3B8' },
  criteriaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: hs(8), backgroundColor: '#FEF2F2', borderRadius: BLOOD_RADII.pill, paddingHorizontal: hs(12), paddingVertical: vs(7) },
  criteriaText: { color: BLOOD_RED_DARK, fontSize: ms(12), fontWeight: '800' },
  criteriaDivider: { color: BLOOD_RED, fontSize: ms(14), fontWeight: '900' },
  offlineChip: { flexDirection: 'row', alignItems: 'center', gap: hs(6), alignSelf: 'flex-start', marginTop: SPACE.BLOCK, backgroundColor: '#F1F5F9', borderRadius: BLOOD_RADII.pill, paddingHorizontal: hs(10), paddingVertical: vs(5) },
  offlineChipText: { fontSize: ms(10.5), fontWeight: '700', color: BLOOD_TEXT_MUTED },
  resultsList: { gap: SPACE.ITEM, paddingTop: SPACE.BLOCK },
  loadingState: { alignItems: 'center', gap: SPACE.BLOCK, paddingVertical: vs(36) },
  emptyState: { alignItems: 'center', gap: SPACE.BLOCK, paddingVertical: vs(30), paddingHorizontal: hs(20) },
  emptyTitle: { color: BLOOD_TEXT, fontSize: ms(14), fontWeight: '900', textAlign: 'center' },
  emptyText: { color: BLOOD_TEXT_MUTED, fontSize: ms(12), lineHeight: vs(17), textAlign: 'center' },
  postedState: { width: '100%', alignItems: 'center', gap: SPACE.BLOCK, paddingVertical: vs(28), paddingHorizontal: hs(12) },
  postedIcon: { width: ms(64), height: ms(64), borderRadius: ms(32), alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' },
  postedIconOk: { backgroundColor: '#ECFDF5' },
  postedTitle: { color: BLOOD_TEXT, fontSize: ms(16), fontWeight: '900', textAlign: 'center' },
  postedBody: { color: BLOOD_TEXT_MUTED, fontSize: ms(12), lineHeight: vs(17), textAlign: 'center' },
});