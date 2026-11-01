import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Droplet, MapPin, Clock, Check, ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import type { BloodRequest, BloodRequestUrgency } from '@data/index';
import { semantic } from '@/theme/brandTokens';
import {
  BLOOD_RED,
  BLOOD_RED_DARK,
  BLOOD_RED_TINT,
  BLOOD_TEXT,
  BLOOD_TEXT_MUTED,
  BLOOD_BORDER,
  BLOOD_RADII,
} from '../tokens';

interface BloodRequestCardProps {
  request: BloodRequest;
  onPress: (request: BloodRequest) => void;
}

/** Urgency → badge colors (Urgent = red, High Priority = amber, Normal = blue). */
export const URGENCY_BADGE: Record<
  BloodRequestUrgency,
  { label: string; bg: string; text: string }
> = {
  urgent: { label: 'Urgent', bg: BLOOD_RED, text: '#ffffff' },
  high: { label: 'High Priority', bg: '#FEF3C7', text: '#B45309' },
  normal: { label: 'Normal', bg: '#DBEAFE', text: '#1D4ED8' },
};

/** Relative posted label computed from the raw hours count (never pre-baked). */
export function postedLabel(hours: number): string {
  if (hours < 1) return 'Just now';
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function BloodRequestCard({ request, onPress }: BloodRequestCardProps) {
  const badge = URGENCY_BADGE[request.urgency];
  const locationLine = `${request.city}, ${request.state}`;

  return (
    <TouchableOpacity
      onPress={() => onPress(request)}
      style={styles.card}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${request.hospital}, ${request.bloodGroup} blood request`}
    >
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <AppText style={[styles.badgeText, { color: badge.text }]}>{badge.label}</AppText>
        </View>
        <View style={styles.timeRow}>
          <Clock size={ms(12)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
          <AppText style={styles.timeText}>{postedLabel(request.postedHoursAgo)}</AppText>
        </View>
      </View>

      <View style={styles.hospitalRow}>
        <AppText style={styles.hospital} numberOfLines={1}>{request.hospital}</AppText>
        <AppText style={styles.location} numberOfLines={1}>
          <MapPin size={ms(11)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />{' '}
          {locationLine}
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

      <AppText
        style={[styles.forText, request.urgency === 'urgent' && styles.forTextUrgent]}
        numberOfLines={1}
      >
        For: {request.patientContext}
      </AppText>

      <View style={styles.chipRow}>
        <View style={styles.deadlineChip}>
          <Clock size={ms(11)} color={BLOOD_RED_DARK} strokeWidth={2.2} />
          <AppText style={styles.deadlineText}>{request.neededWithin}</AppText>
        </View>
        {request.verified ? (
          <View style={styles.verifiedChip}>
            <Check size={ms(11)} color={semantic.success} strokeWidth={3} />
            <AppText style={styles.verifiedText}>Verified Hospital</AppText>
          </View>
        ) : null}
        <View style={styles.chevronWrap}>
          <ChevronRight size={ms(18)} color={BLOOD_TEXT_MUTED} strokeWidth={2.4} />
        </View>
      </View>
    </TouchableOpacity>
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
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    backgroundColor: '#ECFDF5',
    borderRadius: BLOOD_RADII.pill,
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
  },
  verifiedText: {
    fontSize: ms(10),
    color: semantic.success,
    fontWeight: '700',
  },
  chevronWrap: {
    marginLeft: 'auto',
  },
});
