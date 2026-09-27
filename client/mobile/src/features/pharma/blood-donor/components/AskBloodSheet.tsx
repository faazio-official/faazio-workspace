import React, { memo, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ArrowLeft, Droplet, LoaderCircle, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_GROUPS, ASK_BLOOD_COPY } from '@data/index';
import type { BloodGroup, DonorProfile } from '@data/index';
import type { RootStackParamList } from '@/navigation/types';
import SlideUpSheet from '@/components/shared/SlideUpSheet';
import { OptionChipGrid } from './OptionChipGrid';
import { MatchingDonorCard } from './MatchingDonorCard';
import { findMatchingDonors } from '../services/donorDirectory';
import { useAuthStore } from '@/state/authStore';
import { BLOOD_RED, BLOOD_RED_DARK, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

interface AskBloodSheetProps { visible: boolean; onClose: () => void }
type AskMode = 'search' | 'results';

/** Two-stage targeted donor discovery, rendered in the shared bottom sheet. */
const AskBloodSheet = memo(function AskBloodSheet({ visible, onClose }: AskBloodSheetProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const requesterUserId = useAuthStore((s) => s.user?.id);
  const [mode, setMode] = useState<AskMode>('search');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | null>(null);
  const [city, setCity] = useState('');
  const [donors, setDonors] = useState<DonorProfile[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode('search');
    setBloodGroup(null);
    setCity('');
    setDonors([]);
    setSearching(false);
  }, [visible]);

  const canContinue = bloodGroup !== null && city.trim().length >= 3;

  const handleContinue = async () => {
    if (!canContinue || !bloodGroup) return;
    setSearching(true);
    const matches = await findMatchingDonors(city, bloodGroup, requesterUserId);
    setDonors(matches);
    setSearching(false);
    setMode('results');
  };

  const handleSelectDonor = (donor: DonorProfile) => {
    onClose();
    navigation.navigate('BloodDonorDetails', {
      donorId: donor.id,
      requestCity: city.trim(),
      bloodGroup: donor.bloodGroup,
    });
  };

  const handleClose = () => { if (!searching) onClose(); };

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

        <AppText style={styles.subtitle}>
          {mode === 'search' ? ASK_BLOOD_COPY.searchSubtitle : ASK_BLOOD_COPY.resultsSubtitle}
        </AppText>

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
          </ScrollView>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>
            <View style={styles.criteriaRow}>
              <AppText style={styles.criteriaText}>{city.trim()}</AppText>
              <AppText style={styles.criteriaDivider}>·</AppText>
              <AppText style={styles.criteriaText}>{bloodGroup}</AppText>
            </View>
            {searching ? (
              <View style={styles.loadingState}><LoaderCircle size={ms(28)} color={BLOOD_RED} strokeWidth={2.2} /><AppText style={styles.emptyTitle}>Finding matching donors…</AppText></View>
            ) : donors.length === 0 ? (
              <View style={styles.emptyState}><Droplet size={ms(32)} color={BLOOD_RED} strokeWidth={2} /><AppText style={styles.emptyTitle}>No matching donors found</AppText><AppText style={styles.emptyText}>Try another city or blood group to find available donors.</AppText></View>
            ) : (
              <View style={styles.resultsList}>{donors.map((donor) => <MatchingDonorCard key={donor.id} donor={donor} onPress={handleSelectDonor} />)}</View>
            )}
          </ScrollView>
        )}

        {mode === 'search' ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, vs(8)) }]}>
            <TouchableOpacity onPress={handleContinue} disabled={!canContinue || searching} style={[styles.continueBtn, (!canContinue || searching) && styles.disabledBtn]} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ disabled: !canContinue || searching }}>
              <AppText style={styles.continueText}>{searching ? 'Finding Donors…' : ASK_BLOOD_COPY.continueLabel}</AppText>
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
  headerAction: { width: ms(28), height: ms(28), alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: ms(18), fontWeight: '900', color: BLOOD_TEXT },
  subtitle: { width: '100%', marginTop: vs(5), color: BLOOD_TEXT_MUTED, fontSize: ms(12), lineHeight: vs(17) },
  scroll: { width: '100%' },
  searchContent: { paddingTop: vs(20), paddingBottom: vs(16), gap: vs(22) },
  resultsContent: { paddingTop: vs(16), paddingBottom: vs(16) },
  block: { gap: vs(9) },
  label: { fontSize: ms(12), fontWeight: '900', color: BLOOD_TEXT },
  req: { color: BLOOD_RED },
  field: { borderWidth: 1, borderColor: BLOOD_BORDER, borderRadius: BLOOD_RADII.chip, backgroundColor: '#ffffff' },
  input: { minHeight: ms(48), paddingHorizontal: hs(14), color: BLOOD_TEXT, fontSize: ms(13) },
  footer: { width: '100%', paddingTop: vs(8) },
  continueBtn: { minHeight: ms(48), borderRadius: BLOOD_RADII.pill, backgroundColor: BLOOD_RED, alignItems: 'center', justifyContent: 'center' },
  disabledBtn: { backgroundColor: '#CBD5E1' },
  continueText: { color: '#ffffff', fontSize: ms(14), fontWeight: '900' },
  criteriaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: hs(8), backgroundColor: '#FEF2F2', borderRadius: BLOOD_RADII.pill, paddingHorizontal: hs(12), paddingVertical: vs(7) },
  criteriaText: { color: BLOOD_RED_DARK, fontSize: ms(12), fontWeight: '800' },
  criteriaDivider: { color: BLOOD_RED, fontSize: ms(14), fontWeight: '900' },
  resultsList: { gap: vs(10), paddingTop: vs(14) },
  loadingState: { alignItems: 'center', gap: vs(8), paddingVertical: vs(36) },
  emptyState: { alignItems: 'center', gap: vs(8), paddingVertical: vs(30), paddingHorizontal: hs(20) },
  emptyTitle: { color: BLOOD_TEXT, fontSize: ms(14), fontWeight: '900', textAlign: 'center' },
  emptyText: { color: BLOOD_TEXT_MUTED, fontSize: ms(12), lineHeight: vs(17), textAlign: 'center' },
});
