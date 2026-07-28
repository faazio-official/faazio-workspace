"use strict";
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
exports.FoodScreen = FoodScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var mockProducts_1 = require("../../data/mockProducts");
var SCREEN_WIDTH = react_native_1.Dimensions.get('window').width;
var BOOKING_DISHES_DB = [
    {
        id: 'bd-1',
        name: 'Garasen Vegetarian Platter',
        restaurant: 'The Green Garden Bistro',
        category: 'Vegan',
        tab: 'Dinner',
        rating: '4.9',
        tags: 'Vegetables • Salad • Hummus',
        price: '₹250',
        emoji: '🥗',
        isSpecial: true,
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400&h=300',
    },
    {
        id: 'bd-2',
        name: 'Pesto Vegan Penne',
        restaurant: 'The Green Garden Bistro',
        category: 'Vegan',
        tab: 'Dinner',
        rating: '4.8',
        tags: 'Pasta • Organic • Greens',
        price: '₹320',
        emoji: '🍝',
        isSpecial: false,
        image: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&q=80&w=400&h=300',
    },
    {
        id: 'bd-3',
        name: 'Neapolitan Margherita Pizza',
        restaurant: 'Milano Pizza & Pasta Co.',
        category: 'Pizza',
        tab: 'Dinner',
        rating: '4.9',
        tags: 'Cheese • Tomato • Basil',
        price: '₹380',
        emoji: '🍕',
        isSpecial: true,
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400&h=300',
    },
    {
        id: 'bd-4',
        name: 'Spicy Truffle Pizza',
        restaurant: 'Milano Pizza & Pasta Co.',
        category: 'Pizza',
        tab: 'Dinner',
        rating: '4.7',
        tags: 'Mushroom • Arugula • Truffle',
        price: '₹450',
        emoji: '🍕',
        isSpecial: false,
        image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&q=80&w=400&h=300',
    },
    {
        id: 'bd-5',
        name: 'Omahs Salmon Sushi Rolls',
        restaurant: 'Kyoto House Sushi Bar',
        category: 'Sushi',
        tab: 'Dinner',
        rating: '4.9',
        tags: 'Raw Fish • Rice • Wasabi',
        price: '₹490',
        emoji: '🍣',
        isSpecial: true,
        image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=400&h=300',
    },
    {
        id: 'bd-6',
        name: 'Premium Classic Hot Dog',
        restaurant: 'Broadway Diner & Hotdogs',
        category: 'Hot Dog',
        tab: 'Dinner',
        rating: '4.6',
        tags: 'Sausage • Mustard • Relish',
        price: '₹190',
        emoji: '🌭',
        isSpecial: false,
        image: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&q=80&w=400&h=300',
    },
    {
        id: 'bd-7',
        name: 'Morning Berry Granola',
        restaurant: 'Aura Organic Kitchen',
        category: 'Vegan',
        tab: 'Breakfast',
        rating: '4.8',
        tags: 'Yogurt • Oats • Mixed Berries',
        price: '₹180',
        emoji: '🥣',
        isSpecial: true,
        image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=400&h=300',
    },
    {
        id: 'bd-8',
        name: 'English Toast & Hash Combo',
        restaurant: 'Aura Organic Kitchen',
        category: 'Hot Dog',
        tab: 'Breakfast',
        rating: '4.7',
        tags: 'Eggs • Bacon • Beans',
        price: '₹220',
        emoji: '🍳',
        isSpecial: false,
        image: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&q=80&w=400&h=300',
    }
];
function FoodScreen(_a) {
    var addToCart = _a.addToCart, activeSubMode = _a.activeSubMode, setActiveSubMode = _a.setActiveSubMode, onProductClick = _a.onProductClick;
    var _b = (0, react_1.useState)(''), searchQuery = _b[0], setSearchQuery = _b[1];
    var _c = (0, react_1.useState)(null), addedId = _c[0], setAddedId = _c[1];
    var _d = (0, react_1.useState)('All'), selectedFilter = _d[0], setSelectedFilter = _d[1];
    // Booking specific states
    var _e = (0, react_1.useState)('Dinner'), selectedBookingTab = _e[0], setSelectedBookingTab = _e[1];
    var _f = (0, react_1.useState)('2026-07-08'), selectedDate = _f[0], setSelectedDate = _f[1];
    var _g = (0, react_1.useState)('19:00'), selectedTime = _g[0], setSelectedTime = _g[1];
    var _h = (0, react_1.useState)(2), guestsCount = _h[0], setGuestsCount = _h[1];
    var _j = (0, react_1.useState)(false), bookingFormOpen = _j[0], setBookingFormOpen = _j[1];
    var _k = (0, react_1.useState)(null), selectedBookingDish = _k[0], setSelectedBookingDish = _k[1];
    var _l = (0, react_1.useState)([]), addedRecommendedIds = _l[0], setAddedRecommendedIds = _l[1];
    var handleAddToCartWithFeedback = function (id, name, price, emoji) {
        if (addToCart)
            addToCart(id, name, price, emoji);
        setAddedId(id);
        setTimeout(function () {
            setAddedId(null);
        }, 1500);
    };
    var bookingDishesList = BOOKING_DISHES_DB.filter(function (d) { return d.tab === selectedBookingTab; });
    if (activeSubMode === 'order') {
        return (<react_native_1.ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPadding}>
        
        {/* Search Input */}
        <react_native_1.View style={styles.searchWrap}>
          <lucide_react_native_1.Search size={18} color="#94a3b8" style={styles.searchIcon}/>
          <react_native_1.TextInput style={styles.searchInput} placeholder="Search on Food" placeholderTextColor="#94a3b8" value={searchQuery} onChangeText={setSearchQuery}/>
        </react_native_1.View>

        {/* Emerald Green Address Card */}
        <react_native_1.TouchableOpacity style={styles.addressCard} activeOpacity={0.9}>
          <react_native_1.View style={styles.addressLeft}>
            <react_native_1.Text style={styles.addressTitle}>DELIVERY TO HOME</react_native_1.Text>
            <react_native_1.Text style={styles.addressMain}>Utama Street no. 14, Rumbai</react_native_1.Text>
            <react_native_1.View style={styles.distanceBadge}>
              <react_native_1.Text style={styles.distanceText}>2.4 km</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>
          <react_native_1.View style={styles.arrowCircle}>
            <lucide_react_native_1.ChevronRight size={18} color="#ffffff"/>
          </react_native_1.View>
        </react_native_1.TouchableOpacity>

        {/* Premium Interactive Teriyaki Promo Card */}
        <react_native_1.View style={styles.promoCard}>
          <react_native_1.Image source={{ uri: 'https://images.unsplash.com/photo-1598514982205-f36b96d1e8dd?auto=format&fit=crop&q=80&w=400&h=250' }} style={styles.promoImage}/>
          <react_native_1.View style={styles.promoOverlay}>
            <react_native_1.View>
              <react_native_1.Text style={styles.promoHeading}>Chicken Teriyaki</react_native_1.Text>
              <react_native_1.Text style={styles.promoSubheading}>Discount 25%</react_native_1.Text>
              <react_native_1.View style={styles.todayOnlyBadge}>
                <react_native_1.Text style={styles.todayOnlyText}>TODAY ONLY</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>
            <react_native_1.TouchableOpacity style={styles.orderNowBtn} activeOpacity={0.8}>
              <react_native_1.Text style={styles.orderNowText}>Order Now</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>
        </react_native_1.View>

        {/* Section: Let's Order */}
        <react_native_1.View style={styles.sectionHeaderRow}>
          <react_native_1.Text style={styles.sectionTitle}>Let's Order</react_native_1.Text>
          <react_native_1.Text style={styles.sectionSubtitle}>Explore Menus</react_native_1.Text>
        </react_native_1.View>

        <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'Rice', 'Snack', 'Noodles', 'Vegetable'].map(function (filter) {
                var isActive = selectedFilter === filter;
                return (<react_native_1.TouchableOpacity key={filter} style={[styles.filterBtn, isActive && styles.filterBtnActive]} onPress={function () { return setSelectedFilter(filter); }} activeOpacity={0.8}>
                <react_native_1.Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter}</react_native_1.Text>
              </react_native_1.TouchableOpacity>);
            })}
        </react_native_1.ScrollView>

        <react_native_1.View style={styles.productsList}>
          {mockProducts_1.topOfWeekDishes.map(function (product) {
                var isAdded = addedId === product.id;
                return (<react_native_1.TouchableOpacity key={product.id} style={styles.productCardRow} onPress={function () { return onProductClick && onProductClick(product); }} activeOpacity={0.9}>
                <react_native_1.View style={styles.productImageWrapRow}>
                  <react_native_1.Image source={{ uri: product.image }} style={styles.productImageRow}/>
                  <react_native_1.View style={styles.emojiBadgeRow}>
                    <react_native_1.Text style={styles.emojiBadgeTextRow}>{product.emoji}</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>
                <react_native_1.View style={styles.productInfoRow}>
                  <react_native_1.Text style={styles.productNameRow} numberOfLines={2}>{product.name}</react_native_1.Text>
                  <react_native_1.View style={styles.metaRowRow}>
                    <react_native_1.View style={styles.metaItemRow}>
                      <lucide_react_native_1.Star size={10} color="#f59e0b" fill="#f59e0b"/>
                      <react_native_1.Text style={styles.metaTextRow}>{product.rating || "4.8"} ({product.reviewsCount || "1.2k"})</react_native_1.Text>
                    </react_native_1.View>
                    <react_native_1.Text style={styles.metaDotRow}>•</react_native_1.Text>
                    <react_native_1.View style={styles.metaItemRow}>
                      <lucide_react_native_1.Clock size={10} color="#64748b"/>
                      <react_native_1.Text style={styles.metaTextRow}>{product.time || "15 mins"}</react_native_1.Text>
                    </react_native_1.View>
                  </react_native_1.View>
                  <react_native_1.View style={styles.priceAddRowRow}>
                    <react_native_1.Text style={styles.priceRowRow}>₹{product.price}</react_native_1.Text>
                    <react_native_1.TouchableOpacity style={[styles.addBtnRow, isAdded && styles.addBtnAddedRow]} onPress={function () { return handleAddToCartWithFeedback(product.id, product.name, product.price, product.emoji); }}>
                      {isAdded ? (<lucide_react_native_1.CheckCircle size={14} color="#ffffff"/>) : (<react_native_1.Text style={styles.addBtnTextRow}>ADD</react_native_1.Text>)}
                    </react_native_1.TouchableOpacity>
                  </react_native_1.View>
                </react_native_1.View>
              </react_native_1.TouchableOpacity>);
            })}
        </react_native_1.View>
      </react_native_1.ScrollView>);
    }
    // Dinner Booking Mode
    return (<react_native_1.View style={styles.container}>
      <react_native_1.ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPaddingBooking}>
        
        {/* Top Header Section */}
        <react_native_1.View style={styles.bookingHeader}>
          <react_native_1.View style={styles.bookingHeaderTop}>
            <react_native_1.View style={styles.avatarRow}>
              <react_native_1.View style={styles.avatarWrap}>
                <react_native_1.Image source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150' }} style={styles.avatarImg}/>
                <react_native_1.View style={styles.onlineDot}/>
              </react_native_1.View>
              <react_native_1.View>
                <react_native_1.Text style={styles.greetText}>Let's order a food,</react_native_1.Text>
                <react_native_1.Text style={styles.userNameText}>Faizal Basha</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>
            <react_native_1.View style={styles.cartCircle}>
              <react_native_1.Text style={styles.cartEmoji}>🛒</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>

          {/* Central Search */}
          <react_native_1.View style={styles.bookingSearch}>
            <react_native_1.TouchableOpacity onPress={function () { return setActiveSubMode('order'); }}>
              <lucide_react_native_1.ArrowLeft size={16} color="#94a3b8"/>
            </react_native_1.TouchableOpacity>
            <react_native_1.TextInput style={styles.bookingSearchInput} placeholder="Find for food or resto ..." placeholderTextColor="#94a3b8" value={searchQuery} onChangeText={setSearchQuery}/>
            <lucide_react_native_1.Search size={16} color="#94a3b8"/>
          </react_native_1.View>

          {/* Horizontal Category Tabs */}
          <react_native_1.View style={styles.tabsRow}>
            {['Breakfast', 'Dinner', 'Have Lunch'].map(function (tab) {
            var isActive = selectedBookingTab === tab;
            return (<react_native_1.TouchableOpacity key={tab} style={styles.tabBtn} onPress={function () { return setSelectedBookingTab(tab); }}>
                  <react_native_1.Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</react_native_1.Text>
                  {isActive && <react_native_1.View style={styles.tabIndicator}/>}
                </react_native_1.TouchableOpacity>);
        })}
          </react_native_1.View>
        </react_native_1.View>

        {/* Most Favorite Food */}
        <react_native_1.View style={styles.favoriteHeader}>
          <react_native_1.Text style={styles.sectionTitle}>Most Favorite Food</react_native_1.Text>
          <react_native_1.Text style={styles.seeAllText}>See all</react_native_1.Text>
        </react_native_1.View>

        <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoriteScroll}>
          {bookingDishesList.map(function (dish) { return (<react_native_1.TouchableOpacity key={dish.id} style={styles.favoriteCard} onPress={function () {
                setSelectedBookingDish(dish);
                setBookingFormOpen(true);
            }} activeOpacity={0.9}>
              <react_native_1.Image source={{ uri: dish.image }} style={styles.favImage}/>
              <react_native_1.View style={styles.favRatingBadge}>
                <react_native_1.Text style={styles.favRatingText}>★ {dish.rating}</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.favContent}>
                <react_native_1.Text style={styles.favTitle} numberOfLines={1}>{dish.name}</react_native_1.Text>
                <react_native_1.Text style={styles.favResto} numberOfLines={1}>{dish.restaurant}</react_native_1.Text>
                <react_native_1.View style={styles.favFooter}>
                  <react_native_1.Text style={styles.favPrice}>{dish.price}</react_native_1.Text>
                  <react_native_1.View style={styles.favAddCircle}>
                    <react_native_1.Text style={styles.favAddText}>+</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.TouchableOpacity>); })}
        </react_native_1.ScrollView>

        {/* Iconic Dishes & Today's Special */}
        <react_native_1.View style={styles.iconicHeader}>
          <react_native_1.View>
            <react_native_1.Text style={styles.iconicLabel}>HIGHLY RECOMMENDED</react_native_1.Text>
            <react_native_1.View style={styles.iconicTitleRow}>
              <lucide_react_native_1.Sparkles size={14} color="#f59e0b"/>
              <react_native_1.Text style={styles.sectionTitle}>Iconic Dishes & Today's Special</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>
          <react_native_1.View style={styles.popularBadge}>
            <react_native_1.Text style={styles.popularText}>POPULAR PAIRS</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>

        <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoriteScroll}>
          {BOOKING_DISHES_DB.filter(function (d) { return d.id !== (selectedBookingDish === null || selectedBookingDish === void 0 ? void 0 : selectedBookingDish.id); }).map(function (dish) {
            var isAdded = addedRecommendedIds.includes(dish.id);
            return (<react_native_1.TouchableOpacity key={dish.id} style={styles.iconicCard} activeOpacity={0.9}>
                {dish.isSpecial && (<react_native_1.View style={styles.specialBadge}>
                    <react_native_1.Text style={styles.specialText}>Special 🔥</react_native_1.Text>
                  </react_native_1.View>)}
                <react_native_1.Image source={{ uri: dish.image }} style={styles.iconicImage}/>
                <react_native_1.View style={styles.iconicContent}>
                  <react_native_1.Text style={styles.iconicResto} numberOfLines={1}>{dish.restaurant}</react_native_1.Text>
                  <react_native_1.Text style={styles.iconicTitle} numberOfLines={2}>{dish.name}</react_native_1.Text>
                  <react_native_1.View style={styles.iconicFooter}>
                    <react_native_1.Text style={styles.iconicPrice}>{dish.price}</react_native_1.Text>
                    <react_native_1.TouchableOpacity style={[styles.iconicAddBtn, isAdded && styles.iconicAddBtnAdded]} onPress={function () {
                    handleAddToCartWithFeedback(dish.id, dish.name, parseInt(dish.price.replace(/[^\d]/g, '')), dish.emoji);
                    setAddedRecommendedIds(function (prev) { return __spreadArray(__spreadArray([], prev, true), [dish.id], false); });
                }}>
                      {isAdded ? <lucide_react_native_1.Check size={11} color="#ffffff" strokeWidth={3}/> : <react_native_1.Text style={styles.iconicAddBtnText}>+</react_native_1.Text>}
                    </react_native_1.TouchableOpacity>
                  </react_native_1.View>
                </react_native_1.View>
              </react_native_1.TouchableOpacity>);
        })}
        </react_native_1.ScrollView>
      </react_native_1.ScrollView>

      {/* Bottom Sticky action summary */}
      {bookingFormOpen && (<react_native_1.View style={styles.bottomSticky}>
          <react_native_1.View style={styles.summaryRow}>
            <react_native_1.Text style={styles.summaryLabel}>Reservation Summary</react_native_1.Text>
            <react_native_1.Text style={styles.summaryValue}>{guestsCount} Guests • {selectedDate} @ {selectedTime}</react_native_1.Text>
          </react_native_1.View>
          <react_native_1.TouchableOpacity style={styles.confirmBtn} onPress={function () { return setBookingFormOpen(false); }}>
            <react_native_1.Text style={styles.confirmBtnText}>Confirm Table Reservation ({selectedBookingDish === null || selectedBookingDish === void 0 ? void 0 : selectedBookingDish.price})</react_native_1.Text>
            <react_native_1.View style={styles.promoPassBadge}>
              <react_native_1.Text style={styles.promoPassText}>PROMO PASS</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>)}
    </react_native_1.View>);
}
var styles = react_native_1.StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    contentPadding: { paddingBottom: 40, paddingTop: 16, paddingHorizontal: 16 },
    contentPaddingBooking: { paddingBottom: 100 },
    searchWrap: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9',
        borderRadius: 16, paddingHorizontal: 12, height: 44, marginBottom: 20
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 12, fontWeight: '800', color: '#0f172a' },
    addressCard: {
        backgroundColor: '#1E5D44', borderRadius: 24, padding: 20,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20
    },
    addressLeft: { flex: 1 },
    addressTitle: { fontSize: 10, fontWeight: '900', color: '#6ee7b7', marginBottom: 4 },
    addressMain: { fontSize: 14, fontWeight: '900', color: '#ffffff', marginBottom: 12 },
    distanceBadge: { backgroundColor: '#ffffff', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    distanceText: { fontSize: 10, fontWeight: '900', color: '#1E5D44' },
    arrowCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    promoCard: { width: '100%', height: 160, borderRadius: 24, overflow: 'hidden', marginBottom: 24 },
    promoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    promoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: 20, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'flex-end' },
    promoHeading: { fontSize: 18, fontWeight: '900', color: '#ffffff', marginBottom: 4 },
    promoSubheading: { fontSize: 12, fontWeight: '800', color: '#fcd34d', marginBottom: 8 },
    todayOnlyBadge: { backgroundColor: '#ef4444', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    todayOnlyText: { fontSize: 9, fontWeight: '900', color: '#ffffff' },
    orderNowBtn: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    orderNowText: { fontSize: 11, fontWeight: '900', color: '#0f172a' },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
    sectionSubtitle: { fontSize: 11, fontWeight: '700', color: '#64748b' },
    filterScroll: { paddingBottom: 16, gap: 10 },
    filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#f1f5f9' },
    filterBtnActive: { backgroundColor: '#0f172a' },
    filterText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    filterTextActive: { color: '#ffffff' },
    productsList: { gap: 16 },
    productCardRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', padding: 12, gap: 12 },
    productImageWrapRow: { width: 80, height: 80, borderRadius: 16, overflow: 'hidden', position: 'relative' },
    productImageRow: { width: '100%', height: '100%' },
    emojiBadgeRow: { position: 'absolute', top: 6, left: 6, backgroundColor: '#ffffff', padding: 4, borderRadius: 8 },
    emojiBadgeTextRow: { fontSize: 12 },
    productInfoRow: { flex: 1, justifyContent: 'space-between' },
    productNameRow: { fontSize: 12, fontWeight: '900', color: '#0f172a' },
    metaRowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
    metaItemRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaTextRow: { fontSize: 10, fontWeight: '700', color: '#64748b' },
    metaDotRow: { fontSize: 10, color: '#cbd5e1' },
    priceAddRowRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    priceRowRow: { fontSize: 14, fontWeight: '900', color: '#10b981' },
    addBtnRow: { backgroundColor: '#0f172a', width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    addBtnAddedRow: { backgroundColor: '#10b981' },
    addBtnTextRow: { fontSize: 14, fontWeight: '900', color: '#ffffff' },
    // Booking Styles
    bookingHeader: { backgroundColor: '#54B175', padding: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 20 },
    bookingHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarWrap: { position: 'relative' },
    avatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
    onlineDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ade80', borderWidth: 2, borderColor: '#54B175' },
    greetText: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
    userNameText: { fontSize: 14, fontWeight: '900', color: '#ffffff', marginTop: 2 },
    cartCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' },
    cartEmoji: { fontSize: 18 },
    bookingSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, paddingHorizontal: 16, height: 44, marginBottom: 16, gap: 12 },
    bookingSearchInput: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0f172a' },
    tabsRow: { flexDirection: 'row', gap: 20 },
    tabBtn: { paddingVertical: 8, position: 'relative' },
    tabText: { fontSize: 12, fontWeight: '900', color: 'rgba(255,255,255,0.6)' },
    tabTextActive: { color: '#ffffff' },
    tabIndicator: { position: 'absolute', bottom: 0, left: '50%', transform: [{ translateX: -4 }], width: 8, height: 4, backgroundColor: '#ffffff', borderRadius: 2 },
    favoriteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginBottom: 12 },
    seeAllText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
    favoriteScroll: { paddingHorizontal: 16, gap: 16, paddingBottom: 24 },
    favoriteCard: { width: 180, backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9', padding: 12 },
    favImage: { width: '100%', height: 120, borderRadius: 16, marginBottom: 12 },
    favRatingBadge: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    favRatingText: { fontSize: 9, fontWeight: '900', color: '#ffffff' },
    favContent: { flex: 1 },
    favTitle: { fontSize: 12, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
    favResto: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 12 },
    favFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    favPrice: { fontSize: 14, fontWeight: '900', color: '#54B175' },
    favAddCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
    favAddText: { fontSize: 14, fontWeight: '900', color: '#ffffff' },
    iconicHeader: { paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    iconicLabel: { fontSize: 9, fontWeight: '900', color: '#f59e0b', letterSpacing: 1, marginBottom: 4 },
    iconicTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    popularBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    popularText: { fontSize: 9, fontWeight: '900', color: '#f59e0b' },
    iconicCard: { width: 140, backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#f1f5f9', padding: 12 },
    specialBadge: { position: 'absolute', top: 20, left: 20, zIndex: 10, backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    specialText: { fontSize: 8, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 },
    iconicImage: { width: '100%', height: 90, borderRadius: 16, marginBottom: 10 },
    iconicContent: { flex: 1 },
    iconicResto: { fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
    iconicTitle: { fontSize: 11, fontWeight: '900', color: '#0f172a', marginBottom: 8, minHeight: 30 },
    iconicFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f8fafc', paddingTop: 8 },
    iconicPrice: { fontSize: 11, fontWeight: '900', color: '#54B175' },
    iconicAddBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
    iconicAddBtnAdded: { backgroundColor: '#54B175' },
    iconicAddBtnText: { fontSize: 14, fontWeight: '900', color: '#ffffff' },
    bottomSticky: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#ffffff', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    summaryLabel: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    summaryValue: { fontSize: 11, fontWeight: '900', color: '#0f172a' },
    confirmBtn: { backgroundColor: '#54B175', height: 44, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    confirmBtnText: { fontSize: 12, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 },
    promoPassBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    promoPassText: { fontSize: 9, fontWeight: '900', color: '#ffffff' },
});
