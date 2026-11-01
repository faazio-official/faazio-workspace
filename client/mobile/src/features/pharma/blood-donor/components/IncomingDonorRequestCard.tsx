import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Clock, Droplet, MapPin, User } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import type { DonorMatchRequest, DonorMatchStatus } from '@data/index';
import { BLOOD_RED, BLOOD_RED_SOFT, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_BORDER, BLOOD_RADII } from '../tokens';
import { semantic } from '@/theme/brandTokens';

interface IncomingDonorRequestCardProps {
  request: DonorMatchRequest;
  /** Recipient accept/decline. Omitted (or pending already resolved) → read-only status card. */
  onRespond?: (status: 'accepted' | 'declined') => void;
  /** True while the response write is in flight (buttons disabled). */
  busy?: boolean;
}

function hoursSince(iso: string): number {
  const elapsed = Date.now() - new Date(iso).getTime();
  return Number.isFinite(elapsed) && elapsed > 0 ? Math.floor(elapsed / 3600000) : 0;
}

function timeLabel(hours: number): string {
  if (hours < 1) return 'Just now';
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

const STATUS_LABEL: Record<DonorMatchStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
};

const STATUS_STYLE: Record<DonorMatchStatus, { bg: string; fg: string }> = {
  pending: { bg: '#FEF3C7', fg: '#B45309' },
  accepted: { bg: '#DCFCE7', fg: '#15803D' },
  declined: { bg: '#F1F5F9', fg: '#64748B' },
  completed: { bg: '#DBEAFE', fg: '#1D4ED8' },
};

export function IncomingDonorRequestCard({ request, onRespond, busy = false }: IncomingDonorRequestCardProps) {
  const isPending = request.status === 'pending';
  const statusStyle = STATUS_STYLE[request.status];
  const canRespond = isPending && typeof onRespond === 'function';
  // The server match row carries no requester name (no PII join); stay honest instead of blank.
  const requester = request.requesterName.trim() || 'A nearby requester';

  return (
    <View style={styles.card} accessibilityLabel={`Blood request from ${requester}`}>
      <View style={styles.topRow}>
        <View style={styles.requestChip}><User size={ms(11)} color={BLOOD_RED} strokeWidth={2.4} /><AppText style={styles.requestChipText}>Request for you</AppText></View>
        <View style={styles.timeRow}><Clock size={ms(12)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} /><AppText style={styles.timeText}>{timeLabel(hoursSince(request.requestedAt))}</AppText></View>
      </View>
      <AppText style={styles.requester}>{requester} needs your help</AppText>
      <View style={styles.metaRow}>
        <View style={styles.bloodIcon}><Droplet size={ms(14)} color={BLOOD_RED} fill={BLOOD_RED} strokeWidth={2} /></View>
        <AppText style={styles.bloodGroup}>{request.bloodGroup}</AppText>
        <MapPin size={ms(13)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
        <AppText style={styles.city}>{request.city}</AppText>
        <View style={[styles.status, { backgroundColor: statusStyle.bg }]}><AppText style={[styles.statusText, { color: statusStyle.fg }]}>{STATUS_LABEL[request.status]}</AppText></View>
      </View>

      {canRespond ? (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => onRespond?.('declined')}
            disabled={busy}
            style={[styles.actionBtn, styles.declineBtn, busy && styles.disabled]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Decline request"
            accessibilityState={{ disabled: busy }}
          >
            <AppText style={styles.declineText}>Decline</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onRespond?.('accepted')}
            disabled={busy}
            style={[styles.actionBtn, styles.acceptBtn, busy && styles.disabled]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Accept request"
            accessibilityState={{ disabled: busy }}
          >
            {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <AppText style={styles.acceptText}>Accept</AppText>}
          </TouchableOpacity>
        </View>
      ) : null}
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
  status: { borderRadius: BLOOD_RADII.pill, paddingHorizontal: hs(8), paddingVertical: vs(4) },
  statusText: { fontSize: ms(9), fontWeight: '900' },
  actions: { flexDirection: 'row', gap: hs(8), marginTop: vs(2) },
  actionBtn: { flex: 1, minHeight: ms(38), borderRadius: BLOOD_RADII.pill, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { borderWidth: 1, borderColor: BLOOD_BORDER, backgroundColor: '#ffffff' },
  declineText: { color: BLOOD_TEXT_MUTED, fontSize: ms(12), fontWeight: '800' },
  acceptBtn: { backgroundColor: semantic.success },
  acceptText: { color: '#ffffff', fontSize: ms(12), fontWeight: '900' },
  disabled: { opacity: 0.6 },
});