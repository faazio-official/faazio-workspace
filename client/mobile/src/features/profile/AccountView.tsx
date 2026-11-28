import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
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
  Pencil,
  Receipt,
  Store,
  Percent,
  Trash2,
  ShieldCheck,
  Languages,
  Bell,
  LogIn,
} from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { neutral } from '@/theme/brandTokens';
import { hero } from '@/theme/heroTokens';
import { useLanguageStore } from '@/state/languageStore';
import { languageLabel } from '@/lib/languages';
import { useAccountNav } from '@/features/profile/useAccountNav';
import type { AccountNavGroup, AccountNavRow } from '@data/types';
import { useRewardsStore } from '@/state/rewardsStore';
import { STREAK_MILESTONES, STREAK_TARGET_DAYS } from '@data/rewards/rewards';
import { nextStreakPercent, unlockedStreakPercent } from '@/features/rewards/rewardsLogic';

import { isPartnerAdmin, useAuthStore } from '@/state/authStore';
import { openTrustedUrl } from '@/lib/externalLinks';
import { COOKIES_URL, DISCLAIMER_URL, PRIVACY_URL, REFUNDS_URL, TERMS_URL } from '@/lib/site';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useNavBarScrollHandler } from '@/hooks/useAutoHideNavBar';
import { useNotificationsStore } from '@/state/notificationsStore';
import { runAuthGate } from '@/services/authGate';
import type { AppPalette } from '@/theme/theme';
import heroBackgroundImg from '@/assets/account_hero_background.webp';
import streakTicketImg from '@/assets/account_streak_ticket.png';

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

/** Identity name is single-line: cap it so a long account name never crowds the Edit pill. */
const MAX_NAME_CHARS = 22;

function clampName(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > MAX_NAME_CHARS
    ? `${trimmed.slice(0, MAX_NAME_CHARS - 1).trimEnd()}…`
    : trimmed;
}

export interface AccountViewProps {
  /** When provided, a back arrow is rendered in the fixed header (pushed mode). */
  onBack?: () => void;
  onOpenDetails: () => void;
  onOpenAddresses: () => void;
  onOpenDeleteAccount?: () => void;
  onOpenRequestDataDeletion?: () => void;
  onOpenOrders: () => void;
  onOpenNotifications?: () => void;
  onOpenFavourites?: () => void;
  onOpenRewards?: () => void;
  /** Hero "Order now" CTA — sends the customer back to the shopping surface. */
  onStartOrder?: () => void;
  onOpenLanguage?: () => void;
  onOpenSellWithUs?: () => void;
  onOpenSellerRequests?: () => void;
  onOpenFeeChangeRequests?: () => void;
  onOpenPlatformFeeRequest?: () => void;
  /** Guest mode: opens the root Login screen; no account rows are rendered. */
  onSignIn: () => void;
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
  onOpenNotifications,
  onOpenFavourites,
  onOpenRewards,
  onStartOrder,
  onOpenLanguage,
  onOpenSellWithUs,
  onOpenSellerRequests,
  onOpenFeeChangeRequests,
  onOpenPlatformFeeRequest,
  onSignIn,
  onLogout,
}: AccountViewProps) {
  const insets = useSafeAreaInsets();
  const { palette } = useThemeMode();
  const language = useLanguageStore((s) => s.language);
  const onScroll = useNavBarScrollHandler();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const coinBalance = useRewardsStore((s) => s.coinBalance);
  const streakCount = useRewardsStore((s) => s.streakCount);
  const unread = useNotificationsStore((s) => s.unread);
  const authUser = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Nav groups: server-authoritative (DB catalog + per-user overrides). Groups with no real rows are
  // omitted so a stale/empty projection can never render as a blank titled card.
  const {
    groups: accountNavGroups,
    loading: navLoading,
    error: navError,
    retry: retryNav,
  } = useAccountNav();
  const visibleGroups = accountNavGroups.filter((group) => group.rows.length > 0);

  const displayName = clampName(authUser?.name ?? '') || 'Your account';
  const contactLine =
    (authUser?.phone ?? '').trim() || (authUser?.email ?? '').trim() || 'Signed in';
  const avatarInitial = (displayName.match(/[a-z0-9]/i)?.[0] ?? 'F').toUpperCase();
  const streakDays = Math.min(streakCount, STREAK_TARGET_DAYS);
  // The card headline shows what the streak is worth now, or the next milestone it is climbing to.
  const headlinePercent = unlockedStreakPercent(streakDays) || nextStreakPercent(streakDays);

  const handleLogout = useCallback(() => {
    Alert.alert('Log out?', 'You will be signed out. You can keep browsing as a guest.', [
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
          onOpenLanguage,
      onOpenDeleteAccount,
      onOpenRequestDataDeletion,
    ]
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Hero band: burgundy artwork backdrop, identity block and streak card. */}
        <ImageBackground
          source={heroBackgroundImg}
          style={[styles.hero, { paddingTop: insets.top + vs(8) }]}
          imageStyle={styles.heroImage}
          resizeMode="cover"
        >
          <View style={styles.heroTopRow}>
            {onBack ? (
              <TouchableOpacity
                onPress={onBack}
                style={styles.heroIconButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <ChevronLeft size={ms(25)} color={hero.onHero} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : (
              <View style={styles.heroIconButton} />
            )}
            <View style={styles.heroTopSpacer} />
            {isAuthenticated && onOpenNotifications ? (
              <TouchableOpacity
                onPress={onOpenNotifications}
                style={styles.heroIconButton}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              >
                <Bell size={ms(21)} color={hero.onHero} strokeWidth={2.2} />
                {unread > 0 ? (
                  <View style={styles.bellBadge}>
                    <AppText style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</AppText>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>
          {isAuthenticated ? (
            <>
              <View style={styles.identityRow}>
                <View style={styles.avatar}>
                  <AppText style={styles.avatarText}>{avatarInitial}</AppText>
                </View>
                <View style={styles.identityText}>
                  <AppText
                    style={styles.identityName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    accessibilityRole="header"
                  >
                    {displayName}
                  </AppText>
                  <AppText style={styles.identityMeta} numberOfLines={1}>
                    {contactLine}
                  </AppText>
                </View>
                <TouchableOpacity
                  onPress={onOpenDetails}
                  style={styles.editPill}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Pencil size={ms(12)} color={neutral.ink} strokeWidth={2.4} />
                  <AppText style={styles.editPillText}>Edit</AppText>
                </TouchableOpacity>
              </View>

              {/* Discount-streak card: gold ticket art, streak flames, reward + CTA. */}
              <View style={styles.streakCard}>
                <Image
                  source={streakTicketImg}
                  style={styles.streakTicket}
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                />
                <View style={styles.streakDivider} />
                <View style={styles.streakBody}>
                  <View style={styles.streakTitleRow}>
                    <AppText style={styles.streakTitle} numberOfLines={1}>
                      Discount streak
                    </AppText>
                    <TouchableOpacity
                      onPress={() => onOpenRewards?.()}
                      disabled={!onOpenRewards}
                      style={styles.coinsChip}
                      accessibilityRole="button"
                      accessibilityLabel={`${coinBalance} FaazioCoins. Open rewards`}
                      accessibilityState={{ disabled: !onOpenRewards }}
                      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                    >
                      <Coins size={ms(12)} color={hero.gold} strokeWidth={2.4} />
                      <AppText style={styles.coinsChipText}>
                        {coinBalance.toLocaleString('en-IN')}
                      </AppText>
                      <ChevronRight size={ms(12)} color={hero.gold} strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.streakFlameRow}>
                    {Array.from({ length: STREAK_TARGET_DAYS }).map((_, i) => {
                      const day = i + 1;
                      const filled = i < streakDays;
                      const milestone = STREAK_MILESTONES.find((m) => m.day === day);
                      return (
                        <View key={day} style={styles.streakFlameSlot}>
                          <Flame
                            size={ms(20)}
                            color={filled ? hero.gold : hero.goldMuted}
                            strokeWidth={2.1}
                            fill={filled ? hero.gold : 'none'}
                          />
                          <AppText
                            style={[
                              styles.streakFlamePct,
                              filled && styles.streakFlamePctReached,
                            ]}
                          >
                            {milestone ? `${milestone.percent}%` : ' '}
                          </AppText>
                        </View>
                      );
                    })}
                    <AppText style={styles.streakCounter}>
                      {streakDays}/{STREAK_TARGET_DAYS}
                    </AppText>
                  </View>

                  <View style={styles.streakFooter}>
                    <AppText style={styles.streakReward}>{headlinePercent}% off</AppText>
                    <TouchableOpacity
                      onPress={() => (onStartOrder ? onStartOrder() : onOpenRewards?.())}
                      style={styles.orderPill}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`Order now — ${streakDays} of ${STREAK_TARGET_DAYS} days towards your ${headlinePercent}% discount`}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    >
                      <AppText style={styles.orderPillText}>Order now</AppText>
                      <ChevronRight size={ms(13)} color={hero.ink} strokeWidth={2.8} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </ImageBackground>

        <View style={styles.body}>
        {isAuthenticated ? (
          <>
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
          </>
        ) : (
          <>
            <View style={styles.guestCard}>
              <View style={styles.guestIconCircle}>
                <LogIn size={ms(22)} color={palette.accent} strokeWidth={2} />
              </View>
              <AppText style={styles.guestTitle}>Sign in to Faazio</AppText>
              <AppText style={styles.guestBody}>
                Track orders, save favourites and earn FaazioCoins.
              </AppText>
              <TouchableOpacity
                style={styles.guestSignInBtn}
                onPress={onSignIn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
              >
                <AppText style={styles.guestSignInText}>Sign in</AppText>
              </TouchableOpacity>
            </View>

            {/* Account-bound rows stay visible so the tap opens Login (and resumes the action),
                instead of hiding the feature entirely. Same rows the signed-in page shows. */}
            <View style={styles.navGroup}>
              <AppText style={styles.navGroupTitle}>Your activity</AppText>
              <View style={styles.navCard}>
                <TouchableOpacity
                  style={styles.navRow}
                  activeOpacity={0.7}
                  onPress={() => runAuthGate(onOpenOrders)}
                  accessibilityRole="button"
                  accessibilityLabel="Orders, sign in required"
                >
                  <View style={styles.navIconBox}>
                    <Package size={ms(18)} color={palette.accent} strokeWidth={2.2} />
                  </View>
                  <View style={styles.navText}>
                    <AppText style={styles.navTitle}>Orders</AppText>
                    <AppText style={styles.navSubtitle}>Track current and past orders</AppText>
                  </View>
                  <ChevronRight size={ms(18)} color={palette.accent} strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navRow}
                  activeOpacity={0.7}
                  onPress={() =>
                    onOpenFavourites
                      ? runAuthGate(onOpenFavourites)
                      : runAuthGate()
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Favourites, sign in required"
                >
                  <View style={styles.navIconBox}>
                    <Heart size={ms(18)} color={palette.accent} strokeWidth={2.2} />
                  </View>
                  <View style={styles.navText}>
                    <AppText style={styles.navTitle}>Favourites</AppText>
                    <AppText style={styles.navSubtitle}>Your saved products</AppText>
                  </View>
                  <ChevronRight size={ms(18)} color={palette.accent} strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.navRow, styles.navRowLast]}
                  activeOpacity={0.7}
                  onPress={() =>
                    onOpenRewards ? runAuthGate(onOpenRewards) : runAuthGate()
                  }
                  accessibilityRole="button"
                  accessibilityLabel="FaazioCoins, sign in required"
                >
                  <View style={styles.navIconBox}>
                    <Coins size={ms(18)} color={palette.accent} strokeWidth={2.2} />
                  </View>
                  <View style={styles.navText}>
                    <AppText style={styles.navTitle}>FaazioCoins</AppText>
                    <AppText style={styles.navSubtitle}>Coins, streak and rewards</AppText>
                  </View>
                  <ChevronRight size={ms(18)} color={palette.accent} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Client-side preferences section. The server nav catalog is untouched. */}
        <View style={styles.navGroup}>
          <AppText style={styles.navGroupTitle}>Preferences</AppText>
          <View style={styles.navCard}>
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

        {/* 8. Logout — signed-in users only. */}
        {isAuthenticated ? (
          <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
            <LogOut size={ms(18)} color="#ffffff" strokeWidth={1.75} />
            <AppText style={styles.logoutText}>Log out</AppText>
          </TouchableOpacity>
        ) : null}
        </View>
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
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  body: {
    paddingTop: SPACE.SECTION,
    paddingHorizontal: hs(16),
  },
  hero: {
    paddingBottom: vs(20),
    backgroundColor: hero.canvas,
    borderBottomLeftRadius: ms(26),
    borderBottomRightRadius: ms(26),
    overflow: 'hidden',
  },
  heroImage: {
    borderBottomLeftRadius: ms(26),
    borderBottomRightRadius: ms(26),
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(10),
  },
  heroIconButton: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTopSpacer: {
    flex: 1,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ms(30),
    paddingHorizontal: hs(12),
    borderRadius: ms(15),
    backgroundColor: neutral.card,
    marginLeft: hs(12),
  },
  editPillText: {
    fontSize: ms(12),
    fontWeight: '800',
    color: neutral.ink,
    marginLeft: hs(5),
  },
  bellBadge: {
    position: 'absolute',
    top: vs(4),
    right: hs(4),
    minWidth: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    paddingHorizontal: hs(3),
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontSize: ms(11),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingTop: vs(14),
  },
  avatar: {
    width: ms(46),
    height: ms(46),
    borderRadius: ms(23),
    borderWidth: 1.5,
    borderColor: hero.gold,
    backgroundColor: hero.goldWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: ms(18),
    fontWeight: '800',
    color: hero.gold,
  },
  identityText: {
    flex: 1,
    marginLeft: hs(12),
    marginRight: hs(12),
  },
  identityName: {
    flexShrink: 1,
    fontSize: ms(17),
    fontWeight: '800',
    color: hero.onHero,
  },
  identityMeta: {
    fontSize: ms(12),
    fontWeight: '600',
    color: hero.onHeroMuted,
    marginTop: vs(2),
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(16),
    marginHorizontal: hs(16),
    paddingVertical: vs(10),
    paddingHorizontal: hs(10),
    borderRadius: ms(18),
    borderWidth: 1.5,
    borderColor: hero.gold,
    backgroundColor: hero.cardWash,
    shadowColor: hero.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  streakTicket: {
    width: ms(66),
    height: ms(60),
  },
  streakDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: vs(6),
    marginHorizontal: hs(9),
    backgroundColor: hero.goldMuted,
  },
  streakBody: {
    flex: 1,
  },
  streakTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakTitle: {
    flex: 1,
    fontSize: ms(11),
    fontWeight: '800',
    letterSpacing: 0.3,
    color: hero.gold,
    textTransform: 'uppercase',
  },
  coinsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: hs(6),
  },
  coinsChipText: {
    fontSize: ms(11),
    fontWeight: '800',
    color: hero.gold,
    marginHorizontal: hs(3),
  },
  streakFlameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: vs(6),
  },
  streakFlameSlot: {
    alignItems: 'center',
    marginRight: hs(3),
  },
  streakFlamePct: {
    fontSize: ms(7.5),
    fontWeight: '800',
    lineHeight: ms(10),
    color: hero.goldMuted,
  },
  streakFlamePctReached: {
    color: hero.gold,
  },
  streakCounter: {
    fontSize: ms(11),
    fontWeight: '800',
    color: hero.onHero,
    marginLeft: hs(8),
    alignSelf: 'flex-start',
    marginTop: vs(3),
  },
  streakFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(8),
  },
  streakReward: {
    fontSize: ms(18),
    fontWeight: '900',
    color: hero.onHero,
    letterSpacing: 0.2,
  },
  orderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ms(32),
    paddingHorizontal: hs(12),
    borderRadius: ms(16),
    backgroundColor: hero.gold,
  },
  orderPillText: {
    fontSize: ms(12),
    fontWeight: '800',
    color: hero.ink,
    marginRight: hs(2),
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
  guestCard: {
    backgroundColor: palette.card,
    borderRadius: ms(18),
    borderWidth: 1,
    borderColor: palette.border,
    padding: hs(20),
    alignItems: 'center',
    marginBottom: SPACE.SECTION,
  },
  guestIconCircle: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(12),
  },
  guestTitle: {
    fontSize: ms(17),
    fontWeight: '600',
    color: palette.text,
    marginBottom: vs(4),
  },
  guestBody: {
    fontSize: ms(12),
    lineHeight: ms(17),
    fontWeight: '500',
    color: palette.textMuted,
    textAlign: 'center',
    maxWidth: hs(260),
  },
  guestSignInBtn: {
    minHeight: 46,
    minWidth: hs(180),
    borderRadius: ms(23),
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.SECTION,
  },
  guestSignInText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: palette.onAccent,
  },
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
