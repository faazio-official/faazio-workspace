"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainDashboardScreen = MainDashboardScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
// Import Hub Views
var HomeView_1 = require("../../components/HomeView");
var CategoriesView_1 = require("../../components/CategoriesView");
var FavouritesView_1 = require("../../components/FavouritesView");
var AccountView_1 = require("../../components/AccountView");
var CartView_1 = require("../../components/CartView");
var SubAppWrapper_1 = require("../../components/SubAppWrapper");
var SCREEN_HEIGHT = react_native_1.Dimensions.get('window').height;
function MainDashboardScreen(_a) {
    var navigation = _a.navigation;
    var _b = (0, react_1.useState)('Home'), activeTab = _b[0], setActiveTab = _b[1];
    var _c = (0, react_1.useState)(null), activeSubApp = _c[0], setActiveSubApp = _c[1];
    // Unified persistent state shared across Hub and active sub-apps
    var _d = (0, react_1.useState)([
        { id: "cat-fm-1", name: "Spicy Tonkotsu Ramen", price: 225, quantity: 1, emoji: "🍜" }
    ]), cartItems = _d[0], setCartItems = _d[1];
    var _e = (0, react_1.useState)(['cat-fm-1', 'cat-gg-2', 'cat-mt-1']), favorites = _e[0], setFavorites = _e[1];
    // Cart Helper actions
    var addToCart = function (id, name, price, emoji) {
        setCartItems(function (prev) {
            var existing = prev.find(function (item) { return item.id === id; });
            if (existing) {
                return prev.map(function (item) {
                    return item.id === id ? __assign(__assign({}, item), { quantity: item.quantity + 1 }) : item;
                });
            }
            return __spreadArray(__spreadArray([], prev, true), [{ id: id, name: name, price: price, quantity: 1, emoji: emoji }], false);
        });
    };
    var updateCartQuantity = function (id, delta) {
        setCartItems(function (prev) {
            return prev
                .map(function (item) {
                if (item.id === id) {
                    var nextQty = item.quantity + delta;
                    return __assign(__assign({}, item), { quantity: nextQty });
                }
                return item;
            })
                .filter(function (item) { return item.quantity > 0; });
        });
    };
    var toggleFavorite = function (productId) {
        setFavorites(function (prev) {
            if (prev.includes(productId)) {
                return prev.filter(function (id) { return id !== productId; });
            }
            return __spreadArray(__spreadArray([], prev, true), [productId], false);
        });
    };
    var handleReset = function () {
        setCartItems([]);
        setActiveTab('Home');
        setActiveSubApp(null);
        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
        });
    };
    var setShowLocationRequestState = function (val) {
        // Graceful callback
    };
    var setIsLoggedIn = function (val) {
        // Graceful callback
    };
    // Total items in cart
    var totalCartQty = cartItems.reduce(function (acc, curr) { return acc + curr.quantity; }, 0);
    // If a sub-app is active, let SubAppWrapper take complete edge-to-edge layout control!
    if (activeSubApp !== null) {
        return (<react_native_1.SafeAreaView style={styles.container}>
        <SubAppWrapper_1.default subAppId={activeSubApp} onExit={function () { return setActiveSubApp(null); }} addToCart={addToCart} cartItems={cartItems} setCartItems={setCartItems} updateCartQuantity={updateCartQuantity} handleReset={handleReset} setShowLocationRequestState={setShowLocationRequestState} setIsLoggedIn={setIsLoggedIn} onProductClick={function (prod) {
                navigation.navigate('ProductDetail', { productId: prod.id });
            }}/>
      </react_native_1.SafeAreaView>);
    }
    // Otherwise, render the Hub view!
    var renderHubContent = function () {
        switch (activeTab) {
            case 'Home':
                return (<HomeView_1.default onLaunchSubApp={function (subAppId) { return setActiveSubApp(subAppId); }} addToCart={addToCart}/>);
            case 'Categories':
                return (<CategoriesView_1.default selectedCategory="ALL" setSelectedCategory={function () { }} addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} onProductClick={function (prod) {
                        navigation.navigate('ProductDetail', { productId: prod.id });
                    }}/>);
            case 'Favourites':
                return (<FavouritesView_1.default addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} onProductClick={function (prod) {
                        navigation.navigate('ProductDetail', { productId: prod.id });
                    }}/>);
            case 'Account':
                return (<AccountView_1.default handleReset={handleReset} setShowLocationRequestState={setShowLocationRequestState} setIsLoggedIn={setIsLoggedIn}/>);
            case 'Cart':
                return (<CartView_1.default cartItems={cartItems} setCartItems={setCartItems} updateCartQuantity={updateCartQuantity} setActiveTab={function (tab) {
                        if (tab === 'Home')
                            setActiveTab('Home');
                        else if (tab === 'Account')
                            setActiveTab('Account');
                    }}/>);
        }
    };
    return (<react_native_1.SafeAreaView style={styles.container}>
      {/* 1. Hub Top Fixed Location Header */}
      <react_native_1.View style={styles.topBar}>
        <react_native_1.View style={styles.locationWrapper}>
          <lucide_react_native_1.MapPin size={15} color="#2c56f6" style={styles.pinIcon}/>
          <react_native_1.View>
            <react_native_1.Text style={styles.locationLabel}>Delivering to</react_native_1.Text>
            <react_native_1.Text style={styles.locationValue} numberOfLines={1}>Sunnambukkara Street, Karaikal</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>

        <react_native_1.View style={styles.rightHeaderGroup}>
          <react_native_1.Text style={styles.faazioBrandTitle}>FAAZIO HUB</react_native_1.Text>
          <react_native_1.TouchableOpacity style={styles.notificationBtn} activeOpacity={0.8}>
            <lucide_react_native_1.Bell size={16} color="#475569"/>
            <react_native_1.View style={styles.badgeDot}/>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_1.View>

      {/* 2. Scrollable Hub content */}
      <react_native_1.View style={styles.viewport}>
        {renderHubContent()}
      </react_native_1.View>

      {/* 3. Hub Bottom Navigation Tabs */}
      <react_native_1.View style={styles.tabBar}>
        {[
            { name: 'Home', icon: lucide_react_native_1.Home, label: 'Hub' },
            { name: 'Categories', icon: lucide_react_native_1.LayoutGrid, label: 'Explore' },
            { name: 'Favourites', icon: lucide_react_native_1.Heart, label: 'Saved' },
            { name: 'Cart', icon: lucide_react_native_1.ShoppingBag, label: 'Bag' },
            { name: 'Account', icon: lucide_react_native_1.User, label: 'Profile' },
        ].map(function (tab, idx) {
            var isCurrent = activeTab === tab.name;
            var Icon = tab.icon;
            return (<react_native_1.TouchableOpacity key={idx} onPress={function () { return setActiveTab(tab.name); }} style={styles.tabItem} activeOpacity={0.85}>
              {isCurrent && (<react_native_1.View style={styles.activeIndicator}/>)}
              <react_native_1.View style={styles.iconContainer}>
                <Icon size={18} color={isCurrent ? '#0f172a' : '#94a3b8'}/>
                {tab.name === 'Cart' && totalCartQty > 0 && (<react_native_1.View style={styles.badge}>
                    <react_native_1.Text style={styles.badgeText}>{totalCartQty}</react_native_1.Text>
                  </react_native_1.View>)}
              </react_native_1.View>
              <react_native_1.Text style={[styles.tabLabel, isCurrent && { color: '#0f172a', fontWeight: '900' }]}>
                {tab.label}
              </react_native_1.Text>
            </react_native_1.TouchableOpacity>);
        })}
      </react_native_1.View>
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
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
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
        marginRight: 6,
        marginTop: 2,
    },
    locationLabel: {
        fontSize: 7.5,
        color: '#94a3b8',
        textTransform: 'uppercase',
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    locationValue: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 1,
    },
    rightHeaderGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    faazioBrandTitle: {
        fontSize: 9,
        fontWeight: '900',
        color: '#0f172a',
        letterSpacing: 0.5,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    notificationBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    badgeDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
    },
    viewport: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    tabBar: {
        height: 62,
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
        width: 20,
        height: 3,
        backgroundColor: '#0f172a',
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
});
