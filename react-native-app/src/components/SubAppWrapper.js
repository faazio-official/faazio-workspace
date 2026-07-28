"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SubAppWrapper;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
// Import sub-app views
var FaMartScreen_1 = require("../features/ecommerce/FaMartScreen");
var GroceryScreen_1 = require("../features/ecommerce/GroceryScreen");
var FoodScreen_1 = require("../features/food/FoodScreen");
var PharmaScreen_1 = require("../features/pharma/PharmaScreen");
var AccountView_1 = require("./AccountView");
var CartView_1 = require("./CartView");
var SCREEN_HEIGHT = react_native_1.Dimensions.get('window').height;
function SubAppWrapper(_a) {
    var subAppId = _a.subAppId, onExit = _a.onExit, addToCart = _a.addToCart, cartItems = _a.cartItems, setCartItems = _a.setCartItems, updateCartQuantity = _a.updateCartQuantity, handleReset = _a.handleReset, setShowLocationRequestState = _a.setShowLocationRequestState, setIsLoggedIn = _a.setIsLoggedIn, onProductClick = _a.onProductClick;
    var _b = (0, react_1.useState)('Home'), activeTab = _b[0], setActiveTab = _b[1];
    var _c = (0, react_1.useState)('order'), activeSubMode = _c[0], setActiveSubMode = _c[1];
    var _d = (0, react_1.useState)(false), showExitConfirm = _d[0], setShowExitConfirm = _d[1];
    // Bind hardware back button in Android to open "Exit Sub-App?" confirmation sheet
    (0, react_1.useEffect)(function () {
        var onBackPress = function () {
            setShowExitConfirm(true);
            return true; // prevent default back action
        };
        react_native_1.BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return function () { return react_native_1.BackHandler.removeEventListener('hardwareBackPress', onBackPress); };
    }, []);
    var handleSubModeChange = function (mode) {
        setActiveSubMode(mode);
        setActiveTab('Home');
    };
    // Preset configuration matching Web exactly
    var getConfig = function () {
        var configPresets = {
            FA_MART: {
                name: 'FA MART',
                primaryColor: '#1162D3',
                textColor: '#1162D3',
                accentBg: '#eff6ff',
                tabs: [
                    { name: 'Home', icon: lucide_react_native_1.Home },
                    { name: 'Categories', icon: lucide_react_native_1.LayoutGrid },
                    { name: 'Cart', icon: lucide_react_native_1.ShoppingBag },
                    { name: 'Profile', icon: lucide_react_native_1.User },
                ],
            },
            FOOD: {
                name: 'FOOD',
                primaryColor: '#1E5D44',
                textColor: '#1E5D44',
                accentBg: '#ecfdf5',
                tabs: activeSubMode === 'order'
                    ? [
                        { name: 'Home', icon: lucide_react_native_1.Home },
                        { name: 'Menu', icon: lucide_react_native_1.LayoutGrid },
                        { name: 'Cart', icon: lucide_react_native_1.ShoppingBag },
                        { name: 'Profile', icon: lucide_react_native_1.User },
                    ]
                    : [
                        { name: 'Home', icon: lucide_react_native_1.Home },
                        { name: 'Search', icon: lucide_react_native_1.Search },
                        { name: 'My Bookings', icon: lucide_react_native_1.Calendar },
                        { name: 'Profile', icon: lucide_react_native_1.User },
                    ],
            },
            GROCERY: {
                name: 'FA GROCERY',
                primaryColor: '#10B981',
                textColor: '#10B981',
                accentBg: '#f0fdf4',
                tabs: [
                    { name: 'Home', icon: lucide_react_native_1.Home },
                    { name: 'Aisles', icon: lucide_react_native_1.LayoutGrid },
                    { name: 'Smart Cart', icon: lucide_react_native_1.ShoppingBag },
                    { name: 'Profile', icon: lucide_react_native_1.User },
                ],
            },
            PHARMA: {
                name: 'FA PHARMA',
                primaryColor: '#db2777',
                textColor: '#db2777',
                accentBg: '#fdf2f8',
                tabs: [
                    { name: 'Home', icon: lucide_react_native_1.Home },
                    { name: 'For You', icon: lucide_react_native_1.Sparkles },
                    { name: 'Cart', icon: lucide_react_native_1.ShoppingBag },
                    { name: 'History', icon: lucide_react_native_1.FileText },
                ],
            },
        };
        return configPresets[subAppId];
    };
    var config = getConfig();
    var totalCartQty = cartItems.reduce(function (acc, curr) { return acc + curr.quantity; }, 0);
    // Sub-app specific screens and tabs rendering
    var renderSubAppContent = function () {
        // 1. Centralized Cart and Profile tabs
        if (activeTab === 'Cart' || activeTab === 'Smart Cart') {
            return (<CartView_1.default cartItems={cartItems} setCartItems={setCartItems} updateCartQuantity={updateCartQuantity} setActiveTab={function (tab) {
                    if (tab === 'Home')
                        setActiveTab('Home');
                    else if (tab === 'Account')
                        setActiveTab('Profile');
                }}/>);
        }
        if (activeTab === 'Profile') {
            return (<AccountView_1.default handleReset={handleReset} setShowLocationRequestState={setShowLocationRequestState} setIsLoggedIn={setIsLoggedIn}/>);
        }
        // 2. Sub-app specific content
        switch (subAppId) {
            case 'FA_MART':
                if (activeTab === 'Home') {
                    return <FaMartScreen_1.FaMartScreen addToCart={addToCart} onProductClick={onProductClick}/>;
                }
                if (activeTab === 'Categories') {
                    return (<react_native_1.ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <react_native_1.View style={styles.infoSection}>
                <react_native_1.Text style={styles.infoTitle}>Mall Categories</react_native_1.Text>
                <react_native_1.View style={styles.gridContainer}>
                  {[
                            { name: 'Smart Phones', desc: 'Sleek OLED screens', icon: '📱' },
                            { name: 'Casual Wear', desc: 'Classic custom cottons', icon: '👕' },
                            { name: 'Acoustic Sound', desc: 'Noise-canceling gears', icon: '🎧' },
                            { name: 'Fitness Gear', desc: 'Heart trackers & weights', icon: '🏋️' },
                        ].map(function (cat, idx) { return (<react_native_1.TouchableOpacity key={idx} style={styles.mallCard} onPress={function () { return react_native_1.Alert.alert('Category Select', "Bespoke collection of \"".concat(cat.name, "\" is being filtered.")); }}>
                      <react_native_1.Text style={styles.mallIcon}>{cat.icon}</react_native_1.Text>
                      <react_native_1.View>
                        <react_native_1.Text style={styles.mallName}>{cat.name}</react_native_1.Text>
                        <react_native_1.Text style={styles.mallDesc}>{cat.desc}</react_native_1.Text>
                      </react_native_1.View>
                    </react_native_1.TouchableOpacity>); })}
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.ScrollView>);
                }
                break;
            case 'FOOD':
                if (activeTab === 'Home' || activeTab === 'Search') {
                    return (<FoodScreen_1.FoodScreen addToCart={addToCart} activeSubMode={activeSubMode} setActiveSubMode={handleSubModeChange} searchFocusedInitially={activeTab === 'Search'} onProductClick={onProductClick}/>);
                }
                if (activeTab === 'Menu') {
                    return (<react_native_1.ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <react_native_1.View style={styles.noDataState}>
                <react_native_1.Text style={styles.noDataEmoji}>📜</react_native_1.Text>
                <react_native_1.Text style={styles.noDataTitle}>Gourmet Menus</react_native_1.Text>
                <react_native_1.Text style={styles.noDataSub}>Vetted menus of local restaurant partners are currently synchronized with Faazio delivery agents.</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.ScrollView>);
                }
                if (activeTab === 'My Bookings') {
                    return (<react_native_1.ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <react_native_1.View style={styles.bookingsBox}>
                <react_native_1.Text style={styles.bookingsTitle}>My Reservations</react_native_1.Text>
                <react_native_1.View style={styles.emptyBookingsCard}>
                  <lucide_react_native_1.Calendar size={24} color="#1E5D44"/>
                  <react_native_1.Text style={styles.emptyBookingsTitle}>No Reservations Yet</react_native_1.Text>
                  <react_native_1.Text style={styles.emptyBookingsDesc}>
                    Explore our curated gourmet partners, select your preferred table menu, and book instantly!
                  </react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.ScrollView>);
                }
                break;
            case 'GROCERY':
                if (activeTab === 'Home') {
                    return (<GroceryScreen_1.GroceryScreen addToCart={addToCart} cartItems={cartItems} updateCartQuantity={updateCartQuantity} onProductClick={onProductClick}/>);
                }
                if (activeTab === 'Aisles') {
                    return (<react_native_1.ScrollView style={styles.tabScroll} showsVerticalScrollIndicator={false}>
              <react_native_1.View style={styles.infoSection}>
                <react_native_1.Text style={styles.infoTitle}>Aisle Categories</react_native_1.Text>
                <react_native_1.View style={styles.gridContainer}>
                  {[
                            { name: 'Greens & Orchard', count: '14 Fresh Items', emoji: '🥦', bg: '#f0fdf4' },
                            { name: 'Dairy Cold Room', count: '10 Vetted Milks', emoji: '🥛', bg: '#f0f9ff' },
                            { name: 'Bakery Hearth', count: '6 Warm Loaves', emoji: '🍞', bg: '#fff7ed' },
                            { name: 'Sweet Beverages', count: '12 Plant Milks', emoji: '🥤', bg: '#ecfeff' },
                        ].map(function (cat, idx) { return (<react_native_1.TouchableOpacity key={idx} style={[styles.mallCard, { backgroundColor: cat.bg }]} onPress={function () { return react_native_1.Alert.alert('Aisle Select', "Browsing through \"".concat(cat.name, "\" items.")); }}>
                      <react_native_1.Text style={styles.mallIcon}>{cat.emoji}</react_native_1.Text>
                      <react_native_1.View>
                        <react_native_1.Text style={styles.mallName}>{cat.name}</react_native_1.Text>
                        <react_native_1.Text style={styles.mallDesc}>{cat.count}</react_native_1.Text>
                      </react_native_1.View>
                    </react_native_1.TouchableOpacity>); })}
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.ScrollView>);
                }
                break;
            case 'PHARMA':
                if (activeTab === 'Home') {
                    return <PharmaScreen_1.PharmaScreen addToCart={addToCart} onProductClick={onProductClick}/>;
                }
                if (activeTab === 'For You') {
                    return (<react_native_1.ScrollView style={styles.tabScroll} contentContainerStyle={styles.centeredPadding} showsVerticalScrollIndicator={false}>
              <react_native_1.View style={styles.noDataState}>
                <react_native_1.Text style={styles.noDataEmoji}>🩺</react_native_1.Text>
                <react_native_1.Text style={styles.noDataTitle}>Health Matrix Recommendations</react_native_1.Text>
                <react_native_1.Text style={styles.noDataSub}>Personalized medical care recommendations tailored to your profile uploads.</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.ScrollView>);
                }
                if (activeTab === 'History') {
                    return (<react_native_1.ScrollView style={styles.tabScroll} contentContainerStyle={styles.centeredPadding} showsVerticalScrollIndicator={false}>
              <react_native_1.View style={styles.noDataState}>
                <react_native_1.Text style={styles.noDataEmoji}>📋</react_native_1.Text>
                <react_native_1.Text style={styles.noDataTitle}>Prescription logs</react_native_1.Text>
                <react_native_1.Text style={styles.noDataSub}>No clinical review histories available for (+91) 98765 43210.</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.ScrollView>);
                }
                break;
        }
        // Default fallback
        return (<react_native_1.View style={styles.noDataState}>
        <react_native_1.Text style={styles.noDataEmoji}>📦</react_native_1.Text>
        <react_native_1.Text style={styles.noDataTitle}>Synchronizing Page</react_native_1.Text>
        <react_native_1.Text style={styles.noDataSub}>The requested tab view is loading or being framed.</react_native_1.Text>
      </react_native_1.View>);
    };
    return (<react_native_1.View style={styles.container}>
      {/* 1. Header Row */}
      <react_native_1.View style={styles.header}>
        <react_native_1.View style={styles.headerLeft}>
          <react_native_1.TouchableOpacity onPress={function () { return setShowExitConfirm(true); }} style={styles.backBtn}>
            <lucide_react_native_1.ArrowLeft size={18} color="#0f172a"/>
          </react_native_1.TouchableOpacity>
          <react_native_1.View style={styles.brandWrapper}>
            <react_native_1.Text style={styles.hubTitle}>FAAZIO SERVICE HUB</react_native_1.Text>
            <react_native_1.Text style={styles.appName}>{config.name}</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>

        <react_native_1.View style={styles.locationBadge}>
          <lucide_react_native_1.MapPin size={10} color="#2563eb"/>
          <react_native_1.Text style={styles.locationText}>Utama St no. 14</react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      {/* 2. Scrollable Viewport area */}
      <react_native_1.View style={styles.viewport}>
        {renderSubAppContent()}
      </react_native_1.View>

      {/* 3. Bottom Tabs System with glow effect */}
      <react_native_1.View style={styles.tabBar}>
        {config.tabs.map(function (tab, idx) {
            var isCurrent = activeTab === tab.name;
            var Icon = tab.icon;
            return (<react_native_1.TouchableOpacity key={idx} onPress={function () { return setActiveTab(tab.name); }} style={styles.tabItem} activeOpacity={0.8}>
              {isCurrent && (<react_native_1.View style={[styles.activeIndicator, { backgroundColor: config.primaryColor }]}/>)}
              <react_native_1.View style={styles.iconContainer}>
                <Icon size={18} color={isCurrent ? config.textColor : '#94a3b8'}/>
                {tab.name.toLowerCase().includes('cart') && totalCartQty > 0 && (<react_native_1.View style={styles.badge}>
                    <react_native_1.Text style={styles.badgeText}>{totalCartQty}</react_native_1.Text>
                  </react_native_1.View>)}
              </react_native_1.View>
              <react_native_1.Text style={[styles.tabLabel, isCurrent && { color: config.textColor, fontWeight: '900' }]}>
                {tab.name}
              </react_native_1.Text>
            </react_native_1.TouchableOpacity>);
        })}
      </react_native_1.View>

      {/* 4. Bottom Exit Confirmation Modal */}
      <react_native_1.Modal visible={showExitConfirm} transparent={true} animationType="slide" onRequestClose={function () { return setShowExitConfirm(false); }}>
        <react_native_1.View style={styles.modalOverlay}>
          <react_native_1.TouchableOpacity style={styles.modalBgPressable} onPress={function () { return setShowExitConfirm(false); }}/>
          <react_native_1.View style={styles.modalContent}>
            <react_native_1.View style={styles.modalBar}/>
            <react_native_1.Text style={styles.modalTitle}>
              {subAppId === 'FOOD'
            ? 'Exit Foods?'
            : subAppId === 'PHARMA'
                ? 'Exit Pharma?'
                : subAppId === 'FA_MART'
                    ? 'Exit Mart?'
                    : 'Exit Grocery?'}
            </react_native_1.Text>
            <react_native_1.Text style={styles.modalSubtitle}>
              Are you sure you want to exit the current service and return to the main Faazio Hub?
            </react_native_1.Text>

            <react_native_1.View style={styles.modalButtons}>
              <react_native_1.TouchableOpacity onPress={function () { return setShowExitConfirm(false); }} style={styles.keepBtn}>
                <react_native_1.Text style={styles.keepBtnText}>Keep Exploring</react_native_1.Text>
              </react_native_1.TouchableOpacity>
              <react_native_1.TouchableOpacity onPress={function () {
            setShowExitConfirm(false);
            onExit();
        }} style={[styles.exitBtn, { backgroundColor: config.primaryColor }]}>
                <react_native_1.Text style={styles.exitBtnText}>Exit to Hub</react_native_1.Text>
              </react_native_1.TouchableOpacity>
            </react_native_1.View>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.Modal>
    </react_native_1.View>);
}
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        backgroundColor: '#ffffff',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    brandWrapper: {
        justifyContent: 'center',
    },
    hubTitle: {
        fontSize: 7,
        fontWeight: '900',
        color: '#94a3b8',
        letterSpacing: 0.8,
    },
    appName: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 1,
    },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f4ff',
        borderWidth: 0.5,
        borderColor: '#dbeafe',
        borderRadius: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    locationText: {
        fontSize: 8.5,
        color: '#2563eb',
        fontWeight: '800',
        marginLeft: 3,
    },
    viewport: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    tabScroll: {
        flex: 1,
    },
    centeredPadding: {
        padding: 20,
        alignItems: 'center',
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 40,
        width: '100%',
        marginBottom: 20,
    },
    searchBoxPlaceholder: {
        fontSize: 11,
        color: '#94a3b8',
        marginLeft: 8,
        fontWeight: '600',
    },
    noDataState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50,
        paddingHorizontal: 24,
    },
    noDataEmoji: {
        fontSize: 32,
        marginBottom: 12,
    },
    noDataTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#1e293b',
        textAlign: 'center',
    },
    noDataSub: {
        fontSize: 9.5,
        color: '#94a3b8',
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 14,
        marginTop: 6,
    },
    modeTogglePadding: {
        padding: 16,
    },
    modeToggleRow: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 14,
        padding: 4,
        marginBottom: 20,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    modeBtnActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    modeBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748b',
    },
    modeBtnTextActive: {
        color: '#1E5D44',
    },
    infoSection: {
        padding: 16,
    },
    infoTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    gridContainer: {
        gap: 12,
    },
    mallCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    mallIcon: {
        fontSize: 22,
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        textAlign: 'center',
        lineHeight: 44,
    },
    mallName: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
    },
    mallDesc: {
        fontSize: 9,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 2,
    },
    bookingsBox: {
        padding: 16,
    },
    bookingsTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    emptyBookingsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
    },
    emptyBookingsTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 10,
    },
    emptyBookingsDesc: {
        fontSize: 9.5,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 14,
        marginTop: 6,
        paddingHorizontal: 12,
    },
    tabBar: {
        height: 64,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
        flexDirection: 'row',
        backgroundColor: '#ffffff',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    activeIndicator: {
        position: 'absolute',
        top: 0,
        width: 24,
        height: 3,
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 2,
    },
    iconContainer: {
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -10,
        backgroundColor: '#f97316',
        borderRadius: 7,
        minWidth: 14,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
        borderWidth: 1,
        borderColor: '#ffffff',
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 7.5,
        fontWeight: '900',
    },
    tabLabel: {
        fontSize: 8.5,
        color: '#94a3b8',
        fontWeight: '700',
        marginTop: 3,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    modalBgPressable: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 32,
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
    },
    modalBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#e2e8f0',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    modalSubtitle: {
        fontSize: 9.5,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 14,
        marginTop: 6,
        paddingHorizontal: 20,
        fontWeight: '600',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        width: '100%',
    },
    keepBtn: {
        flex: 1,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    keepBtnText: {
        color: '#475569',
        fontSize: 10,
        fontWeight: '900',
    },
    exitBtn: {
        flex: 1,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    exitBtnText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '900',
    },
});
