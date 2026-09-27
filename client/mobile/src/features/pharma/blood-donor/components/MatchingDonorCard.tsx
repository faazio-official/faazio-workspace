import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Droplet, MapPin, ShieldCheck } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import type { DonorProfile } from '@data/index';
import { BLOOD_RED, BLOOD_RED_SOFT, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

interface MatchingDonorCardProps {
  donor: DonorProfile;
  onPress: (donor: DonorProfile) => void;
}

export function MatchingDonorCard({ donor, onPress }: MatchingDonorCardProps) {
  const donationType = donor.donationType === 'both'
    ? 'Hospital or blood bank'
    : donor.donationType === 'hospital' ? 'Hospital donation' : 'Blood-bank donation';

  return (
    <TouchableOpacity
      onPress={() => onPress(donor)}
      style={styles.card}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${donor.name}, ${donor.bloodGroup} donor in ${donor.city}`}
    >
      <View style={styles.avatar}>
        <Droplet size={ms(21)} color={BLOOD_RED} fill={BLOOD_RED} strokeWidth={2} />
      </View>
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <AppText style={styles.name} numberOfLines={1}>{donor.name}</AppText>
          <View style={styles.availableChip}>
            <ShieldCheck size={ms(11)} color="#059669" strokeWidth={2.3} />
            <AppText style={styles.availableText}>Available</AppText>
          </View>
        </View>
        <View style={styles.metaRow}>
          <AppText style={styles.bloodGroup}>{donor.bloodGroup}</AppText>
          <AppText style={styles.separator}>·</AppText>
          <MapPin size={ms(12)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
          <AppText style={styles.meta} numberOfLines={1}>{donor.city}</AppText>
        </View>
        <AppText style={styles.preference}>{donationType}{donor.willingToTravel === 'yes' ? ' · Willing to travel' : ''}</AppText>
      </View>
      <ChevronRight size={ms(19)} color={BLOOD_TEXT_MUTED} strokeWidth={2.3} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: hs(11), padding: hs(13), backgroundColor: '#ffffff', borderWidth: 1, borderColor: BLOOD_BORDER, borderRadius: BLOOD_RADII.card },
  avatar: { width: ms(44), height: ms(44), borderRadius: ms(14), alignItems: 'center', justifyContent: 'center', backgroundColor: BLOOD_RED_SOFT },
  copy: { flex: 1, gap: vs(4) },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: hs(6) },
  name: { flex: 1, color: BLOOD_TEXT, fontSize: ms(14), fontWeight: '900' },
  availableChip: { flexDirection: 'row', alignItems: 'center', gap: hs(3), paddingHorizontal: hs(6), paddingVertical: vs(3), borderRadius: BLOOD_RADII.pill, backgroundColor: '#ECFDF5' },
  availableText: { color: '#059669', fontSize: ms(9), fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: hs(5) },
  bloodGroup: { color: BLOOD_RED, fontSize: ms(13), fontWeight: '900' },
  separator: { color: BLOOD_BORDER, fontSize: ms(14) },
  meta: { flex: 1, color: BLOOD_TEXT_MUTED, fontSize: ms(11), fontWeight: '600' },
  preference: { color: BLOOD_TEXT_MUTED, fontSize: ms(10), fontWeight: '600' },
});
