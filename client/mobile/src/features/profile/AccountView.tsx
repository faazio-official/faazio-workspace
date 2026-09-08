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
  Crown,
  User,
  Package,
  LogOut,
  IdCard,
  MapPin,
  CreditCard,
  Ticket,
  Headphones,
  Heart,
  Clock,
} from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { userProfile, saverMembership, accountNavGroups } from '@data/index';
import type { AccountNavRow } from '@data/types';

const NAV_ICONS: Record<string, React.ComponentType<any>> = {
  idcard: IdCard,
  'map-pin': MapPin,
  'credit-card': CreditCard,
  ticket: Ticket,
  headphones: Headphones,
  heart: Heart,
  clock: Clock,
  package: Package,
};

const BRAND_BLUE = '#1162D3';

export interface AccountViewProps {
  /** When provided, a back arrow is rendered in the fixed header (pushed mode). */
  onBack?: () => void;
  onOpenDetails: () => void;
  onOpenAddresses: () => void;
  onOpenOrders: () => void;
  onOpenSaverBenefits?: () => void;
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
  onOpenOrders,
  onOpenSaverBenefits,
  onLogout,
}: AccountViewProps) {
  const insets = useSafeAreaInsets();

  const handleRowPress = useCallback(
    (row: AccountNavRow) => {
      if (row.key === 'orders') {
        onOpenOrders();
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
      // TODO: Destination screens per row — stubs for now.
    },
    [onOpenOrders, onOpenDetails, onOpenAddresses]
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
        {/* 2. Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.85}
          onPress={() => handleRowPress({ key: 'details', icon: 'idcard', title: userProfile.name, subtitle: '' })}
        >
          <View style={styles.avatar}>
            <User size={ms(30)} color={BRAND_BLUE} strokeWidth={2.2} />
          </View>
          <View style={styles.profileInfo}>
            <AppText style={styles.profileName}>{userProfile.name}</AppText>
            <AppText style={styles.profileMeta} numberOfLines={1}>{userProfile.email}</AppText>
            <AppText style={styles.profileMeta}>{userProfile.phone}</AppText>
          </View>
          <ChevronRight size={ms(20)} color={BRAND_BLUE} strokeWidth={2.2} />
        </TouchableOpacity>

        {/* 3. Saver Banner */}
        <TouchableOpacity style={styles.saverBanner} activeOpacity={0.85} onPress={onOpenSaverBenefits}>
          <View style={styles.saverIcon}>
            <Crown size={ms(18)} color="#F59E0B" strokeWidth={2.2} />
          </View>
          <View style={styles.saverBody}>
            <AppText style={styles.saverTitle}>{saverMembership.title}</AppText>
            <AppText style={styles.saverSub}>
              {saverMembership.savedLabel} ₹{saverMembership.savedAmount.toLocaleString('en-IN')} so far
            </AppText>
          </View>
          <TouchableOpacity onPress={onOpenSaverBenefits} style={styles.saverLink} activeOpacity={0.7}>
            <AppText style={styles.saverLinkText}>View Benefits</AppText>
            <ChevronRight size={ms(14)} color="#10B981" strokeWidth={2.4} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* 5 + 6. Nav groups */}
        {accountNavGroups.map((group) => (
          <View key={group.key} style={styles.navCard}>
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
                    <Icon size={ms(18)} color={BRAND_BLUE} strokeWidth={2.2} />
                  </View>
                  <View style={styles.navText}>
                    <AppText style={styles.navTitle}>{row.title}</AppText>
                    <AppText style={styles.navSubtitle}>{row.subtitle}</AppText>
                  </View>
                  <ChevronRight size={ms(18)} color={BRAND_BLUE} strokeWidth={2.2} />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* 7. Logout */}
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
    paddingTop: vs(16),
    paddingHorizontal: hs(16),
    paddingBottom: vs(32),
  },
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: vs(16),
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    padding: hs(16),
    marginBottom: vs(14),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  avatar: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: hs(14),
    marginRight: hs(8),
  },
  profileName: {
    fontSize: ms(17),
    fontWeight: '800',
    color: '#0f172a',
  },
  profileMeta: {
    fontSize: ms(12.5),
    fontWeight: '500',
    color: '#64748b',
    marginTop: vs(3),
  },
  saverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8FBF3',
    borderRadius: ms(12),
    padding: hs(14),
    marginBottom: vs(22),
  },
  saverIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saverBody: {
    flex: 1,
    marginLeft: hs(12),
    marginRight: hs(8),
  },
  saverTitle: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#0f172a',
  },
  saverSub: {
    fontSize: ms(12),
    fontWeight: '600',
    color: '#10B981',
    marginTop: vs(2),
  },
  saverLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saverLinkText: {
    fontSize: ms(12),
    fontWeight: '800',
    color: '#10B981',
  },
  navCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    paddingHorizontal: hs(6),
    marginBottom: vs(16),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
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
