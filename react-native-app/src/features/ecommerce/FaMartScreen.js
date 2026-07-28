"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FaMartScreen = FaMartScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var mockProducts_1 = require("../../data/mockProducts");
var SCREEN_WIDTH = react_native_1.Dimensions.get('window').width;
function FaMartScreen(_a) {
    var addToCart = _a.addToCart, onProductClick = _a.onProductClick;
    var _b = (0, react_1.useState)('All'), selectedSubCat = _b[0], setSelectedSubCat = _b[1];
    var _c = (0, react_1.useState)(0), activeBanner = _c[0], setActiveBanner = _c[1];
    var _d = (0, react_1.useState)(null), addedAnimationId = _d[0], setAddedAnimationId = _d[1];
    var banners = [
        {
            title: "Electronic Bonanza Sale",
            subtitle: "UP TO 50% OFF",
            desc: "Top deals on audio & smartphones with premium glass screens",
            image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600&h=300",
            bgGradient: ['rgba(30, 58, 138, 0.9)', 'rgba(15, 23, 42, 0.8)', 'transparent'],
            accent: "#2F80ED"
        },
        {
            title: "Great Winter Collection",
            subtitle: "FLAT 40% OFF",
            desc: "Chic luxury fashion curated for modern premium street style",
            image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=600&h=300",
            bgGradient: ['rgba(88, 28, 135, 0.95)', 'rgba(88, 28, 135, 0.85)', 'transparent'],
            accent: "#E040FB"
        }
    ];
    var subCategories = [
        { name: 'All', icon: lucide_react_native_1.ShoppingBag, color: '#475569', bg: '#f1f5f9' },
        { name: 'Fashion', icon: lucide_react_native_1.Shirt, color: '#f43f5e', bg: '#fff1f2' },
        { name: 'Mobiles', icon: lucide_react_native_1.Smartphone, color: '#3b82f6', bg: '#eff6ff' },
        { name: 'Beauty', icon: lucide_react_native_1.Sparkles, color: '#f59e0b', bg: '#fffbeb' },
        { name: 'Electronics', icon: lucide_react_native_1.Laptop, color: '#6366f1', bg: '#eef2ff' },
        { name: 'Toys', icon: lucide_react_native_1.Gamepad, color: '#10b981', bg: '#ecfdf5' },
        { name: 'Sports', icon: lucide_react_native_1.Trophy, color: '#f97316', bg: '#fff7ed' },
        { name: 'Appliances', icon: lucide_react_native_1.Tv, color: '#a855f7', bg: '#faf5ff' },
    ];
    var filteredProducts = selectedSubCat === 'All'
        ? mockProducts_1.martProducts
        : mockProducts_1.martProducts.filter(function (p) { return p.category === selectedSubCat; });
    var handleAddWithFeedback = function (id, name, price, emoji) {
        if (addToCart)
            addToCart(id, name, price, emoji);
        setAddedAnimationId(id);
        setTimeout(function () {
            setAddedAnimationId(null);
        }, 1500);
    };
    return (<react_native_1.ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
      
      {/* Banner */}
      <react_native_1.View style={styles.bannerContainer}>
        <react_native_1.ImageBackground source={{ uri: banners[activeBanner].image }} style={styles.bannerBg} imageStyle={styles.bannerImageStyle}>
          <react_native_1.View style={[styles.bannerOverlay, { backgroundColor: banners[activeBanner].bgGradient[0] }]}/>
          
          <react_native_1.View style={styles.bannerContent}>
            <react_native_1.Text style={styles.bannerSubtitle}>{banners[activeBanner].subtitle}</react_native_1.Text>
            <react_native_1.Text style={styles.bannerTitle}>{banners[activeBanner].title}</react_native_1.Text>
            <react_native_1.Text style={styles.bannerDesc} numberOfLines={2}>{banners[activeBanner].desc}</react_native_1.Text>
            
            <react_native_1.View style={styles.bannerActionRow}>
              <react_native_1.TouchableOpacity style={[styles.bannerBtn, { backgroundColor: banners[activeBanner].accent }]} onPress={function () {
            if (activeBanner === 0)
                setSelectedSubCat('Electronics');
            else
                setSelectedSubCat('Fashion');
        }}>
                <react_native_1.Text style={styles.bannerBtnText}>SHOP NOW</react_native_1.Text>
              </react_native_1.TouchableOpacity>

              <react_native_1.View style={styles.dotsRow}>
                {banners.map(function (_, idx) { return (<react_native_1.TouchableOpacity key={idx} style={[styles.dot, activeBanner === idx ? styles.activeDot : styles.inactiveDot]} onPress={function () { return setActiveBanner(idx); }}/>); })}
              </react_native_1.View>
            </react_native_1.View>
          </react_native_1.View>
        </react_native_1.ImageBackground>
      </react_native_1.View>

      {/* Subcategories */}
      <react_native_1.View style={styles.sectionContainer}>
        <react_native_1.Text style={styles.sectionTitle}>EXPLORE CATEGORIES</react_native_1.Text>
        <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subCatScrollList}>
          {subCategories.map(function (sub, index) {
            var isSelected = selectedSubCat === sub.name;
            var Icon = sub.icon;
            return (<react_native_1.TouchableOpacity key={index} style={[styles.subCatBtn, isSelected ? styles.subCatBtnActive : styles.subCatBtnInactive]} onPress={function () { return setSelectedSubCat(sub.name); }}>
                <react_native_1.View style={[styles.subCatIconBg, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : sub.bg }]}>
                  <Icon size={14} color={isSelected ? '#ffffff' : sub.color}/>
                </react_native_1.View>
                <react_native_1.Text style={[styles.subCatText, isSelected ? styles.subCatTextActive : styles.subCatTextInactive]}>
                  {sub.name}
                </react_native_1.Text>
              </react_native_1.TouchableOpacity>);
        })}
        </react_native_1.ScrollView>
      </react_native_1.View>

      {/* Products list header */}
      <react_native_1.View style={styles.productsHeaderRow}>
        <react_native_1.View style={styles.productsTitleGroup}>
          <lucide_react_native_1.TrendingUp size={14} color="#1162D3"/>
          <react_native_1.Text style={styles.productsTitleText}>
            {selectedSubCat === 'All' ? 'Trending Products' : "".concat(selectedSubCat, " Deals")}
          </react_native_1.Text>
        </react_native_1.View>
        <react_native_1.Text style={styles.productsCountText}>{filteredProducts.length} items</react_native_1.Text>
      </react_native_1.View>

      {/* Grid of products */}
      <react_native_1.View style={styles.productsGrid}>
        {filteredProducts.map(function (product) {
            var isAdded = addedAnimationId === product.id;
            return (<react_native_1.TouchableOpacity key={product.id} style={styles.productCard} activeOpacity={0.9} onPress={function () { return onProductClick && onProductClick(product); }}>
              <react_native_1.View style={styles.productImageContainer}>
                <react_native_1.Image source={{ uri: product.image }} style={styles.productImage} resizeMode="cover"/>
                {product.badge && (<react_native_1.View style={[styles.productBadge, { backgroundColor: product.badgeBg || '#1162D3' }]}>
                    <react_native_1.Text style={styles.productBadgeText}>{product.badge}</react_native_1.Text>
                  </react_native_1.View>)}
                
                {/* Rating pill */}
                <react_native_1.View style={styles.ratingPill}>
                  <react_native_1.Text style={styles.ratingText}>{product.rating}</react_native_1.Text>
                  <lucide_react_native_1.Star size={8} color="#f59e0b" fill="#f59e0b"/>
                  <react_native_1.Text style={styles.ratingCount}>({product.reviews})</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              <react_native_1.View style={styles.productInfo}>
                <react_native_1.Text style={styles.productCategory}>{product.category}</react_native_1.Text>
                <react_native_1.Text style={styles.productName} numberOfLines={2}>{product.name}</react_native_1.Text>
                <react_native_1.Text style={styles.productDesc} numberOfLines={1}>{product.desc}</react_native_1.Text>
                
                <react_native_1.View style={styles.productFooterRow}>
                  <react_native_1.View>
                    <react_native_1.Text style={styles.productPrice}>₹{product.price}</react_native_1.Text>
                  </react_native_1.View>
                  
                  <react_native_1.TouchableOpacity style={[styles.addBtn, isAdded ? styles.addBtnSuccess : styles.addBtnDefault]} onPress={function () { return handleAddWithFeedback(product.id, product.name, product.price, product.emoji); }}>
                    {isAdded ? (<lucide_react_native_1.CheckCircle size={14} color="#ffffff"/>) : (<lucide_react_native_1.ShoppingCart size={14} color="#ffffff"/>)}
                  </react_native_1.TouchableOpacity>
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
        height: 150,
        borderRadius: 24,
        overflow: 'hidden',
        justifyContent: 'center',
        paddingLeft: 24,
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
        opacity: 0.85,
    },
    bannerContent: {
        zIndex: 10,
        maxWidth: '65%',
    },
    bannerSubtitle: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.5,
        color: '#34d399',
        textTransform: 'uppercase',
    },
    bannerTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#ffffff',
        marginTop: 4,
    },
    bannerDesc: {
        fontSize: 10,
        color: '#e2e8f0',
        fontWeight: '500',
        marginTop: 6,
        lineHeight: 14,
    },
    bannerActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    bannerBtn: {
        paddingHorizontal: 18,
        paddingVertical: 6,
        borderRadius: 16,
    },
    bannerBtnText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 9,
        letterSpacing: 1,
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 8,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    },
    activeDot: {
        width: 14,
        backgroundColor: '#ffffff',
    },
    inactiveDot: {
        width: 6,
        backgroundColor: 'rgba(255,255,255,0.4)',
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
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
    },
    subCatBtnActive: {
        backgroundColor: '#1162D3',
        borderColor: '#1162D3',
    },
    subCatBtnInactive: {
        backgroundColor: '#ffffff',
        borderColor: '#f1f5f9',
    },
    subCatIconBg: {
        width: 24,
        height: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
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
    productsTitleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    productsTitleText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0f172a',
    },
    productsCountText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
    },
    productsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
        justifyContent: 'space-between',
    },
    productCard: {
        width: (SCREEN_WIDTH - 36) / 2, // 2 columns with padding
        backgroundColor: '#ffffff',
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        overflow: 'hidden',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    productImageContainer: {
        width: '100%',
        aspectRatio: 1,
        position: 'relative',
        backgroundColor: '#f8fafc',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    productBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    productBadgeText: {
        color: '#ffffff',
        fontSize: 8,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ratingPill: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
    },
    ratingText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#0f172a',
    },
    ratingCount: {
        fontSize: 8,
        fontWeight: '700',
        color: '#64748b',
    },
    productInfo: {
        padding: 12,
    },
    productCategory: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    productName: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
        lineHeight: 16,
        marginBottom: 4,
    },
    productDesc: {
        fontSize: 9,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 10,
    },
    productFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    productPrice: {
        fontSize: 13,
        fontWeight: '900',
        color: '#1162D3',
    },
    addBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addBtnDefault: {
        backgroundColor: '#0f172a',
    },
    addBtnSuccess: {
        backgroundColor: '#10b981',
    },
});
