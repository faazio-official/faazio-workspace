import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Droplet, ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import type { BloodRequest } from '@data/index';
import {
  BLOOD_RED,
  BLOOD_RED_TINT,
  BLOOD_TEXT,
  BLOOD_TEXT_MUTED,
  BLOOD_BORDER,
  BLOOD_RADII,
} from '../tokens';
import { URGENCY_BADGE } from './BloodRequestCard';

interface NearbyRequestCardProps {
  request: BloodRequest;
  onPress: (request: BloodRequest) => void;
}

/** Compact request card for the detail page's "Other Requests Nearby" list. */
export function NearbyRequestCard({ request, onPress }: NearbyRequestCardProps) {
  const badge = URGENCY_BADGE[request.urgency];

  return (
    <TouchableOpacity
      onPress={() => onPress(request)}
      style={styles.card}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${request.hospital}, ${request.bloodGroup} blood request`}
    >
      <View style={styles.dropletChip}>
        <Droplet size={ms(15)} color={BLOOD_RED} fill={BLOOD_RED} strokeWidth={2} />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <AppText style={styles.hospital} numberOfLines={1}>{request.hospital}</AppText>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <AppText style={[styles.badgeText, { color: badge.text }]}>{badge.label}</AppText>
          </View>
        </View>
        <AppText style={styles.meta}>
          {/* Live server rows carry no geo, so a 0 is "unknown", never "0 km away". */}
          {request.distanceKm > 0 ? `${request.distanceKm} km away · ` : ''}
          {request.unitsRequired} Unit{request.unitsRequired > 1 ? 's' : ''} Required
        </AppText>
      </View>

      <ChevronRight size={ms(18)} color={BLOOD_TEXT_MUTED} strokeWidth={2.4} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.card,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    paddingHorizontal: hs(14),
    paddingVertical: vs(12),
  },
  dropletChip: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(12),
    backgroundColor: BLOOD_RED_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: vs(2),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  hospital: {
    fontSize: ms(13),
    fontWeight: '800',
    color: BLOOD_TEXT,
    flexShrink: 1,
  },
  badge: {
    borderRadius: BLOOD_RADII.chip,
    paddingHorizontal: hs(8),
    paddingVertical: vs(2),
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: ms(9),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  meta: {
    fontSize: ms(10.5),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '600',
  },
});
