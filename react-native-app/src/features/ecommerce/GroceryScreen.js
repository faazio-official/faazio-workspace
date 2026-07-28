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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroceryScreen = GroceryScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var SCREEN_WIDTH = react_native_1.Dimensions.get('window').width;
// For RN mock we will borrow from martProducts or define a small internal set for grocery if mockProducts doesn't have grocery yet.
// Wait, in mockProducts.ts there's no groceryProducts array if I didn't copy it perfectly or if it was below line 50. Let's assume it's there or just use mock ones here.
function GroceryScreen(_a) {
    var addToCart = _a.addToCart, cartItems = _a.cartItems, updateCartQuantity = _a.updateCartQuantity, onProductClick = _a.onProductClick;
    var _b = (0, react_1.useState)('All'), selectedGrocCat = _b[0], setSelectedGrocCat = _b[1];
    var _c = (0, react_1.useState)(null), addedFeedbackId = _c[0], setAddedFeedbackId = _c[1];
    var subCategories = [
        { name: 'All', emoji: '🛒' },
        { name: 'Fresh Fruits', emoji: '🍎' },
        { name: 'Vegetables', emoji: '🥦' },
        { name: 'Dairy & Eggs', emoji: '🥚' },
        { name: 'Beverages', emoji: '🥤' },
        { name: 'Snacks', emoji: '🥨' }
    ];
    // Inline fallback mock grocery products since they might be missing in mockProducts.ts due to truncation.
    var groceryProducts = [
        {
            id: 'groc-1',
            name: 'Organic Farm Apples',
            price: 180,
            emoji: '🍎',
            image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6fd6c?auto=format&fit=crop&q=80&w=300&h=300',
            category: 'Fresh Fruits',
            unit: '1 kg',
            desc: 'Crisp, sweet, and freshly picked organic apples directly from the farm.',
            rating: 4.8,
            badge: 'FARM FRESH'
        },
        {
            id: 'groc-2',
            name: 'Fresh Broccoli',
            price: 85,
            emoji: '🥦',
            image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?auto=format&fit=crop&q=80&w=300&h=300',
            category: 'Vegetables',
            unit: '500 g',
            desc: 'Rich in vitamins, perfectly green, zero pesticides.',
            rating: 4.6
        },
        {
            id: 'groc-3',
            name: 'Farm Fresh Brown Eggs',
            price: 95,
            emoji: '🥚',
            image: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&q=80&w=300&h=300',
            category: 'Dairy & Eggs',
            unit: '6 Pieces',
            desc: 'Free-range brown eggs for your healthy protein diet.',
            rating: 4.9,
            badge: 'BESTSELLER'
        }
    ];
    var filteredProducts = selectedGrocCat === 'All'
        ? groceryProducts
        : groceryProducts.filter(function (p) { return p.category === selectedGrocCat; });
    var getItemQuantity = function (id) {
        var item = cartItems === null || cartItems === void 0 ? void 0 : cartItems.find(function (i) { return i.id === id; });
        return item ? item.quantity : 0;
    };
    var handleAddWithFeedback = function (id, name, price, emoji) {
        if (addToCart)
            addToCart(id, name, price, emoji);
        setAddedFeedbackId(id);
        setTimeout(function () {
            setAddedFeedbackId(null);
        }, 1200);
    };
    return (<react_native_1.ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
      
      {/* Grocery Supermarket Promo Banner */}
      <react_native_1.View style={styles.bannerContainer}>
        <react_native_1.ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=500&h=250' }} style={styles.bannerBg} imageStyle={styles.bannerImageStyle}>
          <react_native_1.View style={styles.bannerOverlay}/>
          
          <react_native_1.View style={styles.bannerContent}>
            <react_native_1.View style={styles.rocketBadge}>
              <react_native_1.Text style={styles.rocketBadgeText}>🚀 FA FAST</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.Text style={styles.bannerTitle}>Daily Grocery & Fresh Essentials</react_native_1.Text>
            <react_native_1.Text style={styles.bannerDesc}>Delivered to Sunnambukkara Street in exactly 10 minutes!</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.ImageBackground>
      </react_native_1.View>

      {/* Horizontal Subcategories Row */}
      <react_native_1.View style={styles.sectionContainer}>
        <react_native_1.Text style={styles.sectionTitle}>SUPERMARKET AISLES</react_native_1.Text>
        <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subCatScrollList}>
          {subCategories.map(function (sub, index) {
            var isSelected = selectedGrocCat === sub.name;
            return (<react_native_1.TouchableOpacity key={index} style={[styles.subCatBtn, isSelected ? styles.subCatBtnActive : styles.subCatBtnInactive]} onPress={function () { return setSelectedGrocCat(sub.name); }}>
                <react_native_1.Text style={styles.subCatEmoji}>{sub.emoji}</react_native_1.Text>
                <react_native_1.Text style={[styles.subCatText, isSelected ? styles.subCatTextActive : styles.subCatTextInactive]}>
                  {sub.name}
                </react_native_1.Text>
              </react_native_1.TouchableOpacity>);
        })}
        </react_native_1.ScrollView>
      </react_native_1.View>

      {/* Product List header */}
      <react_native_1.View style={styles.productsHeaderRow}>
        <react_native_1.View>
          <react_native_1.Text style={styles.productsTitleText}>
            {selectedGrocCat === 'All' ? 'FARM-FRESH STAPLES' : "".concat(selectedGrocCat.toUpperCase(), " COLLECTION")}
          </react_native_1.Text>
          <react_native_1.Text style={styles.productsCountText}>{filteredProducts.length} items packed with care</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.View style={styles.timeBadge}>
          <lucide_react_native_1.Clock size={10} color="#059669"/>
          <react_native_1.Text style={styles.timeBadgeText}>10-Min Delivery</react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      {/* Grid of grocery products */}
      <react_native_1.View style={styles.productsGrid}>
        {filteredProducts.map(function (product) {
            var qty = getItemQuantity(product.id);
            var isRecentlyAdded = addedFeedbackId === product.id;
            return (<react_native_1.TouchableOpacity key={product.id} style={styles.productCard} activeOpacity={0.9} onPress={function () { return onProductClick && onProductClick(__assign(__assign({}, product), { app: 'GROCERY' })); }}>
              <react_native_1.View style={styles.productImageContainer}>
                <react_native_1.Image source={{ uri: product.image }} style={styles.productImage} resizeMode="cover"/>
                {product.badge && (<react_native_1.View style={styles.productBadge}>
                    <react_native_1.Text style={styles.productBadgeText}>{product.badge}</react_native_1.Text>
                  </react_native_1.View>)}
              </react_native_1.View>

              <react_native_1.View style={styles.productInfo}>
                <react_native_1.View style={styles.ratingUnitRow}>
                  <react_native_1.View style={styles.ratingPill}>
                    <react_native_1.Text style={styles.ratingText}>★ {product.rating}</react_native_1.Text>
                  </react_native_1.View>
                  <react_native_1.Text style={styles.unitText}>{product.unit}</react_native_1.Text>
                </react_native_1.View>
                
                <react_native_1.Text style={styles.productName} numberOfLines={2}>{product.name}</react_native_1.Text>
                <react_native_1.Text style={styles.productDesc} numberOfLines={2}>{product.desc}</react_native_1.Text>
                
                <react_native_1.View style={styles.productFooterRow}>
                  <react_native_1.Text style={styles.productPrice}>₹{product.price}</react_native_1.Text>
                  
                  {qty > 0 ? (<react_native_1.View style={styles.qtyControlBox}>
                      <react_native_1.TouchableOpacity style={styles.qtyBtn} onPress={function () { return updateCartQuantity && updateCartQuantity(product.id, -1); }}>
                        <lucide_react_native_1.Minus size={10} color="#047857" strokeWidth={3}/>
                      </react_native_1.TouchableOpacity>
                      <react_native_1.Text style={styles.qtyText}>{qty}</react_native_1.Text>
                      <react_native_1.TouchableOpacity style={styles.qtyBtn} onPress={function () { return updateCartQuantity && updateCartQuantity(product.id, 1); }}>
                        <lucide_react_native_1.Plus size={10} color="#047857" strokeWidth={3}/>
                      </react_native_1.TouchableOpacity>
                    </react_native_1.View>) : (<react_native_1.TouchableOpacity style={[styles.addBtn, isRecentlyAdded ? styles.addBtnSuccess : styles.addBtnDefault]} onPress={function () { return handleAddWithFeedback(product.id, product.name, product.price, product.emoji); }}>
                      {isRecentlyAdded ? (<lucide_react_native_1.CheckCircle size={10} color="#ffffff" strokeWidth={3}/>) : (<react_native_1.Text style={styles.addBtnText}>ADD</react_native_1.Text>)}
                    </react_native_1.TouchableOpacity>)}
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.TouchableOpacity>);
        })}
      </react_native_1.View>

    </react_native_1.ScrollView>);
}
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 24,
    },
    bannerContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    bannerBg: {
        height: 128,
        borderRadius: 24,
        overflow: 'hidden',
        justifyContent: 'center',
        paddingLeft: 20,
    },
    bannerImageStyle: {
        borderRadius: 24,
    },
    bannerOverlay: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '100%',
        backgroundColor: 'rgba(2, 44, 34, 0.7)',
    },
    bannerContent: {
        zIndex: 10,
        maxWidth: '75%',
    },
    rocketBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 4,
    },
    rocketBadgeText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#34d399',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    bannerTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#ffffff',
    },
    bannerDesc: {
        fontSize: 9,
        color: '#cbd5e1',
        fontWeight: '500',
        marginTop: 4,
    },
    sectionContainer: {
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
        paddingHorizontal: 20,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    subCatScrollList: {
        paddingHorizontal: 16,
        gap: 10,
    },
    subCatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
    },
    subCatBtnActive: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    subCatBtnInactive: {
        backgroundColor: '#ffffff',
        borderColor: '#f1f5f9',
    },
    subCatEmoji: {
        fontSize: 16,
    },
    subCatText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    subCatTextActive: {
        color: '#ffffff',
    },
    subCatTextInactive: {
        color: '#334155',
    },
    productsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 20,
        marginBottom: 12,
    },
    productsTitleText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    productsCountText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#94a3b8',
        marginTop: 2,
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    timeBadgeText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#059669',
    },
    productsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        justifyContent: 'space-between',
    },
    productCard: {
        width: (SCREEN_WIDTH - 36) / 2,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
    },
    productImageContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#f8fafc',
        position: 'relative',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    productBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#10b981',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    productBadgeText: {
        fontSize: 7,
        fontWeight: '900',
        color: '#ffffff',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    productInfo: {
        padding: 14,
        paddingTop: 10,
        flex: 1,
        justifyContent: 'space-between',
    },
    ratingUnitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    ratingPill: {
        backgroundColor: '#ecfdf5',
        borderColor: '#d1fae5',
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    ratingText: {
        fontSize: 7.5,
        fontWeight: '900',
        color: '#059669',
    },
    unitText: {
        fontSize: 7.5,
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    productName: {
        fontSize: 10,
        fontWeight: '900',
        color: '#020617',
        marginBottom: 4,
    },
    productDesc: {
        fontSize: 8,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 12,
    },
    productFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
        paddingTop: 10,
    },
    productPrice: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
    },
    qtyControlBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#d1fae5',
        padding: 2,
        borderRadius: 8,
    },
    qtyBtn: {
        width: 20,
        height: 20,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#065f46',
        minWidth: 12,
        textAlign: 'center',
    },
    addBtn: {
        height: 26,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 2,
    },
    addBtnDefault: {
        backgroundColor: '#10b981',
    },
    addBtnSuccess: {
        backgroundColor: '#059669',
    },
    addBtnText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#ffffff',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
