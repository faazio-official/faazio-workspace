import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  ChevronLeft,
  User,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  IdCard,
  Globe,
  MapPin,
  Lock,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { UserProfile, UserDetailsData } from '@data/types';
import { gateway } from '@/services/api/GatewayClient';
import type { RootStackParamList } from '@/navigation/types';
import { semantic } from '@/theme/brandTokens';

type Props = NativeStackScreenProps<RootStackParamList, 'UserDetails'>;

const DETAIL_ICONS: Record<string, React.ComponentType<any>> = {
  user: User,
  mail: Mail,
  phone: Phone,
  calendar: Calendar,
  gender: IdCard,
  globe: Globe,
  'map-pin': MapPin,
  bell: Bell,
  lock: Lock,
};

interface InfoRowProps {
  icon: React.ComponentType<any>;
  title: string;
  subtitle: string;
  showDivider?: boolean;
}

function InfoRow({ icon: Icon, title, subtitle, showDivider = true }: InfoRowProps) {
  return (
    <View>
      <View style={styles.rowContainer}>
        <View style={styles.rowIconBox}>
          <Icon size={ms(17)} color="#16A34A" strokeWidth={2.2} />
        </View>
        <View style={styles.rowTextContainer}>
          <AppText style={styles.rowTitle}>{title}</AppText>
          <AppText style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</AppText>
        </View>
      </View>
      {showDivider && <View style={styles.divider} />}
    </View>
  );
}

export function UserDetailsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  // Honest empty state — the durable profile/details come from the gateway only. No @data fixture is
  // ever substituted on a failed/empty read, so real users never see seeds rendered as their account.
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [details, setDetails] = useState<UserDetailsData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  // Hydrate the durable profile + details; on error render an honest "unavailable" shell.
  useEffect(() => {
    let alive = true;
    Promise.all([gateway.getProfile(), gateway.getDetails()])
      .then(([p, d]) => {
        if (!alive) return;
        if (p) setProfile(p);
        if (d) setDetails(d);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + vs(12) }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 1. Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Go back">
              <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
            </TouchableOpacity>
            <AppText style={styles.headerTitle}>My Profile</AppText>
          </View>
        </View>

        {/* 2. Main Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarContainer}>
                <User size={ms(28)} color={semantic.success} strokeWidth={2.2} />
              </View>
            </View>
            <View style={styles.profileInfo}>
              <AppText style={styles.profileName}>{profile ? profile.name : ''}</AppText>
              {profile ? (
                <>
                  <AppText style={styles.profileEmail} numberOfLines={1}>{profile.email}</AppText>
                  <AppText style={styles.profilePhone}>{profile.phone}</AppText>
                </>
              ) : (
                <AppText style={styles.profileUnavailable}>
                  {loadFailed ? 'Your profile could not be loaded. Please try again later.' : 'Loading profile…'}
                </AppText>
              )}
            </View>
          </View>
        </View>

        {/* 3. Personal Information */}
        {details ? (
          <>
            <AppText style={styles.sectionTitle}>Personal Information</AppText>
            <View style={styles.listCard}>
              {details.personalInfo.map((row, i) => (
                <InfoRow
                  key={row.title}
                  icon={DETAIL_ICONS[row.icon] ?? User}
                  title={row.title}
                  subtitle={row.subtitle}
                  showDivider={i < details.personalInfo.length - 1}
                />
              ))}
            </View>

            {/* 4. Account Preferences */}
            <AppText style={styles.sectionTitle}>Account Preferences</AppText>
            <View style={styles.listCard}>
              {details.preferences.map((row, i) => (
                <InfoRow
                  key={row.title}
                  icon={DETAIL_ICONS[row.icon] ?? User}
                  title={row.title}
                  subtitle={row.subtitle}
                  showDivider={i < details.preferences.length - 1}
                />
              ))}
            </View>

            {/* 5. Security Banner */}
            <View style={styles.securityBanner}>
              <View style={styles.securityIconBox}>
                <ShieldCheck size={ms(26)} color="#16A34A" strokeWidth={2.2} />
              </View>
              <View style={styles.securityTextContainer}>
                <AppText style={styles.securityTitle}>{details.securityTitle}</AppText>
                <AppText style={styles.securitySubtitle}>{details.securitySubtitle}</AppText>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACE.BLOCK,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: hs(8),
    padding: hs(2),
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: '800',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  headerIconBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  notifBadge: {
    position: 'absolute',
    top: vs(-3),
    right: hs(-3),
    minWidth: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(4),
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: ms(9),
    fontWeight: '900',
  },

  /* Profile Card */
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    marginBottom: SPACE.SECTION,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: hs(16),
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: hs(16),
  },
  avatarContainer: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginRight: hs(8),
  },
  profileName: {
    fontSize: ms(16),
    fontWeight: '800',
    color: '#111827',
    marginBottom: vs(4),
  },
  profileEmail: {
    fontSize: ms(13),
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: vs(2),
  },
  profilePhone: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#16A34A',
  },
  profileUnavailable: {
    fontSize: ms(13),
    fontWeight: '500',
    color: '#94A3B8',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: hs(16),
  },
  accountIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: hs(16),
  },
  accountIdLabel: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#4B5563',
  },
  accountIdRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountIdValue: {
    fontSize: ms(13),
    fontWeight: '600',
    color: '#4B5563',
    marginRight: hs(10),
    letterSpacing: 0.5,
  },
  copyBtn: {
    padding: hs(2),
  },

  /* Sections */
  sectionTitle: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#111827',
    marginBottom: SPACE.BLOCK,
    marginLeft: hs(4),
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(16),
    paddingVertical: vs(4),
    marginBottom: SPACE.SECTION,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },

  /* Info Row */
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(14),
    paddingHorizontal: hs(16),
  },
  rowIconBox: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(8),
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(14),
  },
  rowTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#111827',
    marginBottom: vs(2),
  },
  rowSubtitle: {
    fontSize: ms(12),
    fontWeight: '500',
    color: '#6B7280',
    paddingRight: hs(16),
    lineHeight: vs(17),
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: hs(66),
  },

  /* Security Banner */
  securityBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: hs(16),
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityIconBox: {
    marginRight: hs(12),
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitle: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#166534',
    marginBottom: vs(2),
  },
  securitySubtitle: {
    fontSize: ms(11),
    fontWeight: '500',
    color: '#4B5563',
    lineHeight: vs(16),
  },
});
