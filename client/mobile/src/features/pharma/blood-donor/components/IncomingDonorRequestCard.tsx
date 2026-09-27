import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Clock, Droplet, MapPin, User } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import type { DonorMatchRequest } from '@data/index';
import { BLOOD_RED, BLOOD_RED_SOFT, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';

interface IncomingDonorRequestCardProps { request: DonorMatchRequest }

function hoursSince(iso: string): number {
  const elapsed = Date.now() - new Date(iso).getTime();
  return Number.isFinite(elapsed) && elapsed > 0 ? Math.floor(elapsed / 3600000) : 0;
}

function timeLabel(hours: number): string {
  if (hours < 1) return 'Just now';
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

export function IncomingDonorRequestCard({ request }: IncomingDonorRequestCardProps) {
  return (
    <View style={styles.card} accessibilityLabel={`Blood request from ${request.requesterName}`}>
      <View style={styles.topRow}>
        <View style={styles.requestChip}><User size={ms(11)} color={BLOOD_RED} strokeWidth={2.4} /><AppText style={styles.requestChipText}>Request for you</AppText></View>
        <View style={styles.timeRow}><Clock size={ms(12)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} /><AppText style={styles.timeText}>{timeLabel(hoursSince(request.requestedAt))}</AppText></View>
      </View>
      <AppText style={styles.requester}>{request.requesterName} needs your help</AppText>
      <View style={styles.metaRow}>
        <View style={styles.bloodIcon}><Droplet size={ms(14)} color={BLOOD_RED} fill={BLOOD_RED} strokeWidth={2} /></View>
        <AppText style={styles.bloodGroup}>{request.bloodGroup}</AppText>
        <MapPin size={ms(13)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
        <AppText style={styles.city}>{request.city}</AppText>
        <View style={styles.status}><AppText style={styles.statusText}>Pending</AppText></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', borderRadius: BLOOD_RADII.card, borderWidth: 1, borderColor: BLOOD_BORDER, paddingHorizontal: hs(15), paddingVertical: vs(13), gap: vs(9) },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: hs(8) },
  requestChip: { flexDirection: 'row', alignItems: 'center', gap: hs(4), backgroundColor: BLOOD_RED_SOFT, borderRadius: BLOOD_RADII.pill, paddingHorizontal: hs(8), paddingVertical: vs(4) },
  requestChipText: { color: BLOOD_RED, fontSize: ms(10), fontWeight: '900' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: hs(4) },
  timeText: { color: BLOOD_TEXT_MUTED, fontSize: ms(10), fontWeight: '600' },
  requester: { color: BLOOD_TEXT, fontSize: ms(14), fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: hs(7) },
  bloodIcon: { width: ms(30), height: ms(30), borderRadius: ms(10), alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' },
  bloodGroup: { color: BLOOD_RED, fontSize: ms(15), fontWeight: '900', marginRight: hs(2) },
  city: { color: BLOOD_TEXT_MUTED, fontSize: ms(11), fontWeight: '700', flex: 1 },
  status: { borderRadius: BLOOD_RADII.pill, backgroundColor: '#FEF3C7', paddingHorizontal: hs(8), paddingVertical: vs(4) },
  statusText: { color: '#B45309', fontSize: ms(9), fontWeight: '900' },
});
