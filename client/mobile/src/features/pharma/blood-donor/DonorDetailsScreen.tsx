import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { ArrowLeft, CheckCircle2, ChevronLeft, Droplet, MapPin, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { RootStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/state/authStore';
import { useBloodDonorStore, type BloodWriteStatus } from '@/state/bloodDonorStore';
import { getDonorById } from './services/donorDirectory';
import { BLOOD_RED, BLOOD_RED_SOFT, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from './tokens';
import { semantic } from '@/theme/brandTokens';

type Props = NativeStackScreenProps<RootStackParamList, 'BloodDonorDetails'>;

function donationTypeLabel(type: 'hospital' | 'blood-bank' | 'both'): string {
  if (type === 'both') return 'Hospital or blood bank';
  return type === 'hospital' ? 'At a hospital' : 'At a blood bank';
}

export function DonorDetailsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const donor = getDonorById(route.params.donorId, route.params.source);
  const userId = useAuthStore((s) => s.user?.id) ?? 'anonymous-user';
  const targetedRequests = useBloodDonorStore((s) => s.donorMatchRequests);
  const requestDonor = useBloodDonorStore((s) => s.requestDonor);
  const [sent, setSent] = useState(false);
  const [writeStatus, setWriteStatus] = useState<BloodWriteStatus | null>(null);

  if (!donor) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
            <ChevronLeft size={ms(26)} color={BLOOD_TEXT} strokeWidth={2.2} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Donor Details</AppText>
        </View>
        <View style={styles.emptyState}>
          <Droplet size={ms(32)} color={BLOOD_RED} strokeWidth={2} />
          <AppText style={styles.emptyTitle}>This donor is no longer available.</AppText>
          <AppText style={styles.emptyText}>Go back and search again for another matching donor.</AppText>
        </View>
      </View>
    );
  }

  const existingMatch = targetedRequests.find(
    (request) =>
      request.requesterUserId === userId &&
      request.donorId === donor.id &&
      request.bloodGroup === route.params.bloodGroup &&
      request.city.toLowerCase() === route.params.requestCity.trim().toLowerCase(),
  );
  const accepted = existingMatch?.status === 'accepted';
  const pending = existingMatch?.status === 'pending';
  const declined = existingMatch?.status === 'declined';
  const requestComplete = sent || pending || accepted;

  const handleRequest = async () => {
    if (requestComplete) return;
    const result = await requestDonor(donor, route.params.requestCity);
    setSent(result.ok);
    setWriteStatus(result.status);
  };

  const requestLabel = accepted
    ? 'Donor Accepted · Done'
    : requestComplete
      ? writeStatus === 'synced' || writeStatus === null
        ? 'Request Sent · Done'
        : 'Request Saved — will retry'
      : declined
        ? 'Request This Donor Again'
        : 'Request This Donor';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={ms(26)} color={BLOOD_TEXT} strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Donor Details</AppText>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Droplet size={ms(34)} color={BLOOD_RED} fill={BLOOD_RED} strokeWidth={2} /></View>
          <AppText style={styles.name}>{donor.name}</AppText>
          <View style={styles.availableRow}><ShieldCheck size={ms(14)} color={semantic.success} strokeWidth={2.3} /><AppText style={styles.availableText}>Available donor</AppText></View>
        </View>

        <View style={styles.infoCard}>
          <AppText style={styles.sectionTitle}>Donor information</AppText>
          <View style={styles.infoRow}><View style={styles.infoIcon}><Droplet size={ms(16)} color={BLOOD_RED} fill={BLOOD_RED} strokeWidth={2} /></View><View><AppText style={styles.infoLabel}>Blood group</AppText><AppText style={styles.infoValue}>{donor.bloodGroup}</AppText></View></View>
          <View style={styles.infoRow}><View style={styles.infoIcon}><MapPin size={ms(16)} color={BLOOD_RED} strokeWidth={2.2} /></View><View><AppText style={styles.infoLabel}>City</AppText><AppText style={styles.infoValue}>{donor.city}</AppText></View></View>
          <View style={styles.infoRow}><View style={styles.infoIcon}><CheckCircle2 size={ms(16)} color={BLOOD_RED} strokeWidth={2.2} /></View><View><AppText style={styles.infoLabel}>Donation preference</AppText><AppText style={styles.infoValue}>{donationTypeLabel(donor.donationType)}</AppText></View></View>
          <View style={styles.infoRow}><View style={styles.infoIcon}><ArrowLeft size={ms(16)} color={BLOOD_RED} strokeWidth={2.2} /></View><View><AppText style={styles.infoLabel}>Travel</AppText><AppText style={styles.infoValue}>{donor.willingToTravel === 'yes' ? 'Willing to travel' : 'Prefers local donation'}</AppText></View></View>
        </View>

        <View style={styles.privacyCard}>
          <ShieldCheck size={ms(18)} color={semantic.success} strokeWidth={2.2} />
          <AppText style={styles.privacyText}>Your request is sent only to this donor. Contact details stay private and are never shared in the app.</AppText>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: vs(14) }]}>
        <TouchableOpacity onPress={requestComplete ? () => navigation.goBack() : handleRequest} style={[styles.requestButton, requestComplete && styles.requestButtonComplete]} activeOpacity={0.85} accessibilityRole="button">
          {requestComplete ? <CheckCircle2 size={ms(18)} color="#ffffff" strokeWidth={2.4} /> : <Droplet size={ms(18)} color="#ffffff" fill="#ffffff" strokeWidth={2.2} />}
          <AppText style={styles.requestButtonText}>{requestLabel}</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: hs(16), paddingTop: vs(10), paddingBottom: SPACE.BLOCK, backgroundColor: '#ffffff' },
  backButton: { marginRight: hs(8), padding: hs(2) },
  headerTitle: { fontSize: ms(17), fontWeight: '800', color: BLOOD_TEXT },
  scroll: { flex: 1 },
  content: { padding: hs(20), gap: SPACE.SECTION, paddingBottom: SPACE.SECTION },
  profileCard: { alignItems: 'center', backgroundColor: '#ffffff', borderRadius: BLOOD_RADII.card, borderWidth: 1, borderColor: BLOOD_BORDER, paddingVertical: vs(24), gap: SPACE.BLOCK },
  avatar: { width: ms(72), height: ms(72), borderRadius: ms(24), alignItems: 'center', justifyContent: 'center', backgroundColor: BLOOD_RED_SOFT },
  name: { color: BLOOD_TEXT, fontSize: ms(21), fontWeight: '900' },
  availableRow: { flexDirection: 'row', alignItems: 'center', gap: hs(5) },
  availableText: { color: semantic.success, fontSize: ms(11), fontWeight: '800' },
  infoCard: { backgroundColor: '#ffffff', borderRadius: BLOOD_RADII.card, borderWidth: 1, borderColor: BLOOD_BORDER, padding: hs(16), gap: SPACE.BLOCK },
  sectionTitle: { color: BLOOD_TEXT, fontSize: ms(13), fontWeight: '900', marginBottom: vs(2) },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: hs(11) },
  infoIcon: { width: ms(34), height: ms(34), borderRadius: ms(11), alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' },
  infoLabel: { color: BLOOD_TEXT_MUTED, fontSize: ms(10), fontWeight: '600' },
  infoValue: { color: BLOOD_TEXT, fontSize: ms(13), fontWeight: '800', marginTop: vs(2) },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: hs(8), backgroundColor: '#ECFDF5', borderRadius: BLOOD_RADII.card, padding: hs(13) },
  privacyText: { flex: 1, color: '#166534', fontSize: ms(11), lineHeight: vs(16), fontWeight: '600' },
  footer: { paddingHorizontal: hs(20), paddingTop: SPACE.BLOCK, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: BLOOD_BORDER },
  requestButton: { minHeight: ms(50), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: hs(7), borderRadius: BLOOD_RADII.pill, backgroundColor: BLOOD_RED },
  requestButtonComplete: { backgroundColor: semantic.success },
  requestButtonText: { color: '#ffffff', fontSize: ms(14), fontWeight: '900' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.BLOCK, padding: hs(32) },
  emptyTitle: { color: BLOOD_TEXT, fontSize: ms(14), fontWeight: '900', textAlign: 'center' },
  emptyText: { color: BLOOD_TEXT_MUTED, fontSize: ms(12), lineHeight: vs(17), textAlign: 'center' },
});
