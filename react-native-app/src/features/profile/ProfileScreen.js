"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileScreen = ProfileScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
function ProfileScreen(_a) {
    var navigation = _a.navigation;
    var handleLogout = function () {
        react_native_1.Alert.alert('Confirm Logout', 'Are you sure you want to exit your Faazio session?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: function () {
                    // Pop back to login or onboarding
                    react_native_1.Alert.alert('Logged Out', 'Demo session terminated successfully.');
                } }
        ]);
    };
    return (<react_native_1.SafeAreaView style={styles.container}>
      <react_native_1.ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <react_native_1.View style={styles.profileHeader}>
          <react_native_1.View style={styles.avatarContainer}>
            <react_native_1.Image source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150' }} style={styles.avatar}/>
            <react_native_1.View style={styles.statusBadge}/>
          </react_native_1.View>
          <react_native_1.Text style={styles.userName}>Faizal Basha</react_native_1.Text>
          <react_native_1.Text style={styles.userEmail}>faizalbashafaizalbasha07@gmail.com</react_native_1.Text>
        </react_native_1.View>

        {/* Dashboard Statistics */}
        <react_native_1.View style={styles.statsRow}>
          {[
            { value: '4', label: 'Orders', icon: lucide_react_native_1.History, color: '#0284c7' },
            { value: '2', label: 'Bookings', icon: lucide_react_native_1.Calendar, color: '#10b981' },
            { value: '1', label: 'Prescriptions', icon: lucide_react_native_1.Shield, color: '#db2777' },
        ].map(function (stat, idx) {
            var Icon = stat.icon;
            return (<react_native_1.View key={idx} style={styles.statCard}>
                <react_native_1.View style={[styles.statIconCircle, { backgroundColor: stat.color + '10' }]}>
                  <Icon size={14} color={stat.color}/>
                </react_native_1.View>
                <react_native_1.Text style={styles.statValue}>{stat.value}</react_native_1.Text>
                <react_native_1.Text style={styles.statLabel}>{stat.label}</react_native_1.Text>
              </react_native_1.View>);
        })}
        </react_native_1.View>

        {/* Quick Lists */}
        <react_native_1.Text style={styles.sectionTitle}>Account & Services</react_native_1.Text>
        <react_native_1.View style={styles.optionsList}>
          {[
            { icon: lucide_react_native_1.History, name: 'Order History & Status', color: '#0284c7' },
            { icon: lucide_react_native_1.Calendar, name: 'My Table Reservations', color: '#10b981' },
            { icon: lucide_react_native_1.Shield, name: 'Security & Consent Settings', color: '#3b82f6' },
            { icon: lucide_react_native_1.HelpCircle, name: 'Help & Customer Support', color: '#f59e0b' },
        ].map(function (option, idx) {
            var IconComponent = option.icon;
            return (<react_native_1.TouchableOpacity key={idx} style={styles.optionRow} activeOpacity={0.8}>
                <react_native_1.View style={styles.optionLeft}>
                  <react_native_1.View style={[styles.iconWrapper, { backgroundColor: option.color + '12' }]}>
                    <IconComponent size={16} color={option.color}/>
                  </react_native_1.View>
                  <react_native_1.Text style={styles.optionName}>{option.name}</react_native_1.Text>
                </react_native_1.View>
                <lucide_react_native_1.ChevronRight size={14} color="#94a3b8"/>
              </react_native_1.TouchableOpacity>);
        })}
        </react_native_1.View>

        {/* Session Terminate Button */}
        <react_native_1.TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.9}>
          <lucide_react_native_1.LogOut size={16} color="#ef4444" style={{ marginRight: 6 }}/>
          <react_native_1.Text style={styles.logoutText}>Log Out Session</react_native_1.Text>
        </react_native_1.TouchableOpacity>
      </react_native_1.ScrollView>
    </react_native_1.SafeAreaView>);
}
var styles = react_native_1.StyleSheet.create({
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
