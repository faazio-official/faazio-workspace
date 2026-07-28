"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcommerceScreen = EcommerceScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var SCREEN_HEIGHT = react_native_1.Dimensions.get('window').height;
function EcommerceScreen() {
    var _a = (0, react_1.useState)('All Mart'), activeCategory = _a[0], setActiveCategory = _a[1];
    var _b = (0, react_1.useState)(0), cartCount = _b[0], setCartCount = _b[1];
    var categories = ['All Mart', 'Apparel', 'Footwear', 'Accessories', 'Tech'];
    var products = [
        {
            id: 'em-1',
            name: 'Faazio Premium Fit Hoodie',
            price: '₹3,499',
            rating: '4.9',
            image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=300&h=300',
            tag: 'FA SPECIAL',
            category: 'Apparel'
        },
        {
            id: 'em-2',
            name: 'Milano Leather Boots',
            price: '₹8,999',
            rating: '4.8',
            image: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&q=80&w=300&h=300',
            tag: 'EXCLUSIVE',
            category: 'Footwear'
        },
        {
            id: 'em-3',
            name: 'Minimalist Thermal Bottle',
            price: '₹1,299',
            rating: '4.7',
            image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=300&h=300',
            tag: 'TRENDING',
            category: 'Accessories'
        },
        {
            id: 'em-4',
            name: 'Noise-Canceling Pods Pro',
            price: '₹4,499',
            rating: '4.9',
            image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=300&h=300',
            tag: 'NEW LAUNCH',
            category: 'Tech'
        },
    ];
    var filteredProducts = activeCategory === 'All Mart'
        ? products
        : products.filter(function (p) { return p.category === activeCategory; });
    var handleAddToCart = function (name) {
        setCartCount(function (prev) { return prev + 1; });
        react_native_1.Alert.alert('Basket Updated', "\"".concat(name, "\" added successfully to your Faazio Mart basket."));
    };
    return (<react_native_1.SafeAreaView style={styles.container}>
      {/* Mini App Top Header Row */}
      <react_native_1.View style={styles.appHeader}>
        <react_native_1.View style={styles.appTitleWrapper}>
          <react_native_1.View style={styles.logoBadge}>
            <lucide_react_native_1.ShoppingBag size={14} color="#e11d48"/>
          </react_native_1.View>
          <react_native_1.View>
            <react_native_1.Text style={styles.appTitle}>FA Mart</react_native_1.Text>
            <react_native_1.Text style={styles.appSubtitle}>Curated Brands, Delivered Instantly</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>

        <react_native_1.TouchableOpacity style={styles.cartIconWrapper} onPress={function () { return react_native_1.Alert.alert('Mart Checkout', "Your basket has ".concat(cartCount, " items. Ready to place your order?"), [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Checkout Now', onPress: function () {
                    setCartCount(0);
                    react_native_1.Alert.alert('Order Placed!', 'Your custom boutique order has been booked with Faazio Partners.');
                } }
        ]); }} activeOpacity={0.8}>
          <lucide_react_native_1.ShoppingCart size={18} color="#e11d48"/>
          {cartCount > 0 && (<react_native_1.View style={styles.badgeCount}>
              <react_native_1.Text style={styles.badgeText}>{cartCount}</react_native_1.Text>
            </react_native_1.View>)}
        </react_native_1.TouchableOpacity>
      </react_native_1.View>

      <react_native_1.ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <react_native_1.View style={styles.promotionBanner}>
          <react_native_1.View style={styles.promoTextCol}>
            <react_native_1.View style={styles.dealTag}>
              <lucide_react_native_1.Tag size={10} color="#e11d48" style={{ marginRight: 4 }}/>
              <react_native_1.Text style={styles.dealTagText}>LIMITED TIME DEAL</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.Text style={styles.promoTitle}>Boutique Wardrobe Sale</react_native_1.Text>
            <react_native_1.Text style={styles.promoDesc}>Get up to 40% discount on global fashion labels today.</react_native_1.Text>
          </react_native_1.View>
          <react_native_1.View style={styles.discountBadge}>
            <react_native_1.Text style={styles.discountNum}>40%</react_native_1.Text>
            <react_native_1.Text style={styles.discountOff}>OFF</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>

        {/* Section categories */}
        <react_native_1.Text style={styles.sectionHeading}>Browse Collections</react_native_1.Text>
        <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow}>
          {categories.map(function (cat) {
            var isActive = activeCategory === cat;
            return (<react_native_1.TouchableOpacity key={cat} onPress={function () { return setActiveCategory(cat); }} style={[styles.categoryBtn, isActive && styles.categoryBtnActive]} activeOpacity={0.8}>
                <react_native_1.Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{cat}</react_native_1.Text>
              </react_native_1.TouchableOpacity>);
        })}
        </react_native_1.ScrollView>

        {/* Product Grid */}
        <react_native_1.Text style={styles.sectionHeading}>Featured Products</react_native_1.Text>
        <react_native_1.View style={styles.productGrid}>
          {filteredProducts.map(function (item) { return (<react_native_1.View key={item.id} style={styles.productCard}>
              <react_native_1.View style={styles.imageWrapper}>
                <react_native_1.Image source={{ uri: item.image }} style={styles.productImage}/>
                <react_native_1.View style={styles.productBadge}>
                  <react_native_1.Text style={styles.badgeLabel}>{item.tag}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.TouchableOpacity style={styles.favBtn} activeOpacity={0.8}>
                  <lucide_react_native_1.Heart size={14} color="#e11d48" fill="#e11d48"/>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>

              <react_native_1.View style={styles.productInfo}>
                <react_native_1.Text style={styles.productName} numberOfLines={1}>{item.name}</react_native_1.Text>
                <react_native_1.View style={styles.ratingRow}>
                  <lucide_react_native_1.Star size={10} color="#f59e0b" fill="#f59e0b"/>
                  <react_native_1.Text style={styles.ratingValue}>{item.rating}</react_native_1.Text>
                  <react_native_1.Text style={styles.dotSeparator}>•</react_native_1.Text>
                  <react_native_1.Text style={styles.deliveryTime}>Instant Delivery</react_native_1.Text>
                </react_native_1.View>

                <react_native_1.View style={styles.cardFooter}>
                  <react_native_1.Text style={styles.priceValue}>{item.price}</react_native_1.Text>
                  <react_native_1.TouchableOpacity onPress={function () { return handleAddToCart(item.name); }} style={styles.addBtn} activeOpacity={0.8}>
                    <react_native_1.Text style={styles.addBtnText}>Add</react_native_1.Text>
                  </react_native_1.TouchableOpacity>
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.View>); })}
        </react_native_1.View>
      </react_native_1.ScrollView>
    </react_native_1.SafeAreaView>);
}
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    appHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
    },
    appTitleWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#fff1f2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    appTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0f172a',
    },
    appSubtitle: {
        fontSize: 9.5,
        color: '#64748b',
        fontWeight: '600',
    },
    cartIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#fff1f2',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    badgeCount: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#e11d48',
        borderRadius: 8,
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: '900',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: SCREEN_HEIGHT < 700 ? 16 : 32,
    },
    promotionBanner: {
        backgroundColor: '#fff1f2',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#ffe4e6',
    },
    promoTextCol: {
        flex: 1,
        paddingRight: 12,
    },
    dealTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    dealTagText: {
        color: '#e11d48',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    promoTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#9f1239',
    },
    promoDesc: {
        fontSize: 10,
        color: '#be123c',
        marginTop: 4,
        lineHeight: 14,
        fontWeight: '500',
    },
    discountBadge: {
        backgroundColor: '#e11d48',
        borderRadius: 14,
        width: 46,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
    },
    discountNum: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '900',
    },
    discountOff: {
        color: '#ffffff',
        fontSize: 7,
        fontWeight: '900',
        marginTop: -2,
    },
    sectionHeading: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    categoriesRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    categoryBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    categoryBtnActive: {
        backgroundColor: '#e11d48',
        borderColor: '#e11d48',
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    categoryTextActive: {
        color: '#ffffff',
    },
    productGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    productCard: {
        width: '48%',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
        marginBottom: 6,
    },
    imageWrapper: {
        width: '100%',
        height: SCREEN_HEIGHT < 700 ? 110 : 130,
        position: 'relative',
        backgroundColor: '#f8fafc',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    productBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingVertical: 3,
        paddingHorizontal: 6,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#e2e8f0',
    },
    badgeLabel: {
        fontSize: 7,
        fontWeight: '900',
        color: '#e11d48',
    },
    favBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productInfo: {
        padding: 12,
    },
    productName: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0f172a',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ratingValue: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
        marginLeft: 3,
    },
    dotSeparator: {
        fontSize: 8,
        color: '#94a3b8',
        marginHorizontal: 4,
    },
    deliveryTime: {
        fontSize: 9,
        color: '#10b981',
        fontWeight: '800',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    priceValue: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0f172a',
    },
    addBtn: {
        backgroundColor: '#e11d48',
        borderRadius: 10,
        paddingVertical: 5,
        paddingHorizontal: 12,
    },
    addBtnText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '900',
    },
});
