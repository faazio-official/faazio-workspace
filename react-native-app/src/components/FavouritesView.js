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
exports.default = FavouritesView;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var mockProducts_1 = require("../data/mockProducts");
var exploreData_1 = require("../data/exploreData");
var SCREEN_WIDTH = react_native_1.Dimensions.get('window').width;
function FavouritesView(_a) {
    var addToCart = _a.addToCart, onProductClick = _a.onProductClick, _b = _a.favorites, favorites = _b === void 0 ? [] : _b, toggleFavorite = _a.toggleFavorite;
    var _c = (0, react_1.useState)(null), addedItem = _c[0], setAddedItem = _c[1];
    var handleAddToCart = function (id, name, price, emoji) {
        addToCart(id, name, price, emoji);
        setAddedItem(id);
        setTimeout(function () {
            setAddedItem(null);
        }, 1200);
    };
    var getAllProducts = function () {
        var list = [];
        Object.entries(mockProducts_1.categoriesSearchDatabase).forEach(function (_a) {
            var catId = _a[0], items = _a[1];
            var app = 'MART';
            if (catId.startsWith('food-') || catId.startsWith('fd-'))
                app = 'FOOD';
            else if (catId.startsWith('groc-') || catId.startsWith('gr-'))
                app = 'GROCERY';
            else if (catId.startsWith('ph-'))
                app = 'PHARMA';
            items.forEach(function (item) {
                list.push(__assign(__assign({}, item), { app: app, catId: catId, catName: item.catName || catId, image: item.image || item.img }));
            });
        });
        exploreData_1.exploreStacks.forEach(function (stack) {
            stack.items.forEach(function (item) {
                list.push({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    rating: Number(item.rating),
                    emoji: item.emoji,
                    image: item.img,
                    desc: "Premium GenZ favorite curated from ".concat(item.shop, ". 100% genuine quality with lightning speed delivery."),
                    app: stack.type,
                    catId: stack.id,
                    catName: stack.title,
                    shop: item.shop,
                });
            });
        });
        return list;
    };
    var favoriteProducts = getAllProducts().filter(function (p) { return favorites.includes(p.id); });
    var categorized = {
        FOOD: favoriteProducts.filter(function (p) { return p.app === 'FOOD'; }),
        MART: favoriteProducts.filter(function (p) { return p.app === 'MART'; }),
        GROCERY: favoriteProducts.filter(function (p) { return p.app === 'GROCERY'; }),
        PHARMA: favoriteProducts.filter(function (p) { return p.app === 'PHARMA'; }),
    };
    var hasAnyFavorites = favoriteProducts.length > 0;
    var sectorStyles = {
        FOOD: {
            title: 'Food Delivery & Dining',
            emoji: '🍲',
            textColor: '#047857',
            borderColor: '#d1fae5',
            badgeBg: '#ecfdf5',
            badgeText: '#047857',
            btnBg: '#1E5D44',
            cardBg: '#f0fdf4',
        },
        MART: {
            title: 'Fashion, Tech & Lifestyle',
            emoji: '🛍️',
            textColor: '#1d4ed8',
            borderColor: '#dbeafe',
            badgeBg: '#eff6ff',
            badgeText: '#1d4ed8',
            btnBg: '#1162D3',
            cardBg: '#f0f9ff',
        },
        GROCERY: {
            title: 'Grocery & Fresh Essentials',
            emoji: '🍏',
            textColor: '#15803d',
            borderColor: '#dcfce7',
            badgeBg: '#f0fdf4',
            badgeText: '#15803d',
            btnBg: '#10B981',
            cardBg: '#f0fdf4',
        },
        PHARMA: {
            title: 'Pharma & Wellness Care',
            emoji: '💊',
            textColor: '#0f766e',
            borderColor: '#ccfbf1',
            badgeBg: '#f0fdfa',
            badgeText: '#0f766e',
            btnBg: '#065F46',
            cardBg: '#f0fdfa',
        },
    };
    return (<react_native_1.ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      
      {/* 1. Header Banner */}
      <react_native_1.View style={styles.headerBanner}>
        <react_native_1.View style={styles.headerBannerContent}>
          <react_native_1.View style={styles.wishlistBadge}>
            <react_native_1.Text style={styles.wishlistBadgeText}>Personal Wishlists</react_native_1.Text>
          </react_native_1.View>
          <react_native_1.Text style={styles.headerTitle}>My Curated Favourites</react_native_1.Text>
          <react_native_1.Text style={styles.headerDesc}>Your saved items categorized across active sub apps</react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      {/* 2. Categorized Sections */}
      {hasAnyFavorites ? (<react_native_1.View style={styles.sectionsList}>
          {Object.keys(categorized).map(function (key) {
                var items = categorized[key];
                if (items.length === 0)
                    return null;
                var style = sectorStyles[key];
                return (<react_native_1.View key={key} style={styles.sectorSection}>
                <react_native_1.View style={styles.sectorHeaderRow}>
                  <react_native_1.View style={styles.sectorTitleWrap}>
                    <react_native_1.Text style={styles.sectorEmoji}>{style.emoji}</react_native_1.Text>
                    <react_native_1.Text style={[styles.sectorTitle, { color: style.textColor }]}>
                      {style.title}
                    </react_native_1.Text>
                  </react_native_1.View>
                  <react_native_1.Text style={styles.sectorCount}>
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </react_native_1.Text>
                </react_native_1.View>

                <react_native_1.View style={styles.grid}>
                  {items.map(function (item) {
                        var isAdded = addedItem === item.id;
                        return (<react_native_1.View key={item.id} style={[styles.card, { backgroundColor: '#ffffff' }]}>
                        <react_native_1.TouchableOpacity onPress={function () { return onProductClick && onProductClick(item); }} style={styles.cardPressable} activeOpacity={0.9}>
                          <react_native_1.View style={styles.cardImgWrap}>
                            <react_native_1.Image source={{ uri: item.image }} style={styles.cardImg}/>
                            
                            <react_native_1.TouchableOpacity onPress={function () { return toggleFavorite(item.id); }} style={styles.heartBtn} activeOpacity={0.8}>
                              <lucide_react_native_1.Heart size={12} color="#f43f5e" fill="#f43f5e"/>
                            </react_native_1.TouchableOpacity>

                            <react_native_1.View style={styles.ratingOverlay}>
                              <react_native_1.Text style={styles.ratingText}>★ {item.rating}</react_native_1.Text>
                            </react_native_1.View>
                          </react_native_1.View>

                          <react_native_1.View style={styles.cardContent}>
                            <react_native_1.View style={styles.metaRow}>
                              <react_native_1.View style={[styles.appBadge, { backgroundColor: style.badgeBg }]}>
                                <react_native_1.Text style={[styles.appBadgeText, { color: style.badgeText }]}>{item.app}</react_native_1.Text>
                              </react_native_1.View>
                              {item.shop ? (<react_native_1.Text style={styles.shopName} numberOfLines={1}>
                                  {item.shop}
                                </react_native_1.Text>) : null}
                            </react_native_1.View>

                            <react_native_1.Text style={styles.productName} numberOfLines={1}>
                              {item.name}
                            </react_native_1.Text>
                            <react_native_1.Text style={styles.productDesc} numberOfLines={2}>
                              {item.desc || 'Premium curation from selected local stores.'}
                            </react_native_1.Text>
                          </react_native_1.View>
                        </react_native_1.TouchableOpacity>

                        <react_native_1.View style={styles.cardFooter}>
                          <react_native_1.Text style={styles.priceText}>₹{item.price.toLocaleString('en-IN')}</react_native_1.Text>
                          <react_native_1.TouchableOpacity onPress={function () { return handleAddToCart(item.id, item.name, item.price, item.emoji); }} style={[
                                styles.addBtn,
                                { backgroundColor: isAdded ? '#10b981' : style.btnBg },
                            ]} activeOpacity={0.8}>
                            <lucide_react_native_1.Plus size={8} color="#ffffff" style={{ marginRight: 2 }}/>
                            <react_native_1.Text style={styles.addBtnText}>{isAdded ? 'Added' : 'Add'}</react_native_1.Text>
                          </react_native_1.TouchableOpacity>
                        </react_native_1.View>
                      </react_native_1.View>);
                    })}
                </react_native_1.View>
              </react_native_1.View>);
            })}
        </react_native_1.View>) : (
        /* Empty State */
        <react_native_1.View style={styles.emptyCard}>
          <react_native_1.View style={styles.emptyIconCircle}>
            <lucide_react_native_1.Heart size={28} color="#f43f5e"/>
          </react_native_1.View>
          <react_native_1.Text style={styles.emptyTitle}>No Favourites Yet</react_native_1.Text>
          <react_native_1.Text style={styles.emptyDesc}>
            Tap the heart icon on any product in our categories or explore feeds to add them to your curated shortlist here!
          </react_native_1.Text>
        </react_native_1.View>)}

    </react_native_1.ScrollView>);
}
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    headerBanner: {
        backgroundColor: '#0f172a',
        borderRadius: 24,
        padding: 16,
        marginTop: 14,
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
    },
    headerBannerContent: {
        zIndex: 1,
    },
    wishlistBadge: {
        backgroundColor: 'rgba(255, 74, 107, 0.15)',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 74, 107, 0.2)',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    wishlistBadgeText: {
        fontSize: 7.5,
        color: '#FF4A6B',
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#ffffff',
        textTransform: 'uppercase',
    },
    headerDesc: {
        fontSize: 9.5,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 4,
    },
    sectionsList: {
        width: '100%',
    },
    sectorSection: {
        marginBottom: 16,
    },
    sectorHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 6,
        marginBottom: 10,
    },
    sectorTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectorEmoji: {
        fontSize: 12,
        marginRight: 6,
    },
    sectorTitle: {
        fontSize: 10.5,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    sectorCount: {
        fontSize: 9,
        color: '#94a3b8',
        fontWeight: '700',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
    },
    card: {
        width: '48%',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
    },
    cardPressable: {
        flexDirection: 'column',
    },
    cardImgWrap: {
        width: '100%',
        height: 110,
        position: 'relative',
        backgroundColor: '#f8fafc',
    },
    cardImg: {
        width: '100%',
        height: '100%',
    },
    heartBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255,255,255,0.95)',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    ratingOverlay: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    ratingText: {
        color: '#ffffff',
        fontSize: 7,
        fontWeight: '900',
    },
    cardContent: {
        padding: 10,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    appBadge: {
        paddingVertical: 1,
        paddingHorizontal: 4,
        borderRadius: 4,
    },
    appBadgeText: {
        fontSize: 6,
        fontWeight: '900',
    },
    shopName: {
        fontSize: 7.5,
        color: '#94a3b8',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    productName: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 4,
    },
    productDesc: {
        fontSize: 7.5,
        color: '#94a3b8',
        fontWeight: '500',
        marginTop: 2,
        lineHeight: 10,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    priceText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#0f172a',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    addBtnText: {
        color: '#ffffff',
        fontSize: 7,
        fontWeight: '900',
    },
    emptyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        paddingVertical: 40,
        paddingHorizontal: 16,
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
    },
    emptyIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#fff1f2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
    },
    emptyDesc: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 14,
        paddingHorizontal: 20,
    },
});
