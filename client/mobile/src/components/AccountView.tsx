import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import {
  MapPin,
  Compass,
  Activity,
  LogOut,
  Truck,
} from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import EnterpriseIcon from './EnterpriseIcon';
import { pastOrders } from '@data/account/orders';

interface AccountViewProps {
  handleReset: () => void;
  setShowLocationRequestState: (val: boolean) => void;
  setIsLoggedIn: (val: boolean) => void;
  onScroll?: (offsetY: number) => void;
}

export default function AccountView({
  handleReset,
  setShowLocationRequestState,
  setIsLoggedIn,
  onScroll,
}: AccountViewProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.8, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
      onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}>
      
      {/* 1. User Profile Summary */}
      <View style={styles.profileCard}>
        <Animated.View style={[styles.avatarShadowWrap, { opacity: pulseAnim }]}>
          <View style={styles.avatarCircle}>
            <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
              <Defs>
                <LinearGradient id="avatarGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#3b82f6" />
                  <Stop offset="1" stopColor="#4f46e5" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" rx={ms(32)} fill="url(#avatarGrad)" />
            </Svg>
            <Text style={styles.avatarText}>FB</Text>
          </View>
        </Animated.View>
        <Text style={styles.profileName}>Faizal Basha</Text>
        <Text style={styles.profileSub}>Verified SuperApp Member</Text>

        <View style={styles.profileInfoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValue}>+91 98765 43210</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Email Address</Text>
            <Text style={styles.infoValue} numberOfLines={1}>faizalbashafaizalbasha07@gmail.com</Text>
          </View>
        </View>
      </View>

      {/* 2. Tracking & History Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Order Tracking & History</Text>
      </View>

      <View style={styles.activeDeliveryCard}>
        <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <LinearGradient id="activeDeliveryGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#2563eb" />
              <Stop offset="1" stopColor="#4f46e5" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={ms(12)} fill="url(#activeDeliveryGrad)" />
        </Svg>
        <View style={styles.activeDeliveryContent}>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active Delivery</Text>
          </View>
          <Text style={styles.activeOrderId}>Order #FA-882901</Text>
          <Text style={styles.activeOrderDesc}>Rider is picking up your fresh order basket</Text>
        </View>
        <Animated.View style={[styles.activeDeliveryIconCircle, { opacity: pulseAnim }]}>
          <Truck size={18} color="#ffffff" />
        </Animated.View>
      </View>

      <View style={styles.historyList}>
        {pastOrders.map((o, index) => (
          <View key={index} style={styles.historyCard}>
            <EnterpriseIcon emoji={o.app === 'FOOD' ? '🍲' : '🛍️'} variant="circle" size={ms(32)} bgColor={o.app === 'FOOD' ? 'rgba(236,253,245,0.95)' : 'rgba(239,246,255,0.95)'} />
            <View style={styles.historyInfo}>
              <View style={styles.historyRow1}>
                <Text style={styles.historyOrderId}>Order #{o.id}</Text>
                <View style={styles.historyStatusBadge}>
                  <Text style={styles.historyStatusText}>{o.status}</Text>
                </View>
              </View>
              <Text style={styles.historyItemName} numberOfLines={1}>{o.item}</Text>
              <Text style={styles.historyStoreDetails}>{o.store} • {o.date}</Text>
            </View>
            <Text style={styles.historyPrice}>{o.price}</Text>
          </View>
        ))}
      </View>

      {/* 3. Settings & Stats */}
      <View style={styles.settingsGroup}>
        <TouchableOpacity
          onPress={() => {
            setShowLocationRequestState(true);
            setIsLoggedIn(false);
          }}
          style={styles.settingRow}
          activeOpacity={0.8}
        >
          <View style={styles.settingRowLeft}>
            <MapPin size={ms(13)} color="#3b82f6" />
            <Text style={styles.settingRowLabel}>Primary Location Settings</Text>
          </View>
          <View style={styles.locationBadge}>
            <Text style={styles.locationBadgeText}>Mumbai, MH</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.settingRow}>
          <View style={styles.settingRowLeft}>
            <Compass size={ms(13)} color="#4f46e5" />
            <Text style={styles.settingRowLabel}>Notifications Enabled</Text>
          </View>
          <View style={styles.activeStateBadge}>
            <Text style={styles.activeStateBadgeText}>Active</Text>
          </View>
        </View>

        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingRowLeft}>
            <Activity size={ms(13)} color="#a855f7" />
            <Text style={styles.settingRowLabel}>Faazio App Version</Text>
          </View>
          <Text style={styles.versionValue}>v1.2.0-prod</Text>
        </View>
      </View>

      {/* 4. Log Out button */}
      <TouchableOpacity onPress={handleReset} style={styles.logoutBtn} activeOpacity={0.8}>
        <LogOut size={ms(12)} color="#e11d48" style={{ marginRight: hs(6) }} />
        <Text style={styles.logoutBtnText}>Log Out From Device</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(64),
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(16),
    alignItems: 'center',
    marginTop: vs(14),
    marginBottom: vs(16),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarShadowWrap: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    marginBottom: vs(10),
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarCircle: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: ms(20),
    fontWeight: '900',
  },
  profileName: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
  },
  profileSub: {
    fontSize: ms(9),
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: vs(2),
  },
  profileInfoGrid: {
    flexDirection: 'row',
    gap: hs(8),
    marginTop: vs(16),
    borderTopWidth: 0.5,
    borderTopColor: '#f1f5f9',
    paddingTop: vs(14),
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: ms(8),
    padding: hs(10),
  },
  infoLabel: {
    fontSize: ms(7),
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: ms(9),
    color: '#334155',
    fontWeight: '900',
    marginTop: vs(4),
  },
  sectionHeader: {
    marginBottom: vs(16),
    paddingHorizontal: hs(2),
  },
  sectionTitle: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeDeliveryCard: {
    borderRadius: ms(12),
    padding: hs(14),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: vs(16),
  },
  activeDeliveryContent: {
    flex: 1,
    marginRight: hs(10),
  },
  activeBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
    borderRadius: ms(4),
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    fontSize: ms(7),
    color: '#ffffff',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeOrderId: {
    fontSize: ms(12),
    fontWeight: '900',
    color: '#ffffff',
    marginTop: vs(4),
  },
  activeOrderDesc: {
    fontSize: ms(9),
    color: '#dbeafe',
    fontWeight: '600',
    marginTop: vs(2),
  },
  activeDeliveryIconCircle: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyList: {
    width: '100%',
    gap: vs(8),
    marginBottom: vs(16),
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(10),
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyInfo: {
    marginLeft: hs(10),
    flex: 1,
    marginRight: hs(10),
  },
  historyRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyOrderId: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '700',
  },
  historyStatusBadge: {
    backgroundColor: '#ecfdf5',
    paddingVertical: vs(1),
    paddingHorizontal: hs(6),
    borderRadius: ms(12),
  },
  historyStatusText: {
    fontSize: ms(8),
    color: '#059669',
    fontWeight: '900',
  },
  historyItemName: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#1e293b',
    marginTop: vs(2),
  },
  historyStoreDetails: {
    fontSize: ms(8),
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: vs(2),
  },
  historyPrice: {
    fontSize: ms(10),
    fontWeight: '900',
    color: '#1e293b',
  },
  settingsGroup: {
    backgroundColor: '#ffffff',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: hs(6),
    marginBottom: vs(16),
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: vs(10),
    paddingHorizontal: hs(10),
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
  },
  settingRowLabel: {
    fontSize: ms(10),
    fontWeight: '700',
    color: '#334155',
  },
  locationBadge: {
    backgroundColor: '#eff6ff',
    paddingVertical: vs(2),
    paddingHorizontal: hs(8),
    borderRadius: 999,
  },
  locationBadgeText: {
    fontSize: ms(8),
    color: '#2563eb',
    fontWeight: '900',
  },
  activeStateBadge: {
    backgroundColor: '#f0fdf4',
    paddingVertical: vs(2),
    paddingHorizontal: hs(6),
    borderRadius: 999,
  },
  activeStateBadgeText: {
    fontSize: ms(8),
    color: '#16a34a',
    fontWeight: '900',
  },
  versionValue: {
    fontSize: ms(8),
    fontFamily: 'monospace',
    color: '#94a3b8',
  },
  logoutBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 0.5,
    borderColor: 'rgba(254,205,211,0.5)',
    borderRadius: ms(12),
    height: Math.max(40, vs(40)),
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logoutBtnText: {
    color: '#e11d48',
    fontSize: ms(12),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
