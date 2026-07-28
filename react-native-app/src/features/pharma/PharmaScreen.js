"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PharmaScreen = PharmaScreen;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var SCREEN_WIDTH = react_native_1.Dimensions.get('window').width;
var ALL_CATEGORIES = [
    { id: 'vaccine', name: 'Vaccine', count: '250 products', icon: '💉' },
    { id: 'vitamin', name: 'Vitamine', count: '150 products', icon: '💊' },
    { id: 'supplements', name: 'Supplements', count: '300 products', icon: '🧴' },
    { id: 'fever', name: 'Fever', count: '67 products', icon: '🌡️' },
    { id: 'antiseptic', name: 'Antiseptic', count: '250 products', icon: '🧴' },
    { id: 'hypertension', name: 'Hypertension', count: '150 products', icon: '❤️' },
    { id: 'asthma', name: 'Asthma and Breathing', count: '300 products', icon: '🫁' },
    { id: 'diarrhea', name: 'Diarrhea', count: '87 products', icon: '💧' },
];
var PHARMA_PRODUCTS_DB = [
    {
        id: 'ph-t1',
        category: 'vitamin',
        name: 'Turmeric & Ginger Gummies',
        price: 810,
        originalPrice: 1250,
        discountBadge: '14% OFF',
        rating: 5,
        reviewsCount: 250,
        image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400',
        emoji: '🍊',
        desc: 'With 270mg of curcumin extract per serving this powerful anti-oxidant treat will put you back in control of your body.',
    },
    {
        id: 'ph-t2',
        category: 'vitamin',
        name: 'Collagen Complex Gummies',
        price: 810,
        originalPrice: 1100,
        discountBadge: '15% OFF',
        rating: 4.8,
        reviewsCount: 140,
        image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?auto=format&fit=crop&q=80&w=400&h=400',
        emoji: '💊',
        desc: 'Nourish your skin, hair, and nails from within. Formulated with premium hydrolyzed collagen peptides and active vitamins.',
    },
    {
        id: 'ph-f1',
        category: 'fever',
        name: 'Paracetamol 500mg (10 Tabs)',
        price: 120,
        originalPrice: 150,
        discountBadge: '20% OFF',
        rating: 4.9,
        reviewsCount: 890,
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400&h=400',
        emoji: '💊',
        desc: 'Effective relief from fever and mild to moderate pain. Consult a physician before exceeding daily dose limitations.',
    },
    {
        id: 'ph-s1',
        category: 'supplements',
        name: 'Omega 3 Fish Oil (60 Caps)',
        price: 650,
        originalPrice: 800,
        discountBadge: '18% OFF',
        rating: 4.7,
        reviewsCount: 420,
        image: 'https://images.unsplash.com/photo-1550572017-edb3f79025ea?auto=format&fit=crop&q=80&w=400&h=400',
        emoji: '🐟',
        desc: 'Double strength EPA and DHA for heart health, brain function and joint support.',
    }
];
function PharmaScreen(_a) {
    var addToCart = _a.addToCart, onProductClick = _a.onProductClick;
    var _b = (0, react_1.useState)('vitamin'), selectedCat = _b[0], setSelectedCat = _b[1];
    var _c = (0, react_1.useState)(null), addedId = _c[0], setAddedId = _c[1];
    var filteredProducts = PHARMA_PRODUCTS_DB.filter(function (p) { return p.category === selectedCat; });
    var handleAddToCart = function (product) {
        if (addToCart)
            addToCart(product.id, product.name, product.price, product.emoji);
        setAddedId(product.id);
        setTimeout(function () { return setAddedId(null); }, 1500);
    };
    return (<react_native_1.ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentPadding}>
      
      {/* Search Header */}
      <react_native_1.View style={styles.headerBox}>
        <react_native_1.View style={styles.headerTop}>
          <lucide_react_native_1.Activity size={24} color="#059669"/>
          <react_native_1.View>
            <react_native_1.Text style={styles.headerTitle}>Pharmacy</react_native_1.Text>
            <react_native_1.Text style={styles.headerSub}>Delivered in 30 minutes</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>
        <react_native_1.View style={styles.trustBadge}>
          <lucide_react_native_1.ShieldCheck size={12} color="#059669"/>
          <react_native_1.Text style={styles.trustText}>100% Genuine Medicines • Vetted Pharmacies</react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      {/* Categories */}
      <react_native_1.ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catScrollContent}>
        {ALL_CATEGORIES.map(function (cat) {
            var isActive = selectedCat === cat.id;
            return (<react_native_1.TouchableOpacity key={cat.id} style={[styles.catBtn, isActive && styles.catBtnActive]} onPress={function () { return setSelectedCat(cat.id); }}>
              <react_native_1.Text style={styles.catEmoji}>{cat.icon}</react_native_1.Text>
              <react_native_1.Text style={[styles.catText, isActive && styles.catTextActive]}>{cat.name}</react_native_1.Text>
            </react_native_1.TouchableOpacity>);
        })}
      </react_native_1.ScrollView>

      {/* Product List */}
      <react_native_1.View style={styles.productsGrid}>
        {filteredProducts.map(function (product) {
            var isAdded = addedId === product.id;
            return (<react_native_1.TouchableOpacity key={product.id} style={styles.productCard} onPress={function () { return onProductClick && onProductClick(product); }} activeOpacity={0.9}>
              <react_native_1.View style={styles.imageContainer}>
                <react_native_1.Image source={{ uri: product.image }} style={styles.image}/>
                <react_native_1.View style={styles.discountBadge}>
                  <react_native_1.Text style={styles.discountText}>{product.discountBadge}</react_native_1.Text>
                </react_native_1.View>
                <react_native_1.TouchableOpacity style={styles.favBtn}>
                  <lucide_react_native_1.Heart size={14} color="#94a3b8"/>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>
              
              <react_native_1.View style={styles.cardContent}>
                <react_native_1.Text style={styles.ratingText}>★ {product.rating} ({product.reviewsCount})</react_native_1.Text>
                <react_native_1.Text style={styles.productName} numberOfLines={2}>{product.name}</react_native_1.Text>
                
                <react_native_1.View style={styles.priceRow}>
                  <react_native_1.View>
                    <react_native_1.Text style={styles.price}>₹{product.price}</react_native_1.Text>
                    <react_native_1.Text style={styles.originalPrice}>₹{product.originalPrice}</react_native_1.Text>
                  </react_native_1.View>
                  <react_native_1.TouchableOpacity style={[styles.addBtn, isAdded ? styles.addBtnAdded : {}]} onPress={function () { return handleAddToCart(product); }}>
                    {isAdded ? (<lucide_react_native_1.CheckCircle size={14} color="#ffffff"/>) : (<react_native_1.Text style={styles.addBtnText}>ADD</react_native_1.Text>)}
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
        backgroundColor: '#ffffff',
    },
    contentPadding: {
        paddingBottom: 40,
    },
    headerBox: {
        padding: 16,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
    },
    headerSub: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    trustBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ecfdf5',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    trustText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#059669',
    },
    catScroll: {
        paddingVertical: 16,
    },
    catScrollContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    catBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    catBtnActive: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    catEmoji: {
        fontSize: 14,
    },
    catText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    catTextActive: {
        color: '#ffffff',
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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 12,
        overflow: 'hidden',
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#f8fafc',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    discountBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#ef4444',
        paddingVertical: 3,
        paddingHorizontal: 6,
        borderRadius: 6,
    },
    discountText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#ffffff',
    },
    favBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#ffffff',
        padding: 6,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    cardContent: {
        padding: 12,
    },
    ratingText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#f59e0b',
        marginBottom: 4,
    },
    productName: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 12,
        height: 32,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    price: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0f172a',
    },
    originalPrice: {
        fontSize: 9,
        fontWeight: '600',
        color: '#94a3b8',
        textDecorationLine: 'line-through',
    },
    addBtn: {
        backgroundColor: '#0f172a',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    addBtnAdded: {
        backgroundColor: '#059669',
    },
    addBtnText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#ffffff',
    },
});
