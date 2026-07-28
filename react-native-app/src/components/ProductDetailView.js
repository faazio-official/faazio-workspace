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
exports.default = ProductDetailView;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var _a = react_native_1.Dimensions.get('window'), SCREEN_HEIGHT = _a.height, SCREEN_WIDTH = _a.width;
function getEnhancedProductDetails(item) {
    var isFood = item.app === 'FOOD' || item.id.startsWith('cat-fm') || item.id.startsWith('cat-fs') || item.id.startsWith('cat-fd') || item.id.startsWith('tow');
    var isMart = item.app === 'MART' || item.id.startsWith('cat-mt') || item.id.startsWith('cat-mf') || item.id.startsWith('cat-ml');
    var isGrocery = item.app === 'GROCERY' || item.id.startsWith('cat-gg') || item.id.startsWith('cat-gs') || item.id.startsWith('cat-gd') || item.id.startsWith('gr-');
    var isPharma = item.app === 'PHARMA' || item.id.startsWith('cat-pw') || item.id.startsWith('cat-ps') || item.id.startsWith('cat-pb') || item.id.startsWith('ph-');
    var detectedApp = 'MART';
    if (isFood)
        detectedApp = 'FOOD';
    else if (isGrocery)
        detectedApp = 'GROCERY';
    else if (isPharma)
        detectedApp = 'PHARMA';
    var specs = [];
    if (detectedApp === 'FOOD') {
        specs = [
            { label: 'Prep Time', value: '15-20 Mins' },
            { label: 'Dietary', value: item.name.toLowerCase().includes('chicken') || item.name.toLowerCase().includes('mutton') ? 'Non-Veg' : '100% Vegetarian' },
            { label: 'Serving Size', value: 'Ideal for 1-2' },
            { label: 'Spiciness', value: item.name.toLowerCase().includes('spicy') || item.name.toLowerCase().includes('sriracha') ? '🔥 High' : 'Medium' }
        ];
    }
    else if (detectedApp === 'MART') {
        specs = [
            { label: 'Warranty', value: '1 Year Brand Warranty' },
            { label: 'Return Policy', value: '7 Days Replacement' },
            { label: 'Shipping', value: 'Same Day Delivery' },
            { label: 'Condition', value: '100% Genuine Sealed' }
        ];
    }
    else if (detectedApp === 'GROCERY') {
        specs = [
            { label: 'Shelf Life', value: 'Fresh (2-5 Days)' },
            { label: 'Source', value: 'Hydroponic Local Farm' },
            { label: 'Organic', value: 'Yes, certified organic' },
            { label: 'Storage', value: 'Keep refrigerated' }
        ];
    }
    else {
        specs = [
            { label: 'Dosage Form', value: item.name.toLowerCase().includes('gummies') ? 'Gummy Chews' : 'Standard Formula' },
            { label: 'Prescription', value: 'Not Required' },
            { label: 'Pack Size', value: 'Standard Consumer Pack' },
            { label: 'Safety', value: 'FDA compliant, certified' }
        ];
    }
    var reviews = [];
    if (detectedApp === 'FOOD') {
        reviews = [
            { id: 'rev-f1', user: 'Aarav Sharma', rating: 5, comment: 'Absolutely mouthwatering! Arrived piping hot, packaging was pristine. Definitely ordering again.', date: 'Today' },
            { id: 'rev-f2', user: 'Priya Patel', rating: 4, comment: 'Excellent flavor and rich taste. Portion size was very generous. Slightly spicy but incredible.', date: 'Yesterday' }
        ];
    }
    else if (detectedApp === 'MART') {
        reviews = [
            { id: 'rev-m1', user: 'Rohan Mehra', rating: 5, comment: 'Premium build quality. Exceeded expectations! Sleek design and works flawlessly.', date: 'Yesterday' },
            { id: 'rev-m2', user: 'Ananya Rao', rating: 5, comment: 'Super fast delivery by Faazio. Item looks beautiful, absolute value for money.', date: '2 days ago' }
        ];
    }
    else if (detectedApp === 'GROCERY') {
        reviews = [
            { id: 'rev-g1', user: 'Meera Nair', rating: 5, comment: 'Unbelievably fresh, looks like it was harvested this morning. Will buy weekly!', date: 'Today' },
            { id: 'rev-g2', user: 'Arjun Verma', rating: 5, comment: 'Premium quality produce. Safely packed and prompt delivery inside 15 minutes!', date: 'Yesterday' }
        ];
    }
    else {
        reviews = [
            { id: 'rev-p1', user: 'Dr. Sarah Alvi', rating: 5, comment: 'Excellent formula. Highly effective with very safe clinical benchmarks. Recommended.', date: 'Yesterday' },
            { id: 'rev-p2', user: 'Rajesh G.', rating: 5, comment: 'Great packaging and genuine seal. Very convenient to order via Faazio Pharma.', date: '4 days ago' }
        ];
    }
    var highlights = [];
    if (detectedApp === 'FOOD') {
        highlights = [
            'Freshly prepared on order by vetted gourmet chefs',
            'Hygiene-rated Grade A kitchen preparation standards',
            'Insulated thermal-bag delivery to retain kitchen-hot state',
            'No added preservatives, MSG, or artificial coloring agents'
        ];
    }
    else if (detectedApp === 'MART') {
        highlights = [
            '100% original manufacturer seal & retail carton',
            'Eligible for brand warranty assistance & registration',
            'Secured transit insurance protection from warehouse to doorstep',
            'Verified zero-defect QC pass checklist certified'
        ];
    }
    else if (detectedApp === 'GROCERY') {
        highlights = [
            'Ethically sourced from local pesticide-free farms',
            'Chilled-crate supply chain preserving maximum nutrient density',
            'Eco-friendly biodegradable and breathable paper pack bag',
            'Rigorous triple-wash hygiene checklist compliance'
        ];
    }
    else {
        highlights = [
            'Double-sealed pharmaceutical integrity packing standard',
            'Vetted storage under temperature-regulated environment',
            'Sourced exclusively from WHO-GMP certified clinical partners',
            'Complimentary consultation assistance on dosage from specialists'
        ];
    }
    return { specs: specs, reviews: reviews, highlights: highlights, app: detectedApp };
}
function ProductDetailView(_a) {
    var product = _a.product, onClose = _a.onClose, addToCart = _a.addToCart, cartItems = _a.cartItems, updateCartQuantity = _a.updateCartQuantity, _b = _a.favorites, favorites = _b === void 0 ? [] : _b, toggleFavorite = _a.toggleFavorite;
    var isFavorite = favorites.includes(product.id);
    var handleToggleFavorite = function () {
        if (toggleFavorite) {
            toggleFavorite(product.id);
        }
    };
    var _c = (0, react_1.useState)({}), helpfulCounts = _c[0], setHelpfulCounts = _c[1];
    var _d = (0, react_1.useState)({}), likedReviews = _d[0], setLikedReviews = _d[1];
    var _e = getEnhancedProductDetails(product), specs = _e.specs, reviews = _e.reviews, highlights = _e.highlights, app = _e.app;
    var cartItem = cartItems.find(function (item) { return item.id === product.id; });
    var currentQuantity = cartItem ? cartItem.quantity : 0;
    var brandStyles = {
        FOOD: {
            accent: '#1e293b',
            bgColorGradient: '#f0fdf4',
            badgeBg: '#ecfdf5',
            badgeText: '#047857',
            badgeBorder: '#d1fae5',
            btnBg: '#1E5D44',
        },
        MART: {
            accent: '#1e293b',
            bgColorGradient: '#f0f9ff',
            badgeBg: '#eff6ff',
            badgeText: '#1d4ed8',
            badgeBorder: '#dbeafe',
            btnBg: '#1162D3',
        },
        GROCERY: {
            accent: '#1e293b',
            bgColorGradient: '#f0fdf4',
            badgeBg: '#f0fdf4',
            badgeText: '#15803d',
            badgeBorder: '#dcfce7',
            btnBg: '#10B981',
        },
        PHARMA: {
            accent: '#1e293b',
            bgColorGradient: '#f0fdfa',
            badgeBg: '#f0fdfa',
            badgeText: '#0f766e',
            badgeBorder: '#ccfbf1',
            btnBg: '#065F46',
        },
    }[app];
    var handleHelpfulToggle = function (reviewId) {
        if (likedReviews[reviewId]) {
            setHelpfulCounts(function (prev) {
                var _a;
                return (__assign(__assign({}, prev), (_a = {}, _a[reviewId] = (prev[reviewId] || 0) - 1, _a)));
            });
            setLikedReviews(function (prev) {
                var _a;
                return (__assign(__assign({}, prev), (_a = {}, _a[reviewId] = false, _a)));
            });
        }
        else {
            setHelpfulCounts(function (prev) {
                var _a;
                return (__assign(__assign({}, prev), (_a = {}, _a[reviewId] = (prev[reviewId] || 0) + 1, _a)));
            });
            setLikedReviews(function (prev) {
                var _a;
                return (__assign(__assign({}, prev), (_a = {}, _a[reviewId] = true, _a)));
            });
        }
    };
    return (<react_native_1.Modal visible animationType="slide" transparent>
      <react_native_1.View style={styles.modalOverlay}>
        <react_native_1.View style={styles.sheetContainer}>
          
          {/* Header Row */}
          <react_native_1.View style={styles.navBar}>
            <react_native_1.TouchableOpacity onPress={onClose} style={styles.navBtn} activeOpacity={0.8}>
              <lucide_react_native_1.X size={16} color="#0f172a"/>
            </react_native_1.TouchableOpacity>

            <react_native_1.View style={styles.navBarRight}>
              <react_native_1.TouchableOpacity style={styles.navBtn} activeOpacity={0.8}>
                <lucide_react_native_1.Share2 size={14} color="#64748b"/>
              </react_native_1.TouchableOpacity>
              <react_native_1.TouchableOpacity onPress={handleToggleFavorite} style={styles.navBtn} activeOpacity={0.8}>
                <lucide_react_native_1.Heart size={14} color={isFavorite ? '#f43f5e' : '#64748b'} fill={isFavorite ? '#f43f5e' : 'none'}/>
              </react_native_1.TouchableOpacity>
            </react_native_1.View>
          </react_native_1.View>

          {/* Scrollable Contents */}
          <react_native_1.ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {/* 1. Hero visual with backdrop gradient */}
            <react_native_1.View style={[styles.heroArea, { backgroundColor: brandStyles.bgColorGradient }]}>
              <react_native_1.View style={styles.emojiOuterRing}>
                <react_native_1.Text style={styles.emojiHero}>{product.emoji}</react_native_1.Text>
                <react_native_1.View style={styles.ratingStarsOverlay}>
                  <react_native_1.Text style={styles.ratingStarsText}>★ {product.rating}</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              <react_native_1.View style={styles.deliverySpeedTag}>
                <lucide_react_native_1.Truck size={10} color="#7CE045" style={{ marginRight: 4 }}/>
                <react_native_1.Text style={styles.deliverySpeedText}>DELIVERS IN 12-15 MINS</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            {/* 2. Product title and metadata */}
            <react_native_1.View style={styles.metaPaddingBox}>
              <react_native_1.View style={styles.metaRow}>
                <react_native_1.View style={[styles.appBadge, { backgroundColor: brandStyles.badgeBg, borderColor: brandStyles.badgeBorder }]}>
                  <react_native_1.Text style={[styles.appBadgeText, { color: brandStyles.badgeText }]}>{app}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.Text style={styles.catNameText}>
                  {product.catName || product.category || 'Premium Pick'}
                </react_native_1.Text>
              </react_native_1.View>

              <react_native_1.View style={styles.titlePriceRow}>
                <react_native_1.Text style={styles.productNameText} numberOfLines={2}>{product.name}</react_native_1.Text>
                <react_native_1.View style={styles.priceColumn}>
                  <react_native_1.Text style={styles.priceValueText}>₹{product.price.toLocaleString('en-IN')}</react_native_1.Text>
                  <react_native_1.Text style={styles.taxLabel}>Incl. of taxes</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              <react_native_1.Text style={styles.productDescText}>{product.desc}</react_native_1.Text>

              {/* Highlights list */}
              <react_native_1.View style={styles.highlightsContainer}>
                <react_native_1.Text style={styles.sectionHeadingText}>Key Highlights</react_native_1.Text>
                {highlights.map(function (hlt, idx) { return (<react_native_1.View key={idx} style={styles.highlightRow}>
                    <react_native_1.View style={styles.bulletCheckCircle}>
                      <react_native_1.Text style={styles.bulletCheckText}>✓</react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.Text style={styles.highlightText}>{hlt}</react_native_1.Text>
                  </react_native_1.View>); })}
              </react_native_1.View>

              {/* Dynamic Bank Offer */}
              <react_native_1.View style={styles.promoBanner}>
                <react_native_1.Text style={styles.promoEmoji}>🏷️</react_native_1.Text>
                <react_native_1.View style={styles.promoContentCol}>
                  <react_native_1.Text style={styles.promoTitle}>EXCLUSIVE BANK OFFER</react_native_1.Text>
                  <react_native_1.Text style={styles.promoDesc}>
                    Get extra 10% cashback up to ₹250 on UPI or OneCard payments. Auto-applied during checkout!
                  </react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              {/* Guarantees row */}
              <react_native_1.View style={styles.guaranteeGrid}>
                <react_native_1.View style={styles.guaranteeBox}>
                  <lucide_react_native_1.ShieldCheck size={14} color="#10b981"/>
                  <react_native_1.View style={styles.guaranteeTextCol}>
                    <react_native_1.Text style={styles.guaranteeHeading}>Quality Verified</react_native_1.Text>
                    <react_native_1.Text style={styles.guaranteeSub}>100% genuine product</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>

                <react_native_1.View style={styles.guaranteeBox}>
                  <lucide_react_native_1.RotateCcw size={14} color="#3b82f6"/>
                  <react_native_1.View style={styles.guaranteeTextCol}>
                    <react_native_1.Text style={styles.guaranteeHeading}>Hassle-Free Returns</react_native_1.Text>
                    <react_native_1.Text style={styles.guaranteeSub}>Complimentary replacement</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.View>

            {/* 3. Specifications */}
            <react_native_1.View style={styles.specificationsBox}>
              <react_native_1.View style={styles.specHeaderRow}>
                <lucide_react_native_1.Info size={11} color="#94a3b8" style={{ marginRight: 6 }}/>
                <react_native_1.Text style={styles.sectionHeadingText}>Product Specifications</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.specsGrid}>
                {specs.map(function (spec, idx) { return (<react_native_1.View key={idx} style={styles.specCard}>
                    <react_native_1.Text style={styles.specLabel}>{spec.label}</react_native_1.Text>
                    <react_native_1.Text style={styles.specValue}>{spec.value}</react_native_1.Text>
                  </react_native_1.View>); })}
              </react_native_1.View>
            </react_native_1.View>

            {/* 4. Reviews section */}
            <react_native_1.View style={styles.reviewsBox}>
              <react_native_1.View style={styles.reviewsHeaderRow}>
                <react_native_1.Text style={styles.sectionHeadingText}>Customer Reviews ({reviews.length})</react_native_1.Text>
                <react_native_1.View style={styles.reviewsAvgBadge}>
                  <react_native_1.Text style={styles.reviewsAvgText}>★ {product.rating} Average</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              {/* Progress bars block */}
              <react_native_1.View style={styles.reviewProgressCard}>
                <react_native_1.View style={styles.reviewProgressRow}>
                  <react_native_1.Text style={styles.progressLabel}>5 Star</react_native_1.Text>
                  <react_native_1.View style={styles.progressBarBg}>
                    <react_native_1.View style={[styles.progressBarFill, { width: '88%', backgroundColor: '#f59e0b' }]}/>
                  </react_native_1.View>
                  <react_native_1.Text style={styles.progressPercent}>88%</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.reviewProgressRow}>
                  <react_native_1.Text style={styles.progressLabel}>4 Star</react_native_1.Text>
                  <react_native_1.View style={styles.progressBarBg}>
                    <react_native_1.View style={[styles.progressBarFill, { width: '10%', backgroundColor: '#f59e0b' }]}/>
                  </react_native_1.View>
                  <react_native_1.Text style={styles.progressPercent}>10%</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.reviewProgressRow}>
                  <react_native_1.Text style={styles.progressLabel}>3 Star</react_native_1.Text>
                  <react_native_1.View style={styles.progressBarBg}>
                    <react_native_1.View style={[styles.progressBarFill, { width: '2%', backgroundColor: '#f59e0b' }]}/>
                  </react_native_1.View>
                  <react_native_1.Text style={styles.progressPercent}>2%</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              {/* Individual Reviews list */}
              <react_native_1.View style={styles.reviewsList}>
                {reviews.map(function (rev) {
            var liked = likedReviews[rev.id];
            return (<react_native_1.View key={rev.id} style={styles.reviewRow}>
                      <react_native_1.View style={styles.reviewUserHeader}>
                        <react_native_1.View style={styles.reviewUserLeft}>
                          <react_native_1.View style={styles.reviewUserPlaceholderCircle}>
                            <react_native_1.Text style={styles.reviewUserPlaceholderText}>{rev.user.charAt(0)}</react_native_1.Text>
                          </react_native_1.View>
                          <react_native_1.View style={{ marginLeft: 8 }}>
                            <react_native_1.Text style={styles.reviewUserName}>{rev.user}</react_native_1.Text>
                            <react_native_1.Text style={styles.reviewUserDate}>{rev.date}</react_native_1.Text>
                          </react_native_1.View>
                        </react_native_1.View>
                        <react_native_1.View style={styles.starsRow}>
                          {__spreadArray([], Array(5), true).map(function (_, i) { return (<lucide_react_native_1.Star key={i} size={8.5} color={i < rev.rating ? '#f59e0b' : '#cbd5e1'} fill={i < rev.rating ? '#f59e0b' : 'none'}/>); })}
                        </react_native_1.View>
                      </react_native_1.View>

                      <react_native_1.Text style={styles.reviewComment}>"{rev.comment}"</react_native_1.Text>

                      <react_native_1.View style={styles.reviewFooterRow}>
                        <react_native_1.TouchableOpacity onPress={function () { return handleHelpfulToggle(rev.id); }} style={[styles.helpfulBtn, liked ? styles.helpfulBtnLiked : null]} activeOpacity={0.8}>
                          <lucide_react_native_1.ThumbsUp size={10} color={liked ? '#10b981' : '#64748b'} fill={liked ? '#10b981' : 'none'} style={{ marginRight: 4 }}/>
                          <react_native_1.Text style={[styles.helpfulText, liked ? { color: '#10b981' } : null]}>Helpful ({12 + (helpfulCounts[rev.id] || 0)})</react_native_1.Text>
                        </react_native_1.TouchableOpacity>

                        <react_native_1.View style={styles.verifiedPurchaseRow}>
                          <lucide_react_native_1.ShieldCheck size={9} color="#10b981" style={{ marginRight: 2 }}/>
                          <react_native_1.Text style={styles.verifiedPurchaseText}>Verified Purchase</react_native_1.Text>
                        </react_native_1.View>
                      </react_native_1.View>
                    </react_native_1.View>);
        })}
              </react_native_1.View>
            </react_native_1.View>

          </react_native_1.ScrollView>

          {/* Sticky Bottom Action bar */}
          <react_native_1.View style={styles.stickyFooter}>
            <react_native_1.View>
              <react_native_1.Text style={styles.footerPriceLabel}>Total Price</react_native_1.Text>
              <react_native_1.Text style={styles.footerPriceValue}>
                ₹{(product.price * (currentQuantity || 1)).toLocaleString('en-IN')}
              </react_native_1.Text>
            </react_native_1.View>

            {currentQuantity === 0 ? (<react_native_1.TouchableOpacity onPress={function () { return addToCart(product.id, product.name, product.price, product.emoji); }} style={[styles.addToCartBtn, { backgroundColor: brandStyles.btnBg }]} activeOpacity={0.8}>
                <lucide_react_native_1.Plus size={12} color="#ffffff" style={{ marginRight: 4 }}/>
                <react_native_1.Text style={styles.addToCartBtnText}>Add to Bag</react_native_1.Text>
              </react_native_1.TouchableOpacity>) : (<react_native_1.View style={styles.footerQuantityWidget}>
                <react_native_1.TouchableOpacity onPress={function () { return updateCartQuantity(product.id, -1); }} style={styles.footerQtyBtn} activeOpacity={0.8}>
                  <lucide_react_native_1.Minus size={12} color="#0f172a"/>
                </react_native_1.TouchableOpacity>
                <react_native_1.Text style={styles.footerQtyValue}>{currentQuantity}</react_native_1.Text>
                <react_native_1.TouchableOpacity onPress={function () { return updateCartQuantity(product.id, 1); }} style={styles.footerQtyBtn} activeOpacity={0.8}>
                  <lucide_react_native_1.Plus size={12} color="#0f172a"/>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>)}
          </react_native_1.View>

        </react_native_1.View>
      </react_native_1.View>
    </react_native_1.Modal>);
}
var styles = react_native_1.StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#ffffff',
        width: '100%',
        height: SCREEN_HEIGHT * 0.9,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        overflow: 'hidden',
        position: 'relative',
    },
    navBar: {
        position: 'absolute',
        top: 14,
        left: 16,
        right: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    navBarRight: {
        flexDirection: 'row',
        gap: 8,
    },
    navBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    heroArea: {
        height: SCREEN_HEIGHT * 0.3,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    emojiOuterRing: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 2,
        position: 'relative',
    },
    emojiHero: {
        fontSize: 54,
    },
    ratingStarsOverlay: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: '#f59e0b',
        borderRadius: 8,
        paddingVertical: 2,
        paddingHorizontal: 6,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    ratingStarsText: {
        color: '#ffffff',
        fontSize: 7.5,
        fontWeight: '900',
    },
    deliverySpeedTag: {
        position: 'absolute',
        bottom: 12,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    deliverySpeedText: {
        color: '#ffffff',
        fontSize: 7,
        fontWeight: '900',
    },
    metaPaddingBox: {
        padding: 16,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    appBadge: {
        borderWidth: 0.5,
        borderRadius: 6,
        paddingVertical: 2,
        paddingHorizontal: 6,
    },
    appBadgeText: {
        fontSize: 7.5,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    catNameText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
    },
    titlePriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 8,
    },
    productNameText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
        flex: 1,
    },
    priceColumn: {
        alignItems: 'flex-end',
    },
    priceValueText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
    },
    taxLabel: {
        fontSize: 7.5,
        fontWeight: '900',
        color: '#10b981',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    productDescText: {
        fontSize: 9.5,
        color: '#64748b',
        fontWeight: '600',
        lineHeight: 14,
        marginBottom: 16,
    },
    highlightsContainer: {
        borderTopWidth: 0.5,
        borderTopColor: '#f1f5f9',
        paddingTop: 12,
        marginBottom: 16,
    },
    sectionHeadingText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    highlightRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    bulletCheckCircle: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ecfdf5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
        marginTop: 2,
    },
    bulletCheckText: {
        color: '#10b981',
        fontSize: 7.5,
        fontWeight: '900',
    },
    highlightText: {
        fontSize: 9,
        color: '#475569',
        fontWeight: '600',
        flex: 1,
    },
    promoBanner: {
        backgroundColor: '#fffbeb',
        borderWidth: 0.5,
        borderColor: '#fef3c7',
        borderRadius: 14,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    promoEmoji: {
        fontSize: 14,
        marginRight: 8,
    },
    promoContentCol: {
        flex: 1,
    },
    promoTitle: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#1e293b',
        textTransform: 'uppercase',
    },
    promoDesc: {
        fontSize: 7.5,
        color: '#64748b',
        fontWeight: '600',
        lineHeight: 11,
        marginTop: 2,
    },
    guaranteeGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    guaranteeBox: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderWidth: 0.5,
        borderColor: '#f1f5f9',
        borderRadius: 12,
        padding: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    guaranteeTextCol: {
        marginLeft: 6,
        flex: 1,
    },
    guaranteeHeading: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#1e293b',
    },
    guaranteeSub: {
        fontSize: 7,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 1,
    },
    specificationsBox: {
        backgroundColor: '#ffffff',
        borderTopWidth: 8,
        borderTopColor: '#f8fafc',
        borderBottomWidth: 8,
        borderBottomColor: '#f8fafc',
        padding: 16,
    },
    specHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    specsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
    },
    specCard: {
        width: '48%',
        backgroundColor: '#f8fafc',
        borderWidth: 0.5,
        borderColor: '#f1f5f9',
        borderRadius: 10,
        padding: 8,
    },
    specLabel: {
        fontSize: 7,
        color: '#94a3b8',
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    specValue: {
        fontSize: 9,
        fontWeight: '900',
        color: '#334155',
        marginTop: 2,
    },
    reviewsBox: {
        backgroundColor: '#ffffff',
        padding: 16,
    },
    reviewsHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    reviewsAvgBadge: {
        backgroundColor: '#fffbeb',
        borderWidth: 0.5,
        borderColor: '#fef3c7',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    reviewsAvgText: {
        fontSize: 8,
        color: '#d97706',
        fontWeight: '900',
    },
    reviewProgressCard: {
        backgroundColor: '#f8fafc',
        borderWidth: 0.5,
        borderColor: '#f1f5f9',
        padding: 10,
        borderRadius: 16,
        gap: 4,
        marginBottom: 16,
    },
    reviewProgressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    progressLabel: {
        width: 32,
        fontSize: 7.5,
        fontWeight: '900',
        color: '#64748b',
    },
    progressBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressPercent: {
        width: 24,
        fontSize: 7.5,
        fontWeight: '900',
        color: '#64748b',
        textAlign: 'right',
    },
    reviewsList: {
        width: '100%',
    },
    reviewRow: {
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: '#f1f5f9',
    },
    reviewUserHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reviewUserLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    reviewUserPlaceholderCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reviewUserPlaceholderText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#64748b',
    },
    reviewUserName: {
        fontSize: 9,
        fontWeight: '900',
        color: '#1e293b',
    },
    reviewUserDate: {
        fontSize: 7,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 1,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 1,
    },
    reviewComment: {
        fontSize: 9,
        color: '#475569',
        fontWeight: '600',
        lineHeight: 13,
        marginTop: 8,
        paddingLeft: 32,
    },
    reviewFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        paddingLeft: 32,
    },
    helpfulBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    helpfulBtnLiked: {
        backgroundColor: '#ecfdf5',
    },
    helpfulText: {
        fontSize: 7.5,
        color: '#94a3b8',
        fontWeight: '900',
    },
    verifiedPurchaseRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    verifiedPurchaseText: {
        fontSize: 7,
        color: '#94a3b8',
        fontWeight: '700',
    },
    stickyFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 4,
    },
    footerPriceLabel: {
        fontSize: 7,
        fontWeight: '900',
        color: '#94a3b8',
        textTransform: 'uppercase',
    },
    footerPriceValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 2,
    },
    addToCartBtn: {
        height: 38,
        paddingHorizontal: 20,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addToCartBtnText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    footerQuantityWidget: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        padding: 3,
    },
    footerQtyBtn: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerQtyValue: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
        marginHorizontal: 10,
        minWidth: 16,
        textAlign: 'center',
    },
});
