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
exports.default = HomeView;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var SCREEN_WIDTH = react_native_1.Dimensions.get('window').width;
function HomeView(_a) {
    var onLaunchSubApp = _a.onLaunchSubApp, addToCart = _a.addToCart;
    var _b = (0, react_1.useState)([]), favoriteRestaurants = _b[0], setFavoriteRestaurants = _b[1];
    var _c = (0, react_1.useState)(null), addedItemFeedback = _c[0], setAddedItemFeedback = _c[1];
    var portalSectors = [
        {
            id: 'FA_MART',
            name: 'MART',
            tagline: 'Fashion & Tech',
            emoji: '🛍️',
            imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=300&h=300',
            themeColor: '#1162D3',
            shadowColor: 'rgba(17,98,211,0.18)',
        },
        {
            id: 'FOOD',
            name: 'FOOD',
            tagline: 'Gourmet Dining',
            emoji: '🍲',
            imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=300&h=300',
            themeColor: '#1E5D44',
            shadowColor: 'rgba(30,93,68,0.18)',
        },
        {
            id: 'GROCERY',
            name: 'GROCERY',
            tagline: '10-Min Delivery',
            emoji: '🍏',
            imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300&h=300',
            themeColor: '#10B981',
            shadowColor: 'rgba(16,185,129,0.18)',
        },
        {
            id: 'PHARMA',
            name: 'PHARMA',
            tagline: 'Rx & Lab Tests',
            emoji: '💊',
            imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=300&h=300',
            themeColor: '#065F46',
            shadowColor: 'rgba(6,95,70,0.18)',
        },
    ];
    var sponsoredAds = [
        {
            title: 'Gourmet Double Truffle Smash Burger',
            tagline: 'Unleash authentic black winter truffle butter inside premium Angus beef patties.',
            brand: 'Burger Craft',
            discount: '50% OFF TODAY',
            imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400&h=250',
            targetApp: 'FOOD',
        },
    ];
    var foodOffers = [
        {
            id: 'fo-1',
            dishName: 'Signature Spicy Tonkotsu Ramen',
            originalPrice: '₹450',
            promoPrice: '₹225',
            restaurant: 'Ramen Ichiraku',
            emoji: '🍜',
            discountBadge: '50% Off Today',
            imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=200&h=200',
        },
        {
            id: 'fo-2',
            dishName: 'Organic Dragonfruit Acai Bowl',
            originalPrice: '₹380',
            promoPrice: '₹249',
            restaurant: 'Aura Organic Kitchen',
            emoji: '🍧',
            discountBadge: '35% Off',
            imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=200&h=200',
        },
    ];
    var popularDining = [
        {
            id: 'pd-1',
            name: 'The Imperial Jade Garden',
            cuisine: 'Fine Cantonese & Dim Sum',
            rating: '4.9',
            distance: '1.8 km',
            avgTime: '22 mins',
            avgPrice: '₹1,200 for two',
            imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80&w=300&h=200',
            trendingBadge: 'Michelin Listed',
        },
        {
            id: 'pd-2',
            name: 'Bella Vista Trattoria',
            cuisine: 'Stonefire Pizzas & Homemade Pasta',
            rating: '4.8',
            distance: '2.6 km',
            avgTime: '28 mins',
            avgPrice: '₹800 for two',
            imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=300&h=200',
            trendingBadge: 'Most Ordered',
        },
        {
            id: 'pd-3',
            name: 'Kuroshio Modern Omakase',
            cuisine: 'Aesthetic Premium Sushi',
            rating: '4.9',
            distance: '3.2 km',
            avgTime: '35 mins',
            avgPrice: '₹2,500 for two',
            imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=300&h=200',
            trendingBadge: "Chef's Table",
        },
    ];
    var recentlyViewedMart = [
        {
            id: 'rv-mart-1',
            name: 'Retro Mechanical RGB Keyboard',
            price: '₹4,999',
            emoji: '⌨️',
            imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=150&h=150',
            desc: 'Tactile brown switches with customizable backlit keycaps.',
        },
        {
            id: 'rv-mart-2',
            name: 'Minimalist Suede Sneaker Kicks',
            price: '₹3,499',
            emoji: '👟',
            imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=150&h=150',
            desc: 'Premium lightweight trainers built for urban environments.',
        },
        {
            id: 'rv-mart-3',
            name: 'Active Noise Cancelling Earbuds',
            price: '₹6,999',
            emoji: '🎧',
            imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=150&h=150',
            desc: '32-hour hybrid playback with customized transparency mode.',
        },
    ];
    var recentlyViewedGrocery = [
        {
            id: 'rv-groc-1',
            name: 'Organic Honeycrisp Gala Apples',
            price: '₹249 / kg',
            emoji: '🍎',
            imageUrl: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&q=80&w=150&h=150',
            desc: 'Sweet, crispy, and hand-picked from organic valley farms.',
        },
        {
            id: 'rv-groc-2',
            name: 'Cold Pressed Fresh Orange Juice',
            price: '₹180',
            emoji: '🍊',
            imageUrl: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&q=80&w=150&h=150',
            desc: 'No added sugar, rich in real active vitamin C nutrients.',
        },
        {
            id: 'rv-groc-3',
            name: 'Premium California Almonds',
            price: '₹499 / 500g',
            emoji: '🥜',
            imageUrl: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d4f?auto=format&fit=crop&q=80&w=150&h=150',
            desc: 'Perfectly sorted whole almonds roasted to golden crispiness.',
        },
    ];
    var recentlyViewedPharma = [
        {
            id: 'rv-ph-1',
            name: 'Faazio Pure Vitamin C 1000mg',
            price: '₹349',
            emoji: '🍊',
            imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=150&h=150',
            desc: 'Premium antioxidant gummies for dynamic daily immunity booster.',
        },
        {
            id: 'rv-ph-2',
            name: 'Multi-Symptom Throat Lozenge Pack',
            price: '₹120',
            emoji: '🍬',
            imageUrl: 'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&q=80&w=150&h=150',
            desc: 'Menthol-mint soothing action for fast throat irritation relief.',
        },
        {
            id: 'rv-ph-3',
            name: 'Non-Contact Digital Thermometer',
            price: '₹1,850',
            emoji: '🌡️',
            imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=150&h=150',
            desc: 'Medical grade instant scanning with bright backlit display.',
        },
    ];
    var faMartFinds = [
        {
            id: 'fmf-1',
            name: 'Hi-Fi Active Noise Canceling Headset',
            price: '₹8,999',
            tag: 'Best Value',
            imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=300&h=200',
            rating: '4.9',
        },
        {
            id: 'fmf-2',
            name: 'Premium Vegan Suede Bomber Jacket',
            price: '₹4,500',
            tag: 'Trending Now',
            imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=300&h=200',
            rating: '4.8',
        },
    ];
    var restaurantSpecials = [
        {
            id: 'rs-1',
            name: 'Slow Cooked Awadhi Mutton Biryani',
            price: '₹550',
            restaurant: 'Dastarkhwan Heritage',
            rating: '4.9',
            emoji: '🍗',
            badge: 'Chef Signature',
            imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=300&h=200',
        },
        {
            id: 'rs-2',
            name: 'Crisp Garlic Naan & Paneer Masala',
            price: '₹380',
            restaurant: 'The Punjab Darbar',
            rating: '4.8',
            emoji: '🍛',
            badge: 'Classic Favourite',
            imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&q=80&w=300&h=200',
        },
        {
            id: 'rs-3',
            name: 'Triple Chocolate Lava Melt Souffle',
            price: '₹240',
            restaurant: 'Le Paris Crêperie',
            rating: '4.9',
            emoji: '🍫',
            badge: 'Guilt Free Dessert',
            imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=300&h=200',
        },
    ];
    var toggleFavorite = function (id) {
        if (favoriteRestaurants.includes(id)) {
            setFavoriteRestaurants(favoriteRestaurants.filter(function (item) { return item !== id; }));
        }
        else {
            setFavoriteRestaurants(__spreadArray(__spreadArray([], favoriteRestaurants, true), [id], false));
        }
    };
    var triggerAddToCartFeedback = function (id, name, price, emoji) {
        addToCart(id, name, price, emoji);
        setAddedItemFeedback(id);
        setTimeout(function () {
            setAddedItemFeedback(null);
        }, 1500);
    };
    return (<react_native_1.ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      
      {/* 1. Explore Premium Sectors Circular Grid */}
      <react_native_1.View style={styles.sectionHeader}>
        <react_native_1.Text style={styles.sectionTitle}>Explore Premium Sectors</react_native_1.Text>
      </react_native_1.View>
      <react_native_1.View style={styles.sectorsCard}>
        <react_native_1.View style={styles.sectorsGrid}>
          {portalSectors.map(function (sector) { return (<react_native_1.TouchableOpacity key={sector.id} onPress={function () { return onLaunchSubApp(sector.id); }} style={styles.sectorButton} activeOpacity={0.8}>
              <react_native_1.View style={[styles.sectorCircle, { borderColor: '#f8fafc' }]}>
                <react_native_1.Image source={{ uri: sector.imageUrl }} style={styles.sectorImg}/>
                <react_native_1.View style={styles.sectorEmojiOverlay}>
                  <react_native_1.Text style={styles.sectorEmojiText}>{sector.emoji}</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>
              <react_native_1.Text style={styles.sectorName} numberOfLines={1}>{sector.name}</react_native_1.Text>
              <react_native_1.Text style={styles.sectorTagline} numberOfLines={1}>{sector.tagline}</react_native_1.Text>
            </react_native_1.TouchableOpacity>); })}
        </react_native_1.View>
      </react_native_1.View>

      {/* 2. Sponsored Ad Banner */}
      {sponsoredAds.map(function (ad, index) { return (<react_native_1.TouchableOpacity key={index} onPress={function () { return onLaunchSubApp(ad.targetApp); }} style={styles.adCard} activeOpacity={0.9}>
          <react_native_1.Image source={{ uri: ad.imageUrl }} style={styles.adBgImg}/>
          <react_native_1.View style={styles.adGradientOverlay}/>
          <react_native_1.View style={styles.adTag}>
            <lucide_react_native_1.Tag size={10} color="#f59e0b" fill="#f59e0b"/>
            <react_native_1.Text style={styles.adTagText}>Sponsored Ad</react_native_1.Text>
          </react_native_1.View>
          <react_native_1.View style={styles.adContent}>
            <react_native_1.Text style={styles.adBrand}>{ad.brand} • {ad.discount}</react_native_1.Text>
            <react_native_1.Text style={styles.adTitle}>{ad.title}</react_native_1.Text>
            <react_native_1.Text style={styles.adDesc}>{ad.tagline}</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.TouchableOpacity>); })}

      {/* 3. Food Offers Today */}
      <react_native_1.View style={[styles.sectionRow, { marginTop: 14 }]}>
        <react_native_1.View style={styles.rowTitleWrap}>
          <lucide_react_native_1.Flame size={14} color="#f97316" fill="#f97316" style={{ marginRight: 4 }}/>
          <react_native_1.Text style={styles.sectionTitle}>Food Offers Today</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.TouchableOpacity onPress={function () { return onLaunchSubApp('FOOD'); }} style={styles.seeAllBtn}>
          <react_native_1.Text style={styles.seeAllBtnText}>See All Offers</react_native_1.Text>
        </react_native_1.TouchableOpacity>
      </react_native_1.View>

      <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
        {foodOffers.map(function (offer) { return (<react_native_1.TouchableOpacity key={offer.id} onPress={function () { return onLaunchSubApp('FOOD'); }} style={styles.horizontalCard} activeOpacity={0.9}>
            <react_native_1.View style={styles.cardImageContainer}>
              <react_native_1.Image source={{ uri: offer.imageUrl }} style={styles.cardImg}/>
              <react_native_1.View style={styles.offerBadge}>
                <react_native_1.Text style={styles.offerBadgeText}>{offer.discountBadge}</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.miniAppBadge}>
                <react_native_1.Text style={styles.miniAppBadgeText}>{offer.emoji}</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>
            <react_native_1.Text style={styles.cardTitle} numberOfLines={1}>{offer.dishName}</react_native_1.Text>
            <react_native_1.Text style={styles.cardSubtitle}>{offer.restaurant}</react_native_1.Text>
            <react_native_1.View style={styles.cardFooter}>
              <react_native_1.View style={styles.priceRow}>
                <react_native_1.Text style={styles.promoPrice}>{offer.promoPrice}</react_native_1.Text>
                <react_native_1.Text style={styles.originalPrice}>{offer.originalPrice}</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.orderBadge}>
                <react_native_1.Text style={styles.orderBadgeText}>Order</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>
          </react_native_1.TouchableOpacity>); })}
      </react_native_1.ScrollView>

      {/* 4. Popular Dining */}
      <react_native_1.View style={styles.sectionRow}>
        <react_native_1.View style={styles.rowTitleWrap}>
          <lucide_react_native_1.Utensils size={14} color="#1E5D44" style={{ marginRight: 4 }}/>
          <react_native_1.Text style={styles.sectionTitle}>Popular Dining Restaurants</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.Text style={styles.topVotedText}>Top Voted</react_native_1.Text>
      </react_native_1.View>

      <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
        {popularDining.map(function (res) {
            var isLiked = favoriteRestaurants.includes(res.id);
            return (<react_native_1.TouchableOpacity key={res.id} onPress={function () { return onLaunchSubApp('FOOD'); }} style={styles.horizontalCard} activeOpacity={0.9}>
              <react_native_1.View style={styles.cardImageContainer}>
                <react_native_1.Image source={{ uri: res.imageUrl }} style={styles.cardImg}/>
                <react_native_1.View style={styles.ratingLabel}>
                  <lucide_react_native_1.Star size={9} color="#f59e0b" fill="#f59e0b"/>
                  <react_native_1.Text style={styles.ratingLabelText}>{res.rating}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.resBadge}>
                  <react_native_1.Text style={styles.resBadgeText}>{res.trendingBadge}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.TouchableOpacity onPress={function () { return toggleFavorite(res.id); }} style={styles.heartBtn} activeOpacity={0.8}>
                  <lucide_react_native_1.Heart size={12} color="#f43f5e" fill={isLiked ? '#f43f5e' : 'transparent'}/>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>
              <react_native_1.Text style={styles.cardTitle} numberOfLines={1}>{res.name}</react_native_1.Text>
              <react_native_1.Text style={styles.cardSubtitle}>{res.cuisine} • {res.avgPrice}</react_native_1.Text>
              <react_native_1.View style={styles.detailRow}>
                <react_native_1.View style={styles.detailItem}>
                  <lucide_react_native_1.MapPin size={9} color="#94a3b8"/>
                  <react_native_1.Text style={styles.detailText}>{res.distance}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.View style={styles.detailItem}>
                  <lucide_react_native_1.Clock size={9} color="#94a3b8"/>
                  <react_native_1.Text style={styles.detailText}>{res.avgTime}</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.TouchableOpacity>);
        })}
      </react_native_1.ScrollView>

      {/* 5. Recently Viewed */}
      <react_native_1.View style={styles.sectionRow}>
        <react_native_1.View style={styles.rowTitleWrap}>
          <lucide_react_native_1.TrendingUp size={14} color="#1162D3" style={{ marginRight: 4 }}/>
          <react_native_1.Text style={styles.sectionTitle}>Recently Viewed Items</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.Text style={styles.topVotedText}>Your History</react_native_1.Text>
      </react_native_1.View>

      {/* Recently Viewed: Mart */}
      <react_native_1.View style={styles.historyCategoryRow}>
        <react_native_1.Text style={styles.historyCategoryTitle}>In Mart Sector</react_native_1.Text>
        <react_native_1.View style={[styles.historyCategoryDot, { backgroundColor: '#1162D3' }]}/>
      </react_native_1.View>
      <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScrollContent}>
        {recentlyViewedMart.map(function (item) {
            var hasAdded = addedItemFeedback === item.id;
            return (<react_native_1.TouchableOpacity key={item.id} onPress={function () { return onLaunchSubApp('FA_MART'); }} style={styles.historyItemCard} activeOpacity={0.9}>
              <react_native_1.View style={styles.historyLeft}>
                <react_native_1.View style={styles.historyImgWrapper}>
                  <react_native_1.Image source={{ uri: item.imageUrl }} style={styles.historyImg}/>
                  <react_native_1.View style={styles.historyIconStamp}>
                    <react_native_1.Text style={styles.historyIconText}>{item.emoji}</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>
                <react_native_1.View style={styles.historyTextCol}>
                  <react_native_1.Text style={styles.historyName} numberOfLines={1}>{item.name}</react_native_1.Text>
                  <react_native_1.Text style={styles.historyDesc} numberOfLines={1}>{item.desc}</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>
              <react_native_1.View style={styles.historyRight}>
                <react_native_1.Text style={styles.historyPrice}>{item.price}</react_native_1.Text>
                <react_native_1.TouchableOpacity onPress={function () { return triggerAddToCartFeedback(item.id, item.name, parseInt(item.price.replace(/[^\d]/g, '')), item.emoji); }} style={[styles.historyAddBtn, hasAdded && styles.historyAddBtnAdded]} activeOpacity={0.8}>
                  <lucide_react_native_1.Plus size={8} color={hasAdded ? '#ffffff' : '#334155'} style={{ marginRight: 2 }}/>
                  <react_native_1.Text style={[styles.historyAddBtnText, hasAdded && styles.historyAddBtnTextAdded]}>
                    {hasAdded ? 'Added' : 'Add'}
                  </react_native_1.Text>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>
            </react_native_1.TouchableOpacity>);
        })}
      </react_native_1.ScrollView>

      {/* Recently Viewed: Grocery */}
      <react_native_1.View style={styles.historyCategoryRow}>
        <react_native_1.Text style={styles.historyCategoryTitle}>In Grocery Essentials</react_native_1.Text>
        <react_native_1.View style={[styles.historyCategoryDot, { backgroundColor: '#10B981' }]}/>
      </react_native_1.View>
      <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScrollContent}>
        {recentlyViewedGrocery.map(function (item) {
            var hasAdded = addedItemFeedback === item.id;
            return (<react_native_1.TouchableOpacity key={item.id} onPress={function () { return onLaunchSubApp('GROCERY'); }} style={styles.historyItemCard} activeOpacity={0.9}>
              <react_native_1.View style={styles.historyLeft}>
                <react_native_1.View style={styles.historyImgWrapper}>
                  <react_native_1.Image source={{ uri: item.imageUrl }} style={styles.historyImg}/>
                  <react_native_1.View style={styles.historyIconStamp}>
                    <react_native_1.Text style={styles.historyIconText}>{item.emoji}</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>
                <react_native_1.View style={styles.historyTextCol}>
                  <react_native_1.Text style={styles.historyName} numberOfLines={1}>{item.name}</react_native_1.Text>
                  <react_native_1.Text style={styles.historyDesc} numberOfLines={1}>{item.desc}</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>
              <react_native_1.View style={styles.historyRight}>
                <react_native_1.Text style={styles.historyPrice}>{item.price}</react_native_1.Text>
                <react_native_1.TouchableOpacity onPress={function () { return triggerAddToCartFeedback(item.id, item.name, parseInt(item.price.replace(/[^\d]/g, '')), item.emoji); }} style={[styles.historyAddBtn, hasAdded && styles.historyAddBtnAdded]} activeOpacity={0.8}>
                  <lucide_react_native_1.Plus size={8} color={hasAdded ? '#ffffff' : '#334155'} style={{ marginRight: 2 }}/>
                  <react_native_1.Text style={[styles.historyAddBtnText, hasAdded && styles.historyAddBtnTextAdded]}>
                    {hasAdded ? 'Added' : 'Add'}
                  </react_native_1.Text>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>
            </react_native_1.TouchableOpacity>);
        })}
      </react_native_1.ScrollView>

      {/* Recently Viewed: Pharma */}
      <react_native_1.View style={styles.historyCategoryRow}>
        <react_native_1.Text style={styles.historyCategoryTitle}>In Pharma Wellness</react_native_1.Text>
        <react_native_1.View style={[styles.historyCategoryDot, { backgroundColor: '#065F46' }]}/>
      </react_native_1.View>
      <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyScrollContent}>
        {recentlyViewedPharma.map(function (item) {
            var hasAdded = addedItemFeedback === item.id;
            return (<react_native_1.TouchableOpacity key={item.id} onPress={function () { return onLaunchSubApp('PHARMA'); }} style={styles.historyItemCard} activeOpacity={0.9}>
              <react_native_1.View style={styles.historyLeft}>
                <react_native_1.View style={styles.historyImgWrapper}>
                  <react_native_1.Image source={{ uri: item.imageUrl }} style={styles.historyImg}/>
                  <react_native_1.View style={styles.historyIconStamp}>
                    <react_native_1.Text style={styles.historyIconText}>{item.emoji}</react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>
                <react_native_1.View style={styles.historyTextCol}>
                  <react_native_1.Text style={styles.historyName} numberOfLines={1}>{item.name}</react_native_1.Text>
                  <react_native_1.Text style={styles.historyDesc} numberOfLines={1}>{item.desc}</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>
              <react_native_1.View style={styles.historyRight}>
                <react_native_1.Text style={styles.historyPrice}>{item.price}</react_native_1.Text>
                <react_native_1.TouchableOpacity onPress={function () { return triggerAddToCartFeedback(item.id, item.name, parseInt(item.price.replace(/[^\d]/g, '')), item.emoji); }} style={[styles.historyAddBtn, hasAdded && styles.historyAddBtnAdded]} activeOpacity={0.8}>
                  <lucide_react_native_1.Plus size={8} color={hasAdded ? '#ffffff' : '#334155'} style={{ marginRight: 2 }}/>
                  <react_native_1.Text style={[styles.historyAddBtnText, hasAdded && styles.historyAddBtnTextAdded]}>
                    {hasAdded ? 'Added' : 'Add'}
                  </react_native_1.Text>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>
            </react_native_1.TouchableOpacity>);
        })}
      </react_native_1.ScrollView>

      {/* 6. FA Mart Curated Finds */}
      <react_native_1.View style={[styles.sectionRow, { marginTop: 14 }]}>
        <react_native_1.View style={styles.rowTitleWrap}>
          <lucide_react_native_1.Sparkles size={14} color="#1162D3" style={{ marginRight: 4 }}/>
          <react_native_1.Text style={styles.sectionTitle}>FA Mart Curated Finds</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.TouchableOpacity onPress={function () { return onLaunchSubApp('FA_MART'); }} style={styles.seeAllBtn}>
          <react_native_1.Text style={[styles.seeAllBtnText, { color: '#1162D3' }]}>Shop Mart Finds</react_native_1.Text>
        </react_native_1.TouchableOpacity>
      </react_native_1.View>

      <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
        {faMartFinds.map(function (find) { return (<react_native_1.TouchableOpacity key={find.id} onPress={function () { return onLaunchSubApp('FA_MART'); }} style={styles.horizontalCard} activeOpacity={0.9}>
            <react_native_1.View style={styles.cardImageContainer}>
              <react_native_1.Image source={{ uri: find.imageUrl }} style={styles.cardImg}/>
              <react_native_1.View style={[styles.offerBadge, { backgroundColor: '#1162D3', borderColor: '#3b82f6' }]}>
                <react_native_1.Text style={styles.offerBadgeText}>{find.tag}</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.ratingOverlayRight}>
                <react_native_1.Text style={styles.ratingOverlayText}>★ {find.rating}</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>
            <react_native_1.Text style={styles.cardTitle} numberOfLines={1}>{find.name}</react_native_1.Text>
            <react_native_1.Text style={styles.cardSubtitle}>FA Mart Curated Finds</react_native_1.Text>
            <react_native_1.View style={styles.cardFooter}>
              <react_native_1.Text style={[styles.promoPrice, { color: '#1162D3' }]}>{find.price}</react_native_1.Text>
              <react_native_1.View style={[styles.orderBadge, { backgroundColor: '#1162D3' }]}>
                <react_native_1.Text style={styles.orderBadgeText}>Discover</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>
          </react_native_1.TouchableOpacity>); })}
      </react_native_1.ScrollView>

      {/* 7. Restaurant's Special */}
      <react_native_1.View style={styles.sectionRow}>
        <react_native_1.View style={styles.rowTitleWrap}>
          <lucide_react_native_1.Award size={14} color="#f59e0b" style={{ marginRight: 4 }}/>
          <react_native_1.Text style={styles.sectionTitle}>Restaurant's Special</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.Text style={styles.topVotedText}>Signature Dishes</react_native_1.Text>
      </react_native_1.View>

      <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
        {restaurantSpecials.map(function (special) { return (<react_native_1.TouchableOpacity key={special.id} onPress={function () { return onLaunchSubApp('FOOD'); }} style={styles.horizontalCard} activeOpacity={0.9}>
            <react_native_1.View style={styles.cardImageContainer}>
              <react_native_1.Image source={{ uri: special.imageUrl }} style={styles.cardImg}/>
              <react_native_1.View style={[styles.offerBadge, { backgroundColor: '#f59e0b', borderColor: '#fbbf24' }]}>
                <react_native_1.Text style={styles.offerBadgeText}>{special.badge}</react_native_1.Text>
              </react_native_1.View>
              <react_native_1.View style={styles.miniAppBadge}>
                <react_native_1.Text style={styles.miniAppBadgeText}>{special.emoji}</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>
            <react_native_1.Text style={styles.cardTitle} numberOfLines={1}>{special.name}</react_native_1.Text>
            <react_native_1.Text style={styles.cardSubtitle}>{special.restaurant}</react_native_1.Text>
            <react_native_1.View style={styles.cardFooter}>
              <react_native_1.Text style={[styles.promoPrice, { color: '#1E5D44' }]}>{special.price}</react_native_1.Text>
              <react_native_1.View style={[styles.orderBadge, { backgroundColor: '#1E5D44' }]}>
                <react_native_1.Text style={styles.orderBadgeText}>Order Now</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>
          </react_native_1.TouchableOpacity>); })}
      </react_native_1.ScrollView>

    </react_native_1.ScrollView>);
}
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    sectionHeader: {
        paddingHorizontal: 16,
        marginTop: 14,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectorsCard: {
        marginHorizontal: 16,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 1,
        marginBottom: 16,
    },
    sectorsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    sectorButton: {
        alignItems: 'center',
        width: '23%',
    },
    sectorCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderWidth: 2,
        borderColor: '#f8fafc',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f1f5f9',
        shadowColor: '#1162D3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 2,
    },
    sectorImg: {
        width: '100%',
        height: '100%',
    },
    sectorEmojiOverlay: {
        position: 'absolute',
        bottom: -1,
        right: -1,
        backgroundColor: '#ffffff',
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    sectorEmojiText: {
        fontSize: 10,
    },
    sectorName: {
        fontSize: 10,
        fontWeight: '900',
        color: '#1e293b',
        marginTop: 10,
        textTransform: 'uppercase',
    },
    sectorTagline: {
        fontSize: 8,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 2,
    },
    adCard: {
        marginHorizontal: 16,
        height: 176,
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#0f172a',
        marginBottom: 16,
    },
    adBgImg: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        opacity: 0.85,
    },
    adGradientOverlay: {
        position: 'absolute',
        top: 0, right: 0, bottom: 0, left: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
    },
    adTag: {
        position: 'absolute',
        top: 14,
        left: 14,
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    adTagText: {
        color: '#ffffff',
        fontSize: 8,
        fontWeight: '900',
        textTransform: 'uppercase',
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    adContent: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
    },
    adBrand: {
        color: '#10b981',
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    adTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '900',
        marginTop: 4,
        lineHeight: 18,
    },
    adDesc: {
        color: '#cbd5e1',
        fontSize: 10,
        fontWeight: '500',
        marginTop: 4,
        lineHeight: 14,
    },
    sectionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    rowTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    seeAllBtn: {
        backgroundColor: '#ecfdf5',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#d1fae5',
    },
    seeAllBtnText: {
        color: '#1E5D44',
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    topVotedText: {
        fontSize: 8,
        color: '#94a3b8',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    horizontalScrollContent: {
        paddingLeft: 16,
        paddingRight: 4,
        paddingBottom: 16,
    },
    horizontalCard: {
        width: 256,
        backgroundColor: '#ffffff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        padding: 14,
        marginRight: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 1,
    },
    cardImageContainer: {
        height: 128,
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f8fafc',
    },
    cardImg: {
        width: '100%',
        height: '100%',
    },
    offerBadge: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: '#1E5D44',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#34d399',
    },
    offerBadgeText: {
        color: '#ffffff',
        fontSize: 8,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    miniAppBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    miniAppBadgeText: {
        fontSize: 12,
    },
    ratingOverlayRight: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        borderWidth: 0.5,
        borderColor: '#e2e8f0',
    },
    ratingOverlayText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#f59e0b',
    },
    cardTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 12,
    },
    cardSubtitle: {
        fontSize: 9.5,
        color: '#94a3b8',
        fontWeight: '700',
        marginTop: 4,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    promoPrice: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#1E5D44',
    },
    originalPrice: {
        fontSize: 9.5,
        color: '#94a3b8',
        textDecorationLine: 'line-through',
        fontWeight: '600',
        marginLeft: 6,
    },
    orderBadge: {
        backgroundColor: '#1E5D44',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    orderBadgeText: {
        color: '#ffffff',
        fontSize: 8.5,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ratingLabel: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    ratingLabelText: {
        color: '#ffffff',
        fontSize: 8.5,
        fontWeight: '900',
        marginLeft: 3,
    },
    resBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#e2e8f0',
    },
    resBadgeText: {
        color: '#1E5D44',
        fontSize: 8,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    heartBtn: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    detailText: {
        fontSize: 9,
        color: '#64748b',
        fontWeight: '700',
        marginLeft: 3,
    },
    historyCategoryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 10,
        marginBottom: 8,
    },
    historyCategoryTitle: {
        fontSize: 9,
        fontWeight: '900',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    historyCategoryDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    historyScrollContent: {
        paddingLeft: 16,
        paddingRight: 4,
        paddingBottom: 10,
    },
    historyItemCard: {
        width: 256,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        padding: 12,
        marginRight: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.01,
        shadowRadius: 4,
        elevation: 1,
    },
    historyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    historyImgWrapper: {
        width: 46,
        height: 46,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f8fafc',
        borderWidth: 0.5,
        borderColor: '#e2e8f0',
    },
    historyImg: {
        width: '100%',
        height: '100%',
    },
    historyIconStamp: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: 'rgba(255,255,255,0.95)',
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    historyIconText: {
        fontSize: 8,
    },
    historyTextCol: {
        marginLeft: 10,
        flex: 1,
    },
    historyName: {
        fontSize: 10,
        fontWeight: '900',
        color: '#0f172a',
    },
    historyDesc: {
        fontSize: 8,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 2,
    },
    historyRight: {
        alignItems: 'flex-end',
    },
    historyPrice: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#0f172a',
    },
    historyAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginTop: 4,
    },
    historyAddBtnAdded: {
        backgroundColor: '#10b981',
    },
    historyAddBtnText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#334155',
        textTransform: 'uppercase',
    },
    historyAddBtnTextAdded: {
        color: '#ffffff',
    },
});
