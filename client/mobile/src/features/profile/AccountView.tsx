import React, { useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ChevronLeft,
  Package,
  LogOut,
  IdCard,
  MapPin,
  CreditCard,
  Headphones,
  Heart,
  Clock,
  Coins,
  Flame,
  Store,
  Percent,
  Trash2,
  ShieldCheck,
} from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { useAccountNav } from '@/features/profile/useAccountNav';
import type { AccountNavGroup, AccountNavRow } from '@data/types';
import { useRewardsStore } from '@/state/rewardsStore';
import { STREAK_TARGET_DAYS } from '@data/rewards/rewards';
import { isPartnerAdmin, useAuthStore } from '@/state/authStore';

const NAV_ICONS: Record<string, React.ComponentType<any>> = {
  idcard: IdCard,
  'map-pin': MapPin,
  'credit-card': CreditCard,
  headphones: Headphones,
  heart: Heart,
  clock: Clock,
  package: Package,
  store: Store,
  trash: Trash2,
  shield: ShieldCheck,
};

const BRAND_BLUE = '#1162D3';

export interface AccountViewProps {
  /** When provided, a back arrow is rendered in the fixed header (pushed mode). */
  onBack?: () => void;
  onOpenDetails: () => void;
  onOpenAddresses: () => void;
  onOpenDeleteAccount?: () => void;
  onOpenRequestDataDeletion?: () => void;
  onOpenOrders: () => void;
  onOpenFavourites?: () => void;
  onOpenRewards?: () => void;
  onOpenSellWithUs?: () => void;
  onOpenSellerRequests?: () => void;
  onOpenFeeChangeRequests?: () => void;
  onOpenPlatformFeeRequest?: () => void;
  onLogout: () => void;
}

/**
 * Presentational "You" page. No react-navigation imports — navigation is wired
 * by thin wrappers (tab `AccountScreen` and root-stack `YouScreen`), exactly
 * mirroring the CartView/CartScreen split so the page is reusable from any
 * sub-app without duplication.
 */
export function AccountView({
  onBack,
  onOpenDetails,
  onOpenAddresses,
  onOpenDeleteAccount,
  onOpenRequestDataDeletion,
  onOpenOrders,
  onOpenFavourites,
  onOpenRewards,
  onOpenSellWithUs,
  onOpenSellerRequests,
  onOpenFeeChangeRequests,
  onOpenPlatformFeeRequest,
  onLogout,
}: AccountViewProps) {
  const insets = useSafeAreaInsets();
  const coinBalance = useRewardsStore((s) => s.coinBalance);
  const streakCount = useRewardsStore((s) => s.streakCount);
  const authUser = useAuthStore((s) => s.user);
  // Nav groups: server rows first, universal catalog chrome fills empty groups (see useAccountNav).
  const accountNavGroups = useAccountNav();

  const handleRowPress = useCallback(
    (row: AccountNavRow) => {
      if (row.key === 'orders') {
        onOpenOrders();
        return;
      }
      if (row.key === 'favourites' && onOpenFavourites) {
        onOpenFavourites();
        return;
      }
      if (row.key === 'sell-with-us' && onOpenSellWithUs) {
        onOpenSellWithUs();
        return;
      }
      if (row.key === 'details') {
        onOpenDetails();
        return;
      }
      if (row.key === 'addresses') {
        onOpenAddresses();
        return;
      }
      if (row.key === 'delete-account' && onOpenDeleteAccount) {
        onOpenDeleteAccount();
        return;
      }
      if (row.key === 'request-data-deletion' && onOpenRequestDataDeletion) {
        onOpenRequestDataDeletion();
        return;
      }
      // TODO: Destination screens per row — stubs for now.
    },
    [
      onOpenOrders,
      onOpenFavourites,
      onOpenSellWithUs,
      onOpenDetails,
      onOpenAddresses,
      onOpenDeleteAccount,
      onOpenRequestDataDeletion,
    ]
  );

  return (
    <View style={styles.container}>
      {/* Fixed top bar (You) — stays pinned while content scrolls. */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + vs(12) }]}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerText}>
          <AppText style={styles.headerTitle}>My Account</AppText>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* FaazioCoins streak card */}
        <TouchableOpacity
          style={styles.coinsCard}
          activeOpacity={0.85}
          onPress={onOpenRewards}
          accessibilityRole="button"
          accessibilityLabel="Open FaazioRewards"
        >
          <View style={styles.coinsHeader}>
            <View style={styles.coinsTitleRow}>
              <View style={styles.coinsIcon}>
                <Coins size={ms(16)} color="#B45309" strokeWidth={2.2} />
              </View>
              <AppText style={styles.coinsTitle}>FaazioCoins</AppText>
            </View>
            <View style={styles.coinsBalanceWrap}>
              <AppText style={styles.coinsBalance}>{coinBalance.toLocaleString('en-IN')}</AppText>
              <AppText style={styles.coinsBalanceUnit}>coins</AppText>
            </View>
          </View>

          <View style={styles.fireRow}>
            {Array.from({ length: STREAK_TARGET_DAYS }).map((_, i) => {
              const filled = i < streakCount;
              return (
                <View key={i} style={styles.fireWrap}>
                  <Flame
                    size={ms(22)}
                    color={filled ? '#F97316' : '#E2E8F0'}
                    strokeWidth={2.2}
                    fill={filled ? '#F97316' : 'none'}
                  />
                </View>
              );
            })}
          </View>
          <AppText style={styles.coinsCaption}>
            {streakCount} of {STREAK_TARGET_DAYS} days — order today to keep your streak
          </AppText>
        </TouchableOpacity>

        {/* 5 + 6. Nav groups */}
        {accountNavGroups.map((group: AccountNavGroup) => (
          <View key={group.key} style={styles.navGroup}>
            {group.title ? (
              <AppText style={styles.navGroupTitle}>{group.title}</AppText>
            ) : null}
            <View style={styles.navCard}>
              {group.comingSoon ? (
                <View style={[styles.navRow, styles.navRowLast, styles.navComingSoon]}>
                  <View style={styles.navComingSoonBox}>
                    <AppText style={styles.navComingSoonDot}>•</AppText>
                  </View>
                  <View style={styles.navText}>
                    <AppText style={styles.navComingSoonTitle}>Coming soon</AppText>
                    <AppText style={styles.navSubtitle}>This section isn't available yet</AppText>
                  </View>
                </View>
              ) : (
                group.rows.map((row, i) => {
                  const Icon = NAV_ICONS[row.icon] ?? IdCard;
                  const isLast = i === group.rows.length - 1;
                  return (
                    <TouchableOpacity
                      key={row.key}
                      style={[styles.navRow, isLast && styles.navRowLast]}
                      activeOpacity={0.7}
                      onPress={() => handleRowPress(row)}
                    >
                      <View style={styles.navIconBox}>
                        <Icon size={ms(18)} color={BRAND_BLUE} strokeWidth={2.2} />
                      </View>
                      <View style={styles.navText}>
                        <AppText style={styles.navTitle}>{row.title}</AppText>
                        <AppText style={styles.navSubtitle}>{row.subtitle}</AppText>
                      </View>
                      <ChevronRight size={ms(18)} color={BRAND_BLUE} strokeWidth={2.2} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        ))}

        {/* 7. Partner admin console (role-gated, not data-driven — gate mirrors seller-review routes). */}
        {isPartnerAdmin(authUser) && onOpenSellerRequests ? (
          <TouchableOpacity style={styles.adminCard} activeOpacity={0.7} onPress={onOpenSellerRequests}>
            <View style={styles.adminIcon}>
              <Store size={ms(18)} color="#1162D3" strokeWidth={2.2} />
            </View>
            <View style={styles.adminText}>
              <AppText style={styles.adminTitle}>Seller applications</AppText>
              <AppText style={styles.adminSubtitle}>
                {authUser?.role === 'SUPER_ADMIN'
                  ? 'Review every seller in the platform'
                  : 'Review sellers in your district'}
              </AppText>
            </View>
            <ChevronRight size={ms(18)} color={BRAND_BLUE} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}

        {isPartnerAdmin(authUser) && onOpenFeeChangeRequests ? (
          <TouchableOpacity
            style={styles.adminCard}
            activeOpacity={0.7}
            onPress={onOpenFeeChangeRequests}
          >
            <View style={styles.adminIcon}>
              <Percent size={ms(18)} color="#1162D3" strokeWidth={2.2} />
            </View>
            <View style={styles.adminText}>
              <AppText style={styles.adminTitle}>Fee change requests</AppText>
              <AppText style={styles.adminSubtitle}>
                {authUser?.role === 'SUPER_ADMIN'
                  ? 'Review platform-fee requests from every district'
                  : 'Review platform-fee requests in your district'}
              </AppText>
            </View>
            <ChevronRight size={ms(18)} color={BRAND_BLUE} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}

        {authUser?.role === 'SELLER' && authUser.sellerId && onOpenPlatformFeeRequest ? (
          <TouchableOpacity
            style={styles.adminCard}
            activeOpacity={0.7}
            onPress={onOpenPlatformFeeRequest}
          >
            <View style={styles.adminIcon}>
              <Percent size={ms(18)} color="#1162D3" strokeWidth={2.2} />
            </View>
            <View style={styles.adminText}>
              <AppText style={styles.adminTitle}>Request a fee change</AppText>
              <AppText style={styles.adminSubtitle}>Ask an admin to update your platform fee</AppText>
            </View>
            <ChevronRight size={ms(18)} color={BRAND_BLUE} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}

        {/* 8. Logout */}
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={onLogout}>
          <LogOut size={ms(18)} color="#ffffff" strokeWidth={2.2} />
          <AppText style={styles.logoutText}>Log Out</AppText>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACE.SECTION,
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backButton: {
    marginRight: hs(8),
    paddingVertical: vs(2),
  },
  headerText: {
    flex: 1,
    paddingRight: hs(12),
  },
  headerTitle: {
    fontSize: ms(22),
    fontWeight: '900',
    color: '#0f172a',
  },
  coinsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(18),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: hs(16),
    marginBottom: SPACE.SECTION,
  },
  coinsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(14),
  },
  coinsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinsIcon: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(9),
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(8),
  },
  coinsTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#1E2022',
  },
  coinsBalanceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  coinsBalance: {
    fontSize: ms(18),
    fontWeight: '900',
    color: '#B45309',
  },
  coinsBalanceUnit: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#94A3B8',
    marginLeft: hs(4),
  },
  fireRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: hs(2),
  },
  fireWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinsCaption: {
    fontSize: ms(11),
    color: '#64748B',
    fontWeight: '600',
    marginTop: SPACE.BLOCK,
    textAlign: 'center',
  },
  navCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    paddingHorizontal: hs(6),
    marginBottom: SPACE.SECTION,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  navGroup: {
    marginBottom: vs(4),
  },
  navGroupTitle: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: hs(4),
    marginBottom: SPACE.BLOCK,
  },
  navComingSoon: {
    opacity: 0.75,
  },
  navComingSoonBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navComingSoonDot: {
    fontSize: ms(22),
    fontWeight: '800',
    color: '#94a3b8',
  },
  navComingSoonTitle: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#64748b',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(14),
    paddingHorizontal: hs(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF1F5',
  },
  navRowLast: {
    borderBottomWidth: 0,
  },
  navIconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    flex: 1,
    marginLeft: hs(12),
    marginRight: hs(8),
  },
  navTitle: {
    fontSize: ms(14),
    fontWeight: '700',
    color: '#0f172a',
  },
  navSubtitle: {
    fontSize: ms(11.5),
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: vs(2),
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    padding: hs(14),
    marginBottom: SPACE.SECTION,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  adminIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminText: { flex: 1 },
  adminTitle: { fontSize: ms(14), fontWeight: '800', color: '#0f172a' },
  adminSubtitle: { fontSize: ms(11.5), fontWeight: '500', color: '#94a3b8', marginTop: vs(2) },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    height: Math.max(50, vs(50)),
    borderRadius: ms(14),
    backgroundColor: '#e11d48',
    marginTop: vs(4),
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutText: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#ffffff',
  },
});
