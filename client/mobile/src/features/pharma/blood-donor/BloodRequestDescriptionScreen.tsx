import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Share,
  Linking,
  Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import {
  ChevronLeft,
  Share2,
  UserRound,
  HeartHandshake,
  Bookmark,
  BookmarkCheck,
  CircleCheck,
  Calendar,
  Phone,
  Info,
  Droplet,
  Beaker,
  Clock,
  MapPin,
  ShieldCheck,
  CloudOff,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { BLOOD_REQUEST_DETAIL_COPY } from '@data/index';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import type { RootStackParamList } from '@/navigation/types';
import { BloodRequestInfoGrid } from './components/BloodRequestInfoGrid';
import { NearbyRequestCard } from './components/NearbyRequestCard';
import { postedLabel } from './components/BloodRequestCard';
import { useBloodRequests } from './hooks/useBloodRequests';
import {
  BLOOD_RED,
  BLOOD_RED_DARK,
  BLOOD_RED_SOFT,
  BLOOD_RED_TINT,
  BLOOD_TEXT,
  BLOOD_TEXT_MUTED,
  BLOOD_BORDER,
  BLOOD_BG,
  BLOOD_RADII,
} from './tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'BloodRequestDescription'>;

/** Strips the "Needed within " prefix for the compact tile value ("Flexible date" passes through). */
function neededWithinValue(neededWithin: string): string {
  return neededWithin.replace(/^Needed within /i, '');
}

export function BloodRequestDescriptionScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { requests, source } = useBloodRequests();
  const request = requests.find((r) => r.id === route.params.requestId) ?? null;
  const interestedRequestIds = useBloodDonorStore((s) => s.interestedRequestIds);
  const acceptedRequestIds = useBloodDonorStore((s) => s.acceptedRequestIds);
  const toggleInterested = useBloodDonorStore((s) => s.toggleInterested);
  const acceptRequest = useBloodDonorStore((s) => s.acceptRequest);
  const interestPending = useBloodDonorStore((s) =>
    s.pendingOps.some((o) => o.kind === 'interest' && o.targetId === route.params.requestId),
  );
  const offlineFeed = source === 'offline-fallback' || source === 'cache-stale';

  const isInterested = request ? interestedRequestIds.includes(request.id) : false;
  const isAccepted = request ? acceptedRequestIds.includes(request.id) : false;

  const nearby = useMemo(
    () =>
      requests
        .filter((r) => r.id !== route.params.requestId)
        .sort((a, b) => a.distanceKm - b.distanceKm),
    [requests, route.params.requestId],
  );

  /** Honest empty state — a bad/stale id never crashes the page. */
  if (!request) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={ms(26)} color={BLOOD_TEXT} strokeWidth={2.2} />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Request Details</AppText>
          <View style={styles.headerRightSpacer} />
        </View>
        <View style={styles.missingBody}>
          <Droplet size={ms(30)} color={BLOOD_RED_SOFT} fill={BLOOD_RED_SOFT} strokeWidth={2} />
          <AppText style={styles.missingTitle}>This request is no longer available.</AppText>
          <AppText style={styles.missingSub}>
            It may have been fulfilled or removed. Go back to see other requests.
          </AppText>
        </View>
      </View>
    );
  }

  const handleShare = () => {
    const lines = [
      `Blood donation request — ${request.hospital}`,
      `Blood group ${request.bloodGroup}, ${request.unitsRequired} unit(s) required.`,
      `${request.patientContext} · ${request.neededWithin}`,
      request.hospitalAddress ? request.hospitalAddress : '',
      request.hospitalContact ? `Contact ${request.hospitalContact}` : '',
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => {
      // Share sheet cancellation/failure — nothing to surface.
    });
  };

  const handleCall = () => {
    Linking.openURL(`tel:${request.hospitalContact.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Call unavailable', 'Your device cannot place this call.');
    });
  };

  const handleMap = () => {
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.hospitalAddress)}`,
    ).catch(() => {
      Alert.alert('Map unavailable', 'Your device cannot open maps.');
    });
  };

  const handleAccept = () => {
    if (isAccepted) return;
    Alert.alert(
      'Accept this request?',
      `Your contact details will be shared with ${request.hospital}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => acceptRequest(request.id),
        },
      ],
    );
  };

  const infoTiles = [
    { label: 'Blood Group', value: request.bloodGroup, icon: Droplet },
    {
      label: 'Units Required',
      value: `${request.unitsRequired} Units`,
      icon: Beaker,
    },
    { label: 'Needed Within', value: neededWithinValue(request.neededWithin), icon: Calendar },
    {
      label: 'Posted On',
      value: postedLabel(request.postedHoursAgo),
      icon: Clock,
      valueColor: 'dark' as const,
    },
  ];

  // The first row rendered gets no top border (server-redacted rows may be absent).
  const firstInfoKey = request.patientAge > 0
    ? 'age'
    : request.patientGender
      ? 'gender'
      : request.hospitalContact
        ? 'contact'
        : request.hospitalAddress
          ? 'location'
          : 'remarks';
  const firstInfo = (key: string) => (firstInfoKey === key ? styles.infoRowFirst : undefined);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color={BLOOD_TEXT} strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Request Details</AppText>
        <TouchableOpacity
          onPress={handleShare}
          style={styles.shareBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Share this request"
        >
          <Share2 size={ms(19)} color={BLOOD_TEXT} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hospital card */}
        {offlineFeed ? (
          <View style={styles.offlineChip}>
            <CloudOff size={ms(13)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
            <AppText style={styles.offlineChipText}>Showing saved details — offline</AppText>
          </View>
        ) : null}
        <View style={styles.hospitalCard}>
          {request.imageUrl ? (
            <ExpoImage
              source={{ uri: request.imageUrl }}
              style={styles.hospitalPhoto}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={180}
            />
          ) : (
            <View style={[styles.hospitalPhoto, styles.hospitalPhotoPlaceholder]}>
              <Droplet size={ms(26)} color={BLOOD_RED_SOFT} fill={BLOOD_RED_SOFT} strokeWidth={2} />
            </View>
          )}
          <View style={styles.hospitalCopy}>
            <AppText style={styles.hospitalName} numberOfLines={2}>
              {request.hospital}
            </AppText>
            <View style={styles.verifiedChip}>
              <CircleCheck size={ms(12)} color="#059669" strokeWidth={2.4} />
              <AppText style={styles.verifiedText}>Verified Hospital</AppText>
            </View>
            <View style={styles.addressRow}>
              <MapPin size={ms(12)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
              <AppText style={styles.addressText} numberOfLines={1}>
                {request.city}, {request.state}
              </AppText>
            </View>
          </View>
          {request.hospitalContact ? (
            <TouchableOpacity
              onPress={handleCall}
              style={styles.phoneFab}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Call ${request.hospital}`}
            >
              <Phone size={ms(18)} color="#ffffff" strokeWidth={2.4} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 2×2 info grid */}
        <BloodRequestInfoGrid tiles={infoTiles} />

        {/* Purpose */}
        <View style={styles.sectionCard}>
          <AppText style={styles.sectionLabel}>Purpose</AppText>
          <View style={styles.purposeRow}>
            <View style={styles.personChip}>
              <UserRound size={ms(16)} color={BLOOD_RED} strokeWidth={2.2} />
            </View>
            <View style={styles.purposeCopy}>
              <AppText
                style={[styles.purposeTitle, request.urgency === 'urgent' && styles.purposeUrgent]}
              >
                {request.patientContext}
              </AppText>
              {request.purposeDescription ? (
                <AppText style={styles.purposeDesc}>{request.purposeDescription}</AppText>
              ) : null}
            </View>
          </View>
        </View>

        {/* Additional information */}
        <View style={styles.sectionCard}>
          <AppText style={styles.sectionLabel}>Additional Information</AppText>

          {request.patientAge > 0 ? (
            <View style={[styles.infoRow, firstInfo('age')]}>
              <AppText style={styles.infoLabel}>Age</AppText>
              <AppText style={styles.infoValue}>{request.patientAge} years</AppText>
            </View>
          ) : null}

          {request.patientGender ? (
            <View style={[styles.infoRow, firstInfo('gender')]}>
              <AppText style={styles.infoLabel}>Gender</AppText>
              <AppText style={styles.infoValue}>{request.patientGender}</AppText>
            </View>
          ) : null}

          {request.hospitalContact ? (
            <View style={[styles.infoRow, firstInfo('contact')]}>
              <AppText style={styles.infoLabel}>Contact</AppText>
              <View style={styles.contactWrap}>
                <TouchableOpacity onPress={handleCall} style={styles.contactChip} activeOpacity={0.8}>
                  <Phone size={ms(11)} color={BLOOD_RED_DARK} strokeWidth={2.4} />
                  <AppText style={styles.contactText}>{request.hospitalContact}</AppText>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {request.hospitalAddress ? (
            <View style={[styles.infoRow, firstInfo('location')]}>
              <AppText style={styles.infoLabel}>Location</AppText>
              <View style={styles.locationWrap}>
                <AppText style={styles.locationText} numberOfLines={1}>
                  {request.hospitalAddress}
                </AppText>
                <TouchableOpacity onPress={handleMap} activeOpacity={0.8}>
                  <AppText style={styles.mapLink}>View on Map</AppText>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {request.remarks ? (
            <View style={[styles.infoRow, firstInfo('remarks'), request.remarks ? styles.infoRowLast : undefined]}>
              <AppText style={styles.infoLabel}>Remarks</AppText>
              <AppText style={styles.remarksText}>{request.remarks}</AppText>
            </View>
          ) : null}
        </View>

        {/* Save-a-life banner */}
        <View style={styles.saveBanner}>
          <View style={styles.saveCircle}>
            <HeartHandshake size={ms(22)} color={BLOOD_RED_DARK} strokeWidth={2.2} />
          </View>
          <View style={styles.saveCopy}>
            <AppText style={styles.saveTitle}>{BLOOD_REQUEST_DETAIL_COPY.bannerTitle}</AppText>
            <AppText style={styles.saveSub}>{BLOOD_REQUEST_DETAIL_COPY.bannerSubtitle}</AppText>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => toggleInterested(request.id)}
            style={[styles.interestedBtn, isInterested && styles.interestedActive]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: isInterested }}
          >
            {isInterested ? (
              <BookmarkCheck size={ms(16)} color={BLOOD_RED} strokeWidth={2.4} />
            ) : (
              <Bookmark size={ms(16)} color={BLOOD_RED} strokeWidth={2.4} />
            )}
            <AppText style={[styles.interestedText, isInterested && styles.interestedTextActive]}>
              {isInterested ? 'Interested ✓' : 'Mark Interested'}
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAccept}
            disabled={isAccepted}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: isAccepted }}
            style={[styles.acceptBtn, isAccepted && styles.acceptDisabled]}
          >
            <CircleCheck size={ms(17)} color="#ffffff" strokeWidth={2.4} />
            <AppText style={styles.acceptText}>
              {isAccepted ? 'Accepted ✓' : 'Accept & Proceed'}
            </AppText>
          </TouchableOpacity>
        </View>

        {interestPending ? (
          <View style={styles.syncNote}>
            <CloudOff size={ms(12)} color={BLOOD_RED_DARK} strokeWidth={2.2} />
            <AppText style={styles.syncNoteText}>Not yet synced — will retry</AppText>
          </View>
        ) : null}

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <ShieldCheck size={ms(14)} color="#059669" strokeWidth={2.2} />
          <AppText style={styles.privacyText}>{BLOOD_REQUEST_DETAIL_COPY.confirmNote}</AppText>
        </View>

        {/* Other requests nearby */}
        <View style={styles.nearbySection}>
          <View style={styles.nearbyHeaderRow}>
            <View style={styles.nearbyTitleRow}>
              <Info size={ms(14)} color={BLOOD_TEXT} strokeWidth={2.2} />
              <AppText style={styles.nearbyTitle}>Other Requests Nearby</AppText>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <AppText style={styles.viewAllText}>View All</AppText>
            </TouchableOpacity>
          </View>
          <View style={styles.nearbyList}>
            {nearby.map((other) => (
              <NearbyRequestCard
                key={other.id}
                request={other}
                onPress={(r) =>
                  navigation.push('BloodRequestDescription', { requestId: r.id })
                }
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLOOD_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
    paddingBottom: SPACE.BLOCK,
    backgroundColor: '#ffffff',
  },
  backButton: {
    marginRight: hs(8),
    padding: hs(2),
  },
  headerTitle: {
    fontSize: ms(17),
    fontWeight: '800',
    color: BLOOD_TEXT,
    flex: 1,
  },
  headerRightSpacer: {
    width: ms(30),
  },
  shareBtn: {
    padding: hs(4),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: hs(20),
    paddingTop: SPACE.BLOCK,
    paddingBottom: SPACE.SECTION,
    gap: SPACE.SECTION,
  },
  missingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: hs(32),
    gap: SPACE.BLOCK,
  },
  missingTitle: {
    fontSize: ms(14),
    fontWeight: '800',
    color: BLOOD_TEXT,
    textAlign: 'center',
  },
  missingSub: {
    fontSize: ms(12),
    color: BLOOD_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: vs(17),
  },
  hospitalCard: {
    flexDirection: 'row',
    gap: hs(12),
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.card,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    padding: hs(12),
    alignItems: 'center',
  },
  hospitalPhoto: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(14),
  },
  hospitalPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLOOD_RED_TINT,
  },
  hospitalCopy: {
    flex: 1,
    gap: vs(4),
  },
  hospitalName: {
    fontSize: ms(14),
    fontWeight: '900',
    color: BLOOD_TEXT,
    lineHeight: vs(18),
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: hs(4),
    backgroundColor: '#ECFDF5',
    borderRadius: BLOOD_RADII.pill,
    paddingHorizontal: hs(8),
    paddingVertical: vs(3),
  },
  verifiedText: {
    fontSize: ms(9.5),
    color: '#059669',
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
  },
  addressText: {
    fontSize: ms(11),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '500',
    flexShrink: 1,
  },
  phoneFab: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(21),
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.card,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    paddingHorizontal: hs(16),
    paddingVertical: vs(14),
    gap: SPACE.BLOCK,
  },
  sectionLabel: {
    fontSize: ms(12),
    fontWeight: '900',
    color: BLOOD_TEXT,
  },
  purposeRow: {
    flexDirection: 'row',
    gap: hs(12),
    alignItems: 'flex-start',
  },
  personChip: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(12),
    backgroundColor: BLOOD_RED_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purposeCopy: {
    flex: 1,
    gap: vs(3),
  },
  purposeTitle: {
    fontSize: ms(13),
    fontWeight: '800',
    color: BLOOD_TEXT,
  },
  purposeUrgent: {
    color: BLOOD_RED_DARK,
  },
  purposeDesc: {
    fontSize: ms(11.5),
    color: BLOOD_TEXT_MUTED,
    lineHeight: vs(16),
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
    paddingVertical: SPACE.ITEM,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  infoRowFirst: {
    borderTopWidth: 0,
  },
  infoRowLast: {
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: ms(11.5),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: ms(12),
    color: BLOOD_TEXT,
    fontWeight: '700',
    textAlign: 'right',
  },
  contactWrap: {
    flexShrink: 1,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: hs(4),
    backgroundColor: BLOOD_RED_TINT,
    borderRadius: BLOOD_RADII.pill,
    paddingHorizontal: hs(10),
    paddingVertical: vs(4),
  },
  contactText: {
    fontSize: ms(10.5),
    color: BLOOD_RED_DARK,
    fontWeight: '700',
  },
  locationWrap: {
    flexShrink: 1,
    alignItems: 'flex-end',
    gap: vs(2),
  },
  locationText: {
    fontSize: ms(11.5),
    color: BLOOD_TEXT,
    fontWeight: '600',
    textAlign: 'right',
  },
  mapLink: {
    fontSize: ms(10.5),
    color: BLOOD_RED_DARK,
    fontWeight: '800',
  },
  remarksText: {
    fontSize: ms(11.5),
    color: BLOOD_TEXT,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
    lineHeight: vs(16),
  },
  saveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(12),
    backgroundColor: BLOOD_RED_TINT,
    borderRadius: BLOOD_RADII.card,
    paddingHorizontal: hs(16),
    paddingVertical: vs(14),
  },
  saveCircle: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCopy: {
    flex: 1,
    gap: vs(2),
  },
  saveTitle: {
    fontSize: ms(12.5),
    fontWeight: '900',
    color: BLOOD_RED_DARK,
  },
  saveSub: {
    fontSize: ms(11),
    color: BLOOD_TEXT_MUTED,
    lineHeight: vs(15),
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: hs(10),
  },
  interestedBtn: {
    flex: 1,
    height: ms(48),
    borderRadius: BLOOD_RADII.pill,
    borderWidth: 1.5,
    borderColor: BLOOD_RED,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
  },
  interestedActive: {
    backgroundColor: BLOOD_RED_TINT,
  },
  interestedText: {
    fontSize: ms(12),
    fontWeight: '800',
    color: BLOOD_RED,
  },
  interestedTextActive: {
    color: BLOOD_RED_DARK,
  },
  acceptBtn: {
    flex: 1,
    height: ms(48),
    borderRadius: BLOOD_RADII.pill,
    backgroundColor: BLOOD_RED,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
  },
  acceptDisabled: {
    backgroundColor: BLOOD_RED_DARK,
    opacity: 0.55,
  },
  acceptText: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#ffffff',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
  privacyText: {
    fontSize: ms(10.5),
    color: '#059669',
    fontWeight: '600',
    flex: 1,
  },
  nearbySection: {
    marginTop: vs(4),
    gap: SPACE.BLOCK,
  },
  nearbyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nearbyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
  nearbyTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: BLOOD_TEXT,
  },
  viewAllText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: BLOOD_RED_DARK,
  },
  nearbyList: {
    gap: SPACE.ITEM,
  },
  offlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: BLOOD_RADII.pill,
    paddingHorizontal: hs(10),
    paddingVertical: vs(5),
  },
  offlineChipText: {
    fontSize: ms(10.5),
    fontWeight: '700',
    color: BLOOD_TEXT_MUTED,
  },
  syncNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    alignSelf: 'center',
  },
  syncNoteText: {
    fontSize: ms(10.5),
    fontWeight: '700',
    color: BLOOD_RED_DARK,
  },
});
