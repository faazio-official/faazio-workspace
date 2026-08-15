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
  Crown,
  User,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  LogOut,
  IdCard,
  MapPin,
  CreditCard,
  Ticket,
  Headphones,
  Heart,
  Clock,
} from 'lucide-react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { logoutUser } from '@/services/logout';
import { userProfile, saverMembership, orderStatusCounts, accountNavGroups } from '@data/index';
import type { AccountNavRow } from '@data/types';
import type { MyOrdersTab } from '@data/types';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Account'>,
  NativeStackScreenProps<RootStackParamList>
>;

const NAV_ICONS: Record<string, React.ComponentType<any>> = {
  idcard: IdCard,
  'map-pin': MapPin,
  'credit-card': CreditCard,
  ticket: Ticket,
  headphones: Headphones,
  heart: Heart,
  clock: Clock,
};

const STATUS_ICONS: Record<string, React.ComponentType<any>> = {
  all: Package,
  processing: Truck,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
};

const ROYAL_PURPLE = '#7C3AED';

const STATUS_TINTS: Record<string, string> = {
  all: ROYAL_PURPLE,
  processing: ROYAL_PURPLE,
  shipped: ROYAL_PURPLE,
  delivered: ROYAL_PURPLE,
  cancelled: ROYAL_PURPLE,
};

export function AccountScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const handleLogout = useCallback(() => {
    logoutUser();
    (navigation.getParent() as NativeStackNavigationProp<RootStackParamList>)?.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [navigation]);

  const handleRowPress = useCallback((row: AccountNavRow) => {
    if (row.key === 'details') {
      navigation.navigate('UserDetails');
      return;
    }
    if (row.key === 'addresses') {
      navigation.navigate('SavedAddresses');
      return;
    }
    // TODO: Destination screens per row — stubs for now.
  }, [navigation]);

  const handleViewAllOrders = useCallback(() => {
    navigation.navigate('MyOrders', {});
  }, [navigation]);

  const handleOrderStatusPress = useCallback((label: string) => {
    navigation.navigate('MyOrders', { initialTab: label as MyOrdersTab });
  }, [navigation]);

  const handleViewBenefits = useCallback(() => {
    // TODO: Saver benefits screen — no-op placeholder.
  }, []);

  return (
    <View style={styles.container}>
      {/* Fixed top bar (My Account) — stays pinned while content scrolls. */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top + vs(12) }]}>
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
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.85} onPress={() => handleRowPress({ key: 'details', icon: 'idcard', title: userProfile.name, subtitle: '' })}>
          <View style={styles.avatar}>
            <User size={ms(30)} color={ROYAL_PURPLE} strokeWidth={2.2} />
          </View>
          <View style={styles.profileInfo}>
            <AppText style={styles.profileName}>{userProfile.name}</AppText>
            <AppText style={styles.profileMeta} numberOfLines={1}>{userProfile.email}</AppText>
            <AppText style={styles.profileMeta}>{userProfile.phone}</AppText>
          </View>
          <ChevronRight size={ms(20)} color={ROYAL_PURPLE} strokeWidth={2.2} />
        </TouchableOpacity>

        {/* 3. Saver Banner */}
        <TouchableOpacity style={styles.saverBanner} activeOpacity={0.85} onPress={handleViewBenefits}>
          <View style={styles.saverIcon}>
            <Crown size={ms(18)} color="#F59E0B" strokeWidth={2.2} />
          </View>
          <View style={styles.saverBody}>
            <AppText style={styles.saverTitle}>{saverMembership.title}</AppText>
            <AppText style={styles.saverSub}>
              {saverMembership.savedLabel} ₹{saverMembership.savedAmount.toLocaleString('en-IN')} so far
            </AppText>
          </View>
          <TouchableOpacity onPress={handleViewBenefits} style={styles.saverLink} activeOpacity={0.7}>
            <AppText style={styles.saverLinkText}>View Benefits</AppText>
            <ChevronRight size={ms(14)} color="#10B981" strokeWidth={2.4} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* 4. My Orders */}
        <View style={styles.sectionHeader}>
          <AppText style={styles.sectionTitle}>My Orders</AppText>
          <TouchableOpacity onPress={handleViewAllOrders} style={styles.sectionLinkWrap} activeOpacity={0.7}>
            <AppText style={styles.sectionLink}>View All Orders</AppText>
            <ChevronRight size={ms(14)} color={ROYAL_PURPLE} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusGrid}>
          {orderStatusCounts.map((s) => {
            const Icon = STATUS_ICONS[s.key] ?? Package;
            const tint = STATUS_TINTS[s.key] ?? '#64748b';
            return (
              <TouchableOpacity key={s.key} style={styles.statusItem} activeOpacity={0.7} onPress={() => handleOrderStatusPress(s.label)}>
                <View style={[styles.statusIconBox, { backgroundColor: `${tint}1A` }]}>
                  <Icon size={ms(20)} color={tint} strokeWidth={2.2} />
                </View>
                <AppText style={styles.statusCount}>{s.count}</AppText>
                <AppText style={styles.statusLabel} numberOfLines={2}>{s.label}</AppText>
              </TouchableOpacity>
            );
          })}
        </View>

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
                    <Icon size={ms(18)} color={ROYAL_PURPLE} strokeWidth={2.2} />
                  </View>
                  <View style={styles.navText}>
                    <AppText style={styles.navTitle}>{row.title}</AppText>
                    <AppText style={styles.navSubtitle}>{row.subtitle}</AppText>
                  </View>
                  <ChevronRight size={ms(18)} color={ROYAL_PURPLE} strokeWidth={2.2} />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* 7. Logout */}
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
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
    backgroundColor: '#EDE9FE',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: vs(12),
    paddingHorizontal: hs(2),
  },
  sectionTitle: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLink: {
    fontSize: ms(12),
    fontWeight: '700',
    color: ROYAL_PURPLE,
  },
  statusGrid: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: ms(16),
    paddingVertical: vs(16),
    marginBottom: vs(22),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
    gap: vs(6),
    paddingHorizontal: hs(2),
  },
  statusIconBox: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCount: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#0f172a',
  },
  statusLabel: {
    fontSize: ms(10),
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: vs(13),
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
    backgroundColor: '#EDE9FE',
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
