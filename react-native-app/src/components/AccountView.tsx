import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  MapPin,
  Compass,
  Activity,
  LogOut,
  Truck,
} from 'lucide-react-native';

interface AccountViewProps {
  handleReset: () => void;
  setShowLocationRequestState: (val: boolean) => void;
  setIsLoggedIn: (val: boolean) => void;
}

export default function AccountView({
  handleReset,
  setShowLocationRequestState,
  setIsLoggedIn,
}: AccountViewProps) {
  const pastOrders = [
    { id: "FA-810293", item: "Truffle Burger Duo", store: "The Gourmet Table", price: "₹450", date: "Yesterday, 8:14 PM", status: "Delivered", icon: "🍲" },
    { id: "FA-792810", item: "AC Jet Cleaning Service", store: "Apex Home Care", price: "₹1,250", date: "3 days ago", status: "Completed", icon: "🛍️" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      
      {/* 1. User Profile Summary */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>FB</Text>
        </View>
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
        <View style={styles.activeDeliveryContent}>
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active Delivery</Text>
          </View>
          <Text style={styles.activeOrderId}>Order #FA-882901</Text>
          <Text style={styles.activeOrderDesc}>Rider is picking up your fresh order basket</Text>
        </View>
        <View style={styles.activeDeliveryIconCircle}>
          <Truck size={18} color="#ffffff" />
        </View>
      </View>

      <View style={styles.historyList}>
        {pastOrders.map((o, index) => (
          <View key={index} style={styles.historyCard}>
            <View style={styles.historyIconCircle}>
              <Text style={styles.historyIconEmoji}>{o.icon}</Text>
            </View>
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
            <MapPin size={14} color="#3b82f6" />
            <Text style={styles.settingRowLabel}>Primary Location Settings</Text>
          </View>
          <View style={styles.locationBadge}>
            <Text style={styles.locationBadgeText}>Mumbai, MH</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.settingRow}>
          <View style={styles.settingRowLeft}>
            <Compass size={14} color="#4f46e5" />
            <Text style={styles.settingRowLabel}>Notifications Enabled</Text>
          </View>
          <View style={styles.activeStateBadge}>
            <Text style={styles.activeStateBadgeText}>Active</Text>
          </View>
        </View>

        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingRowLeft}>
            <Activity size={14} color="#a855f7" />
            <Text style={styles.settingRowLabel}>Faazio App Version</Text>
          </View>
          <Text style={styles.versionValue}>v1.2.0-prod</Text>
        </View>
      </View>

      {/* 4. Log Out button */}
      <TouchableOpacity onPress={handleReset} style={styles.logoutBtn} activeOpacity={0.8}>
        <LogOut size={12} color="#e11d48" style={{ marginRight: 6 }} />
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
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 16,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  profileName: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
  },
  profileSub: {
    fontSize: 8.5,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 2,
  },
  profileInfoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
  },
  infoLabel: {
    fontSize: 6.5,
    color: '#94a3b8',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 8.5,
    color: '#334155',
    fontWeight: '900',
    marginTop: 4,
  },
  sectionHeader: {
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  activeDeliveryCard: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  activeDeliveryContent: {
    flex: 1,
    marginRight: 10,
  },
  activeBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    fontSize: 6,
    color: '#ffffff',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  activeOrderId: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 4,
  },
  activeOrderDesc: {
    fontSize: 8.5,
    color: '#eff6ff',
    fontWeight: '600',
    marginTop: 2,
  },
  activeDeliveryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyList: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIconEmoji: {
    fontSize: 10,
  },
  historyInfo: {
    marginLeft: 10,
    flex: 1,
    marginRight: 10,
  },
  historyRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyOrderId: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '700',
  },
  historyStatusBadge: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  historyStatusText: {
    fontSize: 7.5,
    color: '#16a34a',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  historyItemName: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#1e293b',
    marginTop: 2,
  },
  historyStoreDetails: {
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  historyPrice: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1e293b',
  },
  settingsGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 6,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingRowLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#334155',
  },
  locationBadge: {
    backgroundColor: '#eff6ff',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  locationBadgeText: {
    fontSize: 8,
    color: '#2563eb',
    fontWeight: '900',
  },
  activeStateBadge: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  activeStateBadgeText: {
    fontSize: 7.5,
    color: '#16a34a',
    fontWeight: '900',
  },
  versionValue: {
    fontSize: 7.5,
    fontFamily: 'monospace',
    color: '#94a3b8',
  },
  logoutBtn: {
    backgroundColor: '#fff1f2',
    borderWidth: 0.5,
    borderColor: '#fecdd3',
    borderRadius: 16,
    height: 38,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logoutBtnText: {
    color: '#e11d48',
    fontSize: 10.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
