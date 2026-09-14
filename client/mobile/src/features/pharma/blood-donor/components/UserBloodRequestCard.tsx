import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Droplet, MapPin, Clock, User } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import type { UserBloodRequest } from '@data/index';
import { URGENCY_BADGE, postedLabel } from './BloodRequestCard';
import {
  BLOOD_RED,
  BLOOD_RED_DARK,
  BLOOD_RED_TINT,
  BLOOD_TEXT,
  BLOOD_TEXT_MUTED,
  BLOOD_BORDER,
  BLOOD_RADII,
} from '../tokens';

interface UserBloodRequestCardProps {
  request: UserBloodRequest;
}

/** Whole hours elapsed since the request was posted (relative label is computed). */
function hoursSince(iso: string): number {
  const msElapsed = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(msElapsed) || msElapsed < 0) return 0;
  return Math.floor(msElapsed / 3600000);
}

/**
 * Feed card for a user-posted "Ask Blood" request. Mirrors `BloodRequestCard`'s
 * design system but is intentionally **non-navigating** (no chevron, no detail
 * push — the full `BloodRequest` detail page requires hospital-owned fields we
 * never collect) and shows a "Your Request" chip instead of "Verified Hospital"
 * (we never fake verification).
 */
export function UserBloodRequestCard({ request }: UserBloodRequestCardProps) {
  const badge = URGENCY_BADGE[request.urgency];
  const locationLine = request.city;
  const hours = hoursSince(request.postedAt);

  return (
    <View
      style={styles.card}
      accessibilityLabel={`Your blood request, ${request.bloodGroup} blood group`}
    >
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <AppText style={[styles.badgeText, { color: badge.text }]}>{badge.label}</AppText>
        </View>
        <View style={styles.timeRow}>
          <Clock size={ms(12)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
          <AppText style={styles.timeText}>{postedLabel(hours)}</AppText>
        </View>
      </View>

      <View style={styles.hospitalRow}>
        <AppText style={styles.hospital} numberOfLines={1}>{request.hospital}</AppText>
        <AppText style={styles.location} numberOfLines={1}>
          <MapPin size={ms(11)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} /> {locationLine}
        </AppText>
      </View>

      <View style={styles.groupRow}>
        <View style={styles.dropletChip}>
          <Droplet size={ms(14)} color={BLOOD_RED} fill={BLOOD_RED} strokeWidth={2} />
        </View>
        <AppText style={styles.groupText}>{request.bloodGroup}</AppText>
        <AppText style={styles.unitsText}>
          Required: {request.unitsRequired} Unit{request.unitsRequired > 1 ? 's' : ''}
        </AppText>
      </View>

      {request.note ? (
        <AppText
          style={[styles.forText, request.urgency === 'urgent' && styles.forTextUrgent]}
          numberOfLines={1}
        >
          For: {request.note}
        </AppText>
      ) : null}

      <View style={styles.chipRow}>
        <View style={styles.deadlineChip}>
          <Clock size={ms(11)} color={BLOOD_RED_DARK} strokeWidth={2.2} />
          <AppText style={styles.deadlineText}>{request.neededWithin}</AppText>
        </View>
        <View style={styles.yourChip}>
          <User size={ms(11)} color={BLOOD_RED_DARK} strokeWidth={2.4} />
          <AppText style={styles.yourText}>Your Request</AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.card,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    paddingHorizontal: hs(16),
    paddingVertical: vs(14),
    gap: vs(8),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(8),
  },
  badge: {
    borderRadius: BLOOD_RADII.chip,
    paddingHorizontal: hs(10),
    paddingVertical: vs(3),
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: ms(10),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  timeText: {
    fontSize: ms(10),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '600',
  },
  hospitalRow: {
    gap: vs(2),
  },
  hospital: {
    fontSize: ms(14),
    fontWeight: '900',
    color: BLOOD_TEXT,
  },
  location: {
    fontSize: ms(11),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '500',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
  },
  dropletChip: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(12),
    backgroundColor: BLOOD_RED_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupText: {
    fontSize: ms(22),
    fontWeight: '900',
    color: BLOOD_TEXT,
  },
  unitsText: {
    fontSize: ms(11),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '700',
    flex: 1,
  },
  forText: {
    fontSize: ms(11),
    color: BLOOD_TEXT,
    fontWeight: '600',
  },
  forTextUrgent: {
    color: BLOOD_RED_DARK,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    flexWrap: 'wrap',
  },
  deadlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: BLOOD_RED_TINT,
    borderRadius: BLOOD_RADII.pill,
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
  },
  deadlineText: {
    fontSize: ms(10),
    color: BLOOD_RED_DARK,
    fontWeight: '700',
  },
  yourChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: BLOOD_RED_TINT,
    borderRadius: BLOOD_RADII.pill,
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
  },
  yourText: {
    fontSize: ms(10),
    color: BLOOD_RED_DARK,
    fontWeight: '700',
  },
});
