import React, { useMemo, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, HeartPulse, Droplet, Search, Funnel } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_REQUESTS, BLOOD_DONOR_UNREAD_ALERTS } from '@data/index';
import { useAuthStore } from '@/state/authStore';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import type { RootStackParamList } from '@/navigation/types';
import { BloodRequestCard } from './components/BloodRequestCard';
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
 * chip + search filtering. Presentational — the feed comes from `@data` until
 * the backend is wired.
 */
export function DonorDashboard() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const registration = useBloodDonorStore((s) => s.registration);
  const userName = useAuthStore((s) => s.user?.name);

  const [filter, setFilter] = useState<FilterId>('all');
  const [query, setQuery] = useState('');

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BLOOD_REQUESTS.filter((r) => {
      if (filter === 'nearby') {
        // Honest "nearby" for the mock stage: the request's city vs the donor's
        // own registered preferred location (case-insensitive contains). Real
        // geo swaps this matcher, not the UI.
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
  }, [filter, query, registration]);

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
          <TouchableOpacity
            // TODO(bell): no notification screen/push infra yet — badge is a
            // seed constant; wire a real alerts page before enabling this.
            style={styles.bellBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Notifications, ${BLOOD_DONOR_UNREAD_ALERTS} unread`}
          >
            <Bell size={ms(20)} color={BLOOD_TEXT} strokeWidth={2.2} />
            <View style={styles.bellBadge}>
              <AppText style={styles.bellBadgeText}>{BLOOD_DONOR_UNREAD_ALERTS}</AppText>
            </View>
          </TouchableOpacity>
        </View>

        <LinearGradient
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
        </LinearGradient>

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
            // TODO(funnel): visual-only until a filter sheet is designed.
            style={styles.funnelBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Filter requests"
          >
            <Funnel size={ms(18)} color={BLOOD_TEXT} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {filteredRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Droplet size={ms(26)} color={BLOOD_RED_SOFT} fill={BLOOD_RED_SOFT} strokeWidth={2} />
            <AppText style={styles.emptyTitle}>No donation requests match your filters.</AppText>
            <AppText style={styles.emptySub}>
              Try clearing the search or switching to all donation requests.
            </AppText>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredRequests.map((request) => (
              <BloodRequestCard
                key={request.id}
                request={request}
                onPress={() =>
                  navigation.navigate('BloodRequestDescription', { requestId: request.id })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingTop: vs(16),
    paddingBottom: vs(32),
    gap: vs(16),
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
  list: {
    gap: vs(12),
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.card,
    borderWidth: 1,
    borderColor: BLOOD_BORDER,
    alignItems: 'center',
    paddingHorizontal: hs(24),
    paddingVertical: vs(36),
    gap: vs(8),
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
