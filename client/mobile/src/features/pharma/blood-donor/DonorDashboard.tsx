import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { AppGradient } from '@/components/shared/AppGradient';
import { Bell, HeartPulse, Droplet, Search, Funnel, CloudOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { ASK_BLOOD_COPY } from '@data/index';
import { gateway } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import { useBloodRequests } from './hooks/useBloodRequests';
import type { RootStackParamList } from '@/navigation/types';
import { BloodRequestCard } from './components/BloodRequestCard';
import { IncomingDonorRequestCard } from './components/IncomingDonorRequestCard';
import AskBloodSheet from './components/AskBloodSheet';
import FilterSheet, { EMPTY_BLOOD_FILTERS, type BloodBoardFilters } from './components/FilterSheet';
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

type FilterId = 'all' | 'nearby' | 'urgent';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Donation Requests' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'urgent', label: 'Urgent' },
];

const SEARCH_PLACEHOLDER = 'Search by location, hospital or blood group';

/** First word of a name; honest "Donor" fallback when none is on file. */
function firstName(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.split(/\s+/)[0] : 'Donor';
}

/**
 * Registered-donor dashboard: greeting, impact banner, request feed with
 * chip + search filtering. The feed is server-backed (`useBloodRequests`); a
 * labelled offline/stale chip is shown instead of fixture rows.
 */
export function DonorDashboard() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const registration = useBloodDonorStore((s) => s.registration);
  const incomingMatchRequests = useBloodDonorStore((s) => s.incomingMatchRequests);
  const respondToMatch = useBloodDonorStore((s) => s.respondToMatch);
  const refreshIncoming = useBloodDonorStore((s) => s.refreshIncoming);
  const userName = useAuthStore((s) => s.user?.name);

  const [filter, setFilter] = useState<FilterId>('all');
  const [query, setQuery] = useState('');
  const [askOpen, setAskOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<BloodBoardFilters>(EMPTY_BLOOD_FILTERS);
  const [boardReload, setBoardReload] = useState(0);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [notifCount, setNotifCount] = useState(0);
  const { requests, source } = useBloodRequests(boardReload);
  const pendingOps = useBloodDonorStore((s) => s.pendingOps);
  const lastWriteStatus = useBloodDonorStore((s) => s.lastWriteStatus);
  const offlineFeed = source === 'offline-fallback' || source === 'cache-stale';
  const emptyAuthoritative = source === 'empty-authoritative';

  // Pull any incoming targeted asks that arrived while the app was open (cross-device delivery).
  useEffect(() => {
    void refreshIncoming();
  }, [refreshIncoming]);

  // Honest inbox count: server notifications only (mock/anon → 0), never a fabricated seed.
  useEffect(() => {
    let active = true;
    gateway
      .getNotifications()
      .then((items) => {
        if (active) setNotifCount(items.length);
      })
      .catch(() => {
        if (active) setNotifCount(0);
      });
    return () => {
      active = false;
    };
  }, []);

  const incomingRequests = incomingMatchRequests;
  const pendingIncoming = incomingRequests.filter((request) => request.status === 'pending').length;
  const unreadCount = notifCount + pendingIncoming;
  const filtersActive = filters.bloodGroup !== null || filters.urgency !== 'all' || filters.city.trim() !== '';

  const handleRespond = async (id: string, status: 'accepted' | 'declined') => {
    setRespondingId(id);
    await respondToMatch(id, status);
    setRespondingId(null);
  };

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    const group = filters.bloodGroup;
    const cityFilter = filters.city.trim().toLowerCase();
    const matches = requests.filter((r) => {
      if (group && r.bloodGroup !== group) return false;
      if (filters.urgency !== 'all' && r.urgency !== filters.urgency) return false;
      if (cityFilter && !r.city.toLowerCase().includes(cityFilter)) return false;
      if (filter === 'nearby') {
        // Honest "nearby" in production: the request's city vs the donor's own
        // registered preferred location (case-insensitive contains). This is a
        // city-string match, not GPS — real geo (coords + earthdistance index)
        // swaps this matcher, not the UI.
        const donorLocation = (registration?.profile.preferredLocation ?? '').toLowerCase();
        if (!donorLocation || !r.city.toLowerCase().includes(donorLocation.split(',')[0].trim())) {
          if (!donorLocation.includes(r.city.toLowerCase())) return false;
        }
      }
      if (filter === 'urgent' && r.urgency !== 'urgent') return false;
      if (q) {
        const haystack = `${r.hospital} ${r.city} ${r.state} ${r.bloodGroup}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return matches;
  }, [filter, filters, query, registration, requests]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <AppText style={styles.greeting}>Hi, {firstName(userName)}</AppText>
            <AppText style={styles.greetingSub}>Ready to save lives?</AppText>
          </View>
          {/* No inbox screen yet, so this is a non-interactive status indicator (no dead tap). The
              badge counts live server notifications + pending incoming requests, never a seed. */}
          <View
            style={styles.bellBtn}
            accessibilityLabel={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
            }
          >
            <Bell size={ms(20)} color={BLOOD_TEXT} strokeWidth={2.2} />
            {unreadCount > 0 ? (
              <View style={styles.bellBadge}>
                <AppText style={styles.bellBadgeText}>{unreadCount}</AppText>
              </View>
            ) : null}
          </View>
        </View>

        {pendingOps.length > 0 ? (
          <View style={styles.syncBanner}>
            <CloudOff size={ms(14)} color={BLOOD_RED_DARK} strokeWidth={2.2} />
            <AppText style={styles.syncBannerText}>
              {lastWriteStatus === 'signed-out'
                ? "Signed out — sign in to sync your donor changes."
                : "Not yet synced — we'll retry automatically."}
            </AppText>
          </View>
        ) : null}

        <AppGradient
          colors={[BLOOD_RED, BLOOD_RED_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.impactBanner}
        >
          <View style={styles.impactCopy}>
            <AppText style={styles.impactTitle}>You can make a difference</AppText>
            <AppText style={styles.impactSub}>Real people. Real needs. Real impact.</AppText>
          </View>
          <View style={styles.impactArt}>
            <View style={styles.impactCircle}>
              <HeartPulse size={ms(24)} color={BLOOD_RED} strokeWidth={2.4} />
            </View>
            <View style={styles.impactDroplet}>
              <Droplet size={ms(12)} color="#ffffff" fill="#ffffff" strokeWidth={2} />
            </View>
          </View>
        </AppGradient>

        {incomingRequests.length > 0 ? (
          <View style={styles.incomingSection}>
            <View style={styles.sectionHeaderRow}>
              <AppText style={styles.sectionTitle}>Requests for You</AppText>
              <AppText style={styles.sectionCount}>{incomingRequests.length}</AppText>
            </View>
            <View style={styles.incomingList}>
              {incomingRequests.map((request) => (
                <IncomingDonorRequestCard
                  key={request.id}
                  request={request}
                  onRespond={(status) => handleRespond(request.id, status)}
                  busy={respondingId === request.id}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <AppText style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Search size={ms(19)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
            <AppTextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={SEARCH_PLACEHOLDER}
              placeholderTextColor={BLOOD_TEXT_MUTED}
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity
            onPress={() => setFilterOpen(true)}
            style={[styles.funnelBtn, filtersActive && styles.funnelBtnActive]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={filtersActive ? 'Filter requests, filters active' : 'Filter requests'}
          >
            <Funnel size={ms(18)} color={filtersActive ? '#ffffff' : BLOOD_TEXT} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {filter === 'nearby' ? (
          <AppText style={styles.nearbyNote}>Matched by your registered city — not GPS distance.</AppText>
        ) : null}

        {offlineFeed ? (
          <View style={styles.offlineChip}>
            <CloudOff size={ms(13)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
            <AppText style={styles.offlineChipText}>Showing saved requests — offline</AppText>
          </View>
        ) : null}

        {filteredRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Droplet size={ms(26)} color={BLOOD_RED_SOFT} fill={BLOOD_RED_SOFT} strokeWidth={2} />
            <AppText style={styles.emptyTitle}>
              {emptyAuthoritative && !query.trim() && filter === 'all'
                ? 'No donation requests right now.'
                : 'No donation requests match your filters.'}
            </AppText>
            <AppText style={styles.emptySub}>
              {emptyAuthoritative && !query.trim() && filter === 'all'
                ? 'Check back soon — new requests will appear here.'
                : 'Try clearing the search or switching to all donation requests.'}
            </AppText>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredRequests.map((request) => {
              return (
                <BloodRequestCard
                  key={request.id}
                  request={request}
                  onPress={() =>
                    navigation.navigate('BloodRequestDescription', { requestId: request.id, source })
                  }
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Ask Blood floating action — available on the dashboard */}
      <TouchableOpacity
        onPress={() => setAskOpen(true)}
        style={[styles.fab, { bottom: vs(16) }]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={ASK_BLOOD_COPY.fabLabel}
      >
        <Droplet size={ms(18)} color="#ffffff" fill="#ffffff" strokeWidth={2.2} />
        <AppText style={styles.fabText}>{ASK_BLOOD_COPY.fabLabel}</AppText>
      </TouchableOpacity>

      <AskBloodSheet
        visible={askOpen}
        onClose={() => setAskOpen(false)}
        onPosted={() => setBoardReload((n) => n + 1)}
      />

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={setFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLOOD_BG,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: hs(12),
  },
  headerCopy: {
    flex: 1,
    gap: vs(2),
  },
  greeting: {
    fontSize: ms(20),
    fontWeight: '900',
    color: BLOOD_TEXT,
  },
  greetingSub: {
    fontSize: ms(12),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '600',
  },
  bellBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -ms(4),
    right: -ms(4),
    minWidth: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(4),
  },
  bellBadgeText: {
    fontSize: ms(9),
    fontWeight: '900',
    color: '#ffffff',
  },
  impactBanner: {
    borderRadius: BLOOD_RADII.card,
    paddingHorizontal: hs(18),
    paddingVertical: vs(18),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
  },
  incomingSection: {
    gap: SPACE.BLOCK,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(7),
  },
  sectionTitle: {
    color: BLOOD_TEXT,
    fontSize: ms(14),
    fontWeight: '900',
  },
  sectionCount: {
    minWidth: ms(20),
    paddingHorizontal: hs(6),
    paddingVertical: vs(2),
    borderRadius: BLOOD_RADII.pill,
    backgroundColor: BLOOD_RED_SOFT,
    color: BLOOD_RED,
    fontSize: ms(10),
    fontWeight: '900',
    textAlign: 'center',
  },
  incomingList: {
    gap: SPACE.ITEM,
  },
  impactCopy: {
    flex: 1,
    gap: vs(4),
  },
  impactTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    color: '#ffffff',
  },
  impactSub: {
    fontSize: ms(11),
    color: '#FEE2E2',
    fontWeight: '600',
  },
  impactArt: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactCircle: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactDroplet: {
    position: 'absolute',
    bottom: -vs(4),
    right: -hs(4),
    width: ms(22),
    height: ms(22),
    borderRadius: ms(11),
    backgroundColor: BLOOD_RED_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: hs(8),
  },
  chip: {
    borderRadius: BLOOD_RADII.pill,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: hs(14),
    paddingVertical: vs(7),
  },
  chipActive: {
    backgroundColor: BLOOD_RED,
    borderColor: BLOOD_RED,
  },
  chipText: {
    fontSize: ms(11),
    fontWeight: '700',
    color: BLOOD_TEXT_MUTED,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
  },
  searchField: {
    flex: 1,
    height: ms(44),
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(14),
    gap: hs(10),
  },
  searchInput: {
    flex: 1,
    fontSize: ms(12),
    fontWeight: '600',
    color: BLOOD_TEXT,
    padding: 0,
  },
  funnelBtn: {
    width: ms(44),
    height: ms(44),
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  funnelBtnActive: {
    backgroundColor: BLOOD_RED,
    borderColor: BLOOD_RED,
  },
  nearbyNote: {
    fontSize: ms(10.5),
    fontWeight: '600',
    color: BLOOD_TEXT_MUTED,
    marginTop: -vs(6),
  },
  list: {
    gap: SPACE.ITEM,
  },
  fab: {
    position: 'absolute',
    right: hs(20),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    backgroundColor: BLOOD_RED,
    borderRadius: BLOOD_RADII.pill,
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    shadowColor: BLOOD_RED_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#ffffff',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.card,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    alignItems: 'center',
    paddingHorizontal: hs(24),
    paddingVertical: vs(36),
    gap: SPACE.BLOCK,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    backgroundColor: BLOOD_RED_TINT,
    borderRadius: BLOOD_RADII.chip,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    paddingHorizontal: hs(12),
    paddingVertical: vs(9),
  },
  syncBannerText: {
    flex: 1,
    fontSize: ms(11.5),
    fontWeight: '700',
    color: BLOOD_RED_DARK,
    lineHeight: vs(16),
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
  emptyTitle: {
    fontSize: ms(13),
    fontWeight: '800',
    color: BLOOD_TEXT,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: ms(11),
    color: BLOOD_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: vs(16),
  },
});
