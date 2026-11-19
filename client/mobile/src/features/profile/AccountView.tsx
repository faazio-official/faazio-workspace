import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  Heart,
  Coins,
  Cookie,
  FileText,
  Flame,
  Info,
  Lock,
  Receipt,
  Store,
  Percent,
  Trash2,
  ShieldCheck,
  Palette,
  Languages,
} from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { useLanguageStore } from '@/state/languageStore';
import { languageLabel } from '@/lib/languages';
import { useAccountNav } from '@/features/profile/useAccountNav';
import type { AccountNavGroup, AccountNavRow } from '@data/types';
import { useRewardsStore } from '@/state/rewardsStore';
import { STREAK_TARGET_DAYS } from '@data/rewards/rewards';
import { isPartnerAdmin, useAuthStore } from '@/state/authStore';
import { openTrustedUrl } from '@/lib/externalLinks';
import { COOKIES_URL, DISCLAIMER_URL, PRIVACY_URL, REFUNDS_URL, TERMS_URL } from '@/lib/site';
import { useThemeMode } from '@/hooks/useThemeMode';
import type { AppPalette } from '@/theme/theme';

const NAV_ICONS: Record<string, React.ComponentType<any>> = {
  idcard: IdCard,
  'map-pin': MapPin,
  heart: Heart,
  package: Package,
  store: Store,
  trash: Trash2,
  shield: ShieldCheck,
  'file-text': FileText,
  lock: Lock,
  receipt: Receipt,
  cookie: Cookie,
  info: Info,
};

/** Legal rows open the published pages in the system browser (restricted to faazio.com). */
const LEGAL_LINKS: Record<string, string> = {
  terms: TERMS_URL,
  privacy: PRIVACY_URL,
  refunds: REFUNDS_URL,
  cookies: COOKIES_URL,
  disclaimer: DISCLAIMER_URL,
};

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
  onOpenAppearance?: () => void;
  onOpenLanguage?: () => void;
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
  onOpenAppearance,
  onOpenLanguage,
  onOpenSellWithUs,
  onOpenSellerRequests,
  onOpenFeeChangeRequests,
  onOpenPlatformFeeRequest,
  onLogout,
}: AccountViewProps) {
  const insets = useSafeAreaInsets();
  const { themeMode, effectiveMode, palette } = useThemeMode();
  const language = useLanguageStore((s) => s.language);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const appearanceLabel =
    themeMode === 'auto'
      ? `Auto — ${effectiveMode === 'dark' ? 'Dark' : 'Light'}`
      : themeMode === 'dark'
        ? 'Dark'
        : 'Light';
  const coinBalance = useRewardsStore((s) => s.coinBalance);
  const streakCount = useRewardsStore((s) => s.streakCount);
  const authUser = useAuthStore((s) => s.user);
  // Nav groups: server-authoritative (DB catalog + per-user overrides). Groups with no real rows are
  // omitted so a stale/empty projection can never render as a blank titled card.
  const {
    groups: accountNavGroups,
    loading: navLoading,
    error: navError,
    retry: retryNav,
  } = useAccountNav();
  const visibleGroups = accountNavGroups.filter((group) => group.rows.length > 0);

  const handleLogout = useCallback(() => {
    Alert.alert('Log out?', 'You will need to sign in again to use Faazio.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: onLogout },
    ]);
  }, [onLogout]);

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
      const legalUrl = LEGAL_LINKS[row.key];
      if (legalUrl) {
        void openTrustedUrl(legalUrl);
      }
    },
    [
      onOpenOrders,
      onOpenFavourites,
      onOpenSellWithUs,
      onOpenDetails,
      onOpenAddresses,
      onOpenAppearance,
      onOpenLanguage,
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
            <ChevronLeft size={ms(26)} color={palette.text} strokeWidth={2.2} />
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
          onPress={() => onOpenRewards?.()}
          disabled={!onOpenRewards}
          accessibilityRole="button"
          accessibilityLabel="Open FaazioCoins"
          accessibilityState={{ disabled: !onOpenRewards }}
        >
          <View style={styles.coinsHeader}>
            <View style={styles.coinsTitleRow}>
              <View style={styles.coinsIcon}>
                <Coins size={ms(16)} color={palette.coinText} strokeWidth={2.2} />
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
                    color={filled ? palette.flame : palette.flameInactive}
                    strokeWidth={2.2}
                    fill={filled ? palette.flame : 'none'}
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
        {navLoading && accountNavGroups.length === 0 ? (
          <View style={styles.navState}>
            <ActivityIndicator color={palette.accent} />
            <AppText style={styles.navStateText}>Loading account settings…</AppText>
          </View>
        ) : navError && accountNavGroups.length === 0 ? (
          <View style={styles.navState}>
            <AppText style={styles.navStateTitle}>Couldn't load account settings</AppText>
            <AppText style={styles.navStateText}>
              Check your connection and try again.
            </AppText>
            <TouchableOpacity
              style={styles.navRetryBtn}
              onPress={retryNav}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Retry loading account settings"
            >
              <AppText style={styles.navRetryText}>Try again</AppText>
            </TouchableOpacity>
          </View>
        ) : null}
        {!navLoading && !navError && visibleGroups.length === 0 ? (
          <View style={styles.navState}>
            <AppText style={styles.navStateTitle}>No account options available</AppText>
            <AppText style={styles.navStateText}>Your account menu could not be loaded.</AppText>
            <TouchableOpacity
              style={styles.navRetryBtn}
              onPress={retryNav}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Retry loading account settings"
            >
              <AppText style={styles.navRetryText}>Try again</AppText>
            </TouchableOpacity>
          </View>
        ) : null}
        {visibleGroups.map((group: AccountNavGroup) => (
          <View key={group.key} style={styles.navGroup}>
            {group.title ? (
              <AppText style={styles.navGroupTitle}>{group.title}</AppText>
            ) : null}
            <View style={styles.navCard}>
              {group.rows.map((row, i) => {
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
                      <Icon size={ms(18)} color={palette.accent} strokeWidth={2.2} />
                    </View>
                    <View style={styles.navText}>
                      <AppText style={styles.navTitle}>{row.title}</AppText>
                      <AppText style={styles.navSubtitle}>{row.subtitle}</AppText>
                    </View>
                    <ChevronRight size={ms(18)} color={palette.accent} strokeWidth={2.2} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Client-side preferences section. The server nav catalog is untouched. */}
        <View style={styles.navGroup}>
          <AppText style={styles.navGroupTitle}>Preferences</AppText>
          <View style={styles.navCard}>
            <TouchableOpacity
              style={styles.navRow}
              activeOpacity={0.7}
              onPress={onOpenAppearance}
              disabled={!onOpenAppearance}
              accessibilityRole="button"
              accessibilityLabel={`Appearance. ${appearanceLabel}`}
            >
              <View style={styles.navIconBox}>
                <Palette size={ms(18)} color={palette.accent} strokeWidth={2.2} />
              </View>
              <View style={styles.navText}>
                <AppText style={styles.navTitle}>Appearance</AppText>
                <AppText style={styles.navSubtitle}>{appearanceLabel}</AppText>
              </View>
              <ChevronRight size={ms(18)} color={palette.accent} strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navRow, styles.navRowLast]}
              activeOpacity={0.7}
              onPress={onOpenLanguage}
              disabled={!onOpenLanguage}
              accessibilityRole="button"
              accessibilityLabel={`Language. ${languageLabel(language)}`}
            >
              <View style={styles.navIconBox}>
                <Languages size={ms(18)} color={palette.accent} strokeWidth={2.2} />
              </View>
              <View style={styles.navText}>
                <AppText style={styles.navTitle}>Language</AppText>
                <AppText style={styles.navSubtitle}>{languageLabel(language)}</AppText>
              </View>
              <ChevronRight size={ms(18)} color={palette.accent} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 7. Partner admin console (role-gated, not data-driven — gate mirrors seller-review routes). */}
        {isPartnerAdmin(authUser) && onOpenSellerRequests ? (
          <TouchableOpacity style={styles.adminCard} activeOpacity={0.7} onPress={onOpenSellerRequests}>
            <View style={styles.adminIcon}>
              <Store size={ms(18)} color={palette.accent} strokeWidth={2.2} />
            </View>
            <View style={styles.adminText}>
              <AppText style={styles.adminTitle}>Seller applications</AppText>
              <AppText style={styles.adminSubtitle}>
                {authUser?.role === 'SUPER_ADMIN'
                  ? 'Review every seller in the platform'
                  : 'Review sellers in your district'}
              </AppText>
            </View>
            <ChevronRight size={ms(18)} color={palette.accent} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}

        {isPartnerAdmin(authUser) && onOpenFeeChangeRequests ? (
          <TouchableOpacity
            style={styles.adminCard}
            activeOpacity={0.7}
            onPress={onOpenFeeChangeRequests}
          >
            <View style={styles.adminIcon}>
              <Percent size={ms(18)} color={palette.accent} strokeWidth={2.2} />
            </View>
            <View style={styles.adminText}>
              <AppText style={styles.adminTitle}>Fee change requests</AppText>
              <AppText style={styles.adminSubtitle}>
                {authUser?.role === 'SUPER_ADMIN'
                  ? 'Review platform-fee requests from every district'
                  : 'Review platform-fee requests in your district'}
              </AppText>
            </View>
            <ChevronRight size={ms(18)} color={palette.accent} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}

        {authUser?.role === 'SELLER' && authUser.sellerId && onOpenPlatformFeeRequest ? (
          <TouchableOpacity
            style={styles.adminCard}
            activeOpacity={0.7}
            onPress={onOpenPlatformFeeRequest}
          >
            <View style={styles.adminIcon}>
              <Percent size={ms(18)} color={palette.accent} strokeWidth={2.2} />
            </View>
            <View style={styles.adminText}>
              <AppText style={styles.adminTitle}>Request a fee change</AppText>
              <AppText style={styles.adminSubtitle}>Ask an admin to update your platform fee</AppText>
            </View>
            <ChevronRight size={ms(18)} color={palette.accent} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}

        {/* 8. Logout */}
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
          <LogOut size={ms(18)} color="#ffffff" strokeWidth={1.75} />
          <AppText style={styles.logoutText}>Log out</AppText>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: AppPalette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.canvas,
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
    backgroundColor: palette.card,
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
    color: palette.text,
  },
  coinsCard: {
    backgroundColor: palette.card,
    borderRadius: ms(18),
    borderWidth: 1,
    borderColor: palette.border,
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
    backgroundColor: palette.coinSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(8),
  },
  coinsTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: palette.text,
  },
  coinsBalanceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  coinsBalance: {
    fontSize: ms(18),
    fontWeight: '900',
    color: palette.coinText,
  },
  coinsBalanceUnit: {
    fontSize: ms(10),
    fontWeight: '700',
    color: palette.textSubtle,
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
    color: palette.textMuted,
    fontWeight: '600',
    marginTop: SPACE.BLOCK,
    textAlign: 'center',
  },
  navCard: {
    backgroundColor: palette.card,
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
  navState: {
    alignItems: 'center',
    paddingVertical: SPACE.SECTION,
    paddingHorizontal: hs(16),
    gap: vs(8),
  },
  navStateTitle: {
    fontSize: ms(14),
    fontWeight: '600',
    color: palette.text,
    textAlign: 'center',
  },
  navStateText: {
    fontSize: ms(12),
    color: palette.textMuted,
    textAlign: 'center',
  },
  navRetryBtn: {
    minHeight: 44,
    marginTop: vs(4),
    paddingHorizontal: hs(20),
    borderRadius: ms(22),
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRetryText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: palette.accent,
  },
  navGroupTitle: {
    fontSize: ms(12),
    fontWeight: '800',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: hs(4),
    marginBottom: SPACE.BLOCK,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(14),
    paddingHorizontal: hs(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  navRowLast: {
    borderBottomWidth: 0,
  },
  navIconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: palette.accentSoft,
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
    color: palette.text,
  },
  navSubtitle: {
    fontSize: ms(11.5),
    fontWeight: '500',
    color: palette.textSubtle,
    marginTop: vs(2),
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    backgroundColor: palette.card,
    borderRadius: ms(16),
    padding: hs(14),
    marginBottom: SPACE.SECTION,
    borderWidth: 1,
    borderColor: palette.border,
  },
  adminIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminText: { flex: 1 },
  adminTitle: { fontSize: ms(14), fontWeight: '800', color: '#0f172a' },
  adminSubtitle: { fontSize: ms(11.5), fontWeight: '500', color: palette.textSubtle, marginTop: vs(2) },
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
