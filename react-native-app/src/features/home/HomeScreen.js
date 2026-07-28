"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeScreen = HomeScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var SCREEN_HEIGHT = react_native_1.Dimensions.get('window').height;
function HomeScreen(_a) {
    var navigation = _a.navigation;
    var services = [
        {
            id: 'FOOD',
            name: 'Food Delivery',
            desc: 'Gourmet dining & tables',
            icon: lucide_react_native_1.Utensils,
            color: '#ecfdf5',
            accent: '#10b981',
            tabName: 'Bookings',
            tag: 'Gourmet'
        },
        {
            id: 'FA_MART',
            name: 'FA Mart',
            desc: 'Curated global brands',
            icon: lucide_react_native_1.ShoppingBag,
            color: '#f0f9ff',
            accent: '#0284c7',
            tabName: 'Shop',
            tag: 'Premium'
        },
        {
            id: 'PHARMA',
            name: 'FA Pharma',
            desc: 'Prescriptions filled',
            icon: lucide_react_native_1.BriefcaseMedical,
            color: '#fdf2f8',
            accent: '#db2777',
            tabName: 'Pharma',
            tag: 'Certified'
        },
    ];
    return (<react_native_1.SafeAreaView style={styles.container}>
      {/* Top Fixed Location Header */}
      <react_native_1.View style={styles.topBar}>
        <react_native_1.View style={styles.locationWrapper}>
          <lucide_react_native_1.MapPin size={16} color="#2c56f6" style={styles.pinIcon}/>
          <react_native_1.View>
            <react_native_1.Text style={styles.locationLabel}>Delivering to</react_native_1.Text>
            <react_native_1.View style={styles.locationRow}>
              <react_native_1.Text style={styles.locationValue} numberOfLines={1}>Sunnambukkara Street, Karaikal</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>
        </react_native_1.View>
        <react_native_1.TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8}>
          <lucide_react_native_1.Bell size={18} color="#475569"/>
          <react_native_1.View style={styles.badgeDot}/>
        </react_native_1.TouchableOpacity>
      </react_native_1.View>

      <react_native_1.ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Search Bar Wrapper */}
        <react_native_1.View style={styles.searchWrapper}>
          <lucide_react_native_1.Search size={18} color="#94a3b8"/>
          <react_native_1.Text style={styles.searchPlaceholder}>Search food, pharma, mart or services...</react_native_1.Text>
        </react_native_1.View>

        {/* Brand Billboard Card */}
        <react_native_1.View style={styles.billboardCard}>
          <react_native_1.View style={styles.billboardContent}>
            <react_native_1.View style={styles.sparkleRow}>
              <lucide_react_native_1.Sparkles size={14} color="#f59e0b"/>
              <react_native_1.Text style={styles.sparkleTag}>FAAZIO PREMIUM</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.Text style={styles.billboardTitle}>All Services inside One Hub</react_native_1.Text>
            <react_native_1.Text style={styles.billboardDesc}>
              Instant deliveries, certified pharmacy, and top table reservations at your absolute convenience.
            </react_native_1.Text>
            <react_native_1.TouchableOpacity style={styles.billboardBtn} activeOpacity={0.9}>
              <react_native_1.Text style={styles.billboardBtnText}>Explore Offers</react_native_1.Text>
              <lucide_react_native_1.Percent size={12} color="#ffffff" style={{ marginLeft: 4 }}/>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>
          <react_native_1.View style={styles.avatarCircle}>
            <react_native_1.Image source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150' }} style={styles.billboardAvatar}/>
          </react_native_1.View>
        </react_native_1.View>

        {/* Section Heading */}
        <react_native_1.View style={styles.sectionHeader}>
          <react_native_1.Text style={styles.sectionTitle}>Bento Hub Services</react_native_1.Text>
          <react_native_1.Text style={styles.sectionTag}>VETTED PARTNERS</react_native_1.Text>
        </react_native_1.View>

        {/* Custom Bento Grid Layout matching source web previews */}
        <react_native_1.View style={styles.bentoGrid}>
          {services.map(function (item) {
            var IconComponent = item.icon;
            return (<react_native_1.TouchableOpacity key={item.id} onPress={function () { return navigation.navigate(item.tabName); }} style={[styles.bentoCard, { backgroundColor: item.color }]} activeOpacity={0.9}>
                <react_native_1.View style={styles.bentoHeader}>
                  <react_native_1.View style={[styles.iconWrapper, { backgroundColor: '#ffffff' }]}>
                    <IconComponent size={20} color={item.accent}/>
                  </react_native_1.View>
                  <react_native_1.Text style={[styles.bentoTag, { color: item.accent, backgroundColor: item.accent + '15' }]}>
                    {item.tag}
                  </react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.bentoFooter}>
                  <react_native_1.Text style={styles.bentoTitle}>{item.name}</react_native_1.Text>
                  <react_native_1.Text style={styles.bentoDesc}>{item.desc}</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.TouchableOpacity>);
        })}
        </react_native_1.View>

        {/* Safety Banner */}
        <react_native_1.View style={styles.safetyBox}>
          <lucide_react_native_1.ShieldCheck size={20} color="#10b981"/>
          <react_native_1.View style={styles.safetyTextWrapper}>
            <react_native_1.Text style={styles.safetyTitle}>Faazio Trust Seal</react_native_1.Text>
            <react_native_1.Text style={styles.safetySubtitle}>All deliveries sanitized, prescriptions certified by vetted clinical partners.</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.ScrollView>
    </react_native_1.SafeAreaView>);
}
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        backgroundColor: '#ffffff',
    },
    locationWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 16,
    },
    pinIcon: {
        marginRight: 8,
        marginTop: 2,
    },
    locationLabel: {
        fontSize: 9,
        color: '#94a3b8',
        textTransform: 'uppercase',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationValue: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0f172a',
    },
    notificationBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    badgeDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: SCREEN_HEIGHT < 700 ? 16 : 32,
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 48,
        marginBottom: 20,
    },
    searchPlaceholder: {
        fontSize: 12,
        color: '#94a3b8',
        marginLeft: 10,
        fontWeight: '600',
    },
    billboardCard: {
        backgroundColor: '#1E5D44',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#1E5D44',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 4,
        marginBottom: 24,
    },
    billboardContent: {
        flex: 1,
        paddingRight: 12,
    },
    sparkleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    sparkleTag: {
        color: '#f59e0b',
        fontSize: 8,
        fontWeight: '900',
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    billboardTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#ffffff',
        lineHeight: 20,
    },
    billboardDesc: {
        fontSize: 10.5,
        color: 'rgba(255, 255, 255, 0.85)',
        marginTop: 6,
        lineHeight: 15,
        fontWeight: '500',
    },
    billboardBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginTop: 12,
        alignSelf: 'flex-start',
    },
    billboardBtnText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    avatarCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#ffffff',
        overflow: 'hidden',
        backgroundColor: '#f1f5f9',
    },
    billboardAvatar: {
        width: '100%',
        height: '100%',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0f172a',
        letterSpacing: -0.2,
    },
    sectionTag: {
        fontSize: 9,
        fontWeight: '800',
        color: '#2c56f6',
        letterSpacing: 0.5,
    },
    bentoGrid: {
        gap: 12,
        marginBottom: 20,
    },
    bentoCard: {
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        minHeight: SCREEN_HEIGHT < 700 ? 90 : 105,
        justifyContent: 'space-between',
    },
    bentoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    iconWrapper: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    bentoTag: {
        fontSize: 8,
        fontWeight: '900',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 10,
        textTransform: 'uppercase',
    },
    bentoFooter: {
        marginTop: 10,
    },
    bentoTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0f172a',
    },
    bentoDesc: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 2,
        fontWeight: '500',
    },
    safetyBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#dcfce7',
        borderRadius: 16,
        padding: 14,
    },
    safetyTextWrapper: {
        marginLeft: 10,
        flex: 1,
    },
    safetyTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#16a34a',
    },
    safetySubtitle: {
        fontSize: 9.5,
        color: '#15803d',
        lineHeight: 14,
        fontWeight: '500',
    },
});
