import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { User, LogOut, ChevronRight, Settings, CreditCard, Shield, HelpCircle, History, Calendar } from 'lucide-react-native';

export function ProfileScreen({ navigation }: any) {
  const handleLogout = () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to exit your Faazio session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => {
        // Pop back to login or onboarding
        Alert.alert('Logged Out', 'Demo session terminated successfully.');
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150' }}
              style={styles.avatar}
            />
            <View style={styles.statusBadge} />
          </View>
          <Text style={styles.userName}>Faizal Basha</Text>
          <Text style={styles.userEmail}>faizalbashafaizalbasha07@gmail.com</Text>
        </View>

        {/* Dashboard Statistics */}
        <View style={styles.statsRow}>
          {[
            { value: '4', label: 'Orders', icon: History, color: '#0284c7' },
            { value: '2', label: 'Bookings', icon: Calendar, color: '#10b981' },
            { value: '1', label: 'Prescriptions', icon: Shield, color: '#db2777' },
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <View key={idx} style={styles.statCard}>
                <View style={[styles.statIconCircle, { backgroundColor: stat.color + '10' }]}>
                  <Icon size={14} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Quick Lists */}
        <Text style={styles.sectionTitle}>Account & Services</Text>
        <View style={styles.optionsList}>
          {[
            { icon: History, name: 'Order History & Status', color: '#0284c7' },
            { icon: Calendar, name: 'My Table Reservations', color: '#10b981' },
            { icon: Shield, name: 'Security & Consent Settings', color: '#3b82f6' },
            { icon: HelpCircle, name: 'Help & Customer Support', color: '#f59e0b' },
          ].map((option, idx) => {
            const IconComponent = option.icon;
            return (
              <TouchableOpacity key={idx} style={styles.optionRow} activeOpacity={0.8}>
                <View style={styles.optionLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: option.color + '12' }]}>
                    <IconComponent size={16} color={option.color} />
                  </View>
                  <Text style={styles.optionName}>{option.name}</Text>
                </View>
                <ChevronRight size={14} color="#94a3b8" />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Session Terminate Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.9}>
          <LogOut size={16} color="#ef4444" style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Log Out Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginVertical: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2.5,
    borderColor: '#ffffff',
  },
  userName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 10,
  },
  userEmail: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginVertical: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '700',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionsList: {
    gap: 10,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fee2e2',
    borderRadius: 16,
    height: 46,
    marginTop: 28,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
