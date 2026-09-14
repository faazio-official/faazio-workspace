/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type {
  Product,
  PortalSector,
  AdSlide,
  SponsoredAd,
  RecentlyViewedItem,
  TodaysOffer,
  MixedRecommendation,
  PopularDiningItem,
  FaMartFind,
  RestaurantSpecial,
} from '../types';

export const portalSectors: PortalSector[] = [
  { emoji: '🛍️', name: 'Mart', tagline: 'Shop the latest trends', imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?fm=jpg&fit=crop&q=80&w=200&h=200', themeColor: '#1162D3', app: 'MART' },
  { emoji: '🍲', name: 'Food', tagline: 'Taste the extraordinary', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?fm=jpg&fit=crop&q=80&w=200&h=200', themeColor: '#1E5D44', app: 'FOOD' },
  { emoji: '💊', name: 'Pharma', tagline: 'Your health, our priority', imageUrl: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?fm=jpg&fit=crop&q=80&w=200&h=200', themeColor: '#065F46', app: 'PHARMA' },
];

export const topAdSlides: AdSlide[] = [
  { title: '💊 Free Pharma Delivery', tagline: 'On your first order', badge: 'LIVE VIDEO CAM', imageUrl: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?fm=jpg&fit=crop&q=80&w=800&h=400', targetApp: 'PHARMA' },
  { title: '🍎 Farm Fresh Apples', tagline: 'Direct from Kashmir valleys', badge: 'LIVE NOW', imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?fm=jpg&fit=crop&q=80&w=800&h=400', targetApp: 'MART' },
  { title: '🍕 Monsoon Special Pizza', tagline: 'Buy 1 Get 1 Free', badge: 'FLASH DEAL', imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?fm=jpg&fit=crop&q=80&w=800&h=400', targetApp: 'FOOD' },
];

export const sponsoredAds: SponsoredAd[] = [
  { title: 'Truffle Mushroom Burger', tagline: 'Limited edition plant-based smash', brand: 'Hungry Minds', discount: '20% OFF', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?fm=jpg&fit=crop&q=80&w=600&h=300', targetApp: 'FOOD' },
  { title: 'Air Max Retro Kicks', tagline: 'Limited street drop', brand: 'Nike', discount: 'FLAT ₹2000 OFF', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?fm=jpg&fit=crop&q=80&w=600&h=300', targetApp: 'MART' },
  { title: 'Immunity Shot Pack', tagline: 'Daily wellness boost', brand: 'Pharma', discount: 'Buy 2 Get 1', imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=600&h=300', targetApp: 'PHARMA' },
];

export const recentlyViewedHistory: RecentlyViewedItem[] = [
  { id: 'rh-1', name: 'Spicy Tonkotsu Ramen', price: 450, emoji: '🍜', imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?fm=jpg&fit=crop&q=80&w=200&h=200', activityTag: 'Ordered again' },
  { id: 'rh-2', name: 'Premium Cotton Hoodie', price: 1499, emoji: '🧥', imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?fm=jpg&fit=crop&q=80&w=200&h=200', activityTag: 'In your cart' },
  { id: 'rh-3', name: 'Organic Royal Gala Apples', price: 249, emoji: '🍎', imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?fm=jpg&fit=crop&q=80&w=200&h=200', activityTag: 'Weekly staple' },
  { id: 'rh-4', name: 'Vitamin C Gummies', price: 499, emoji: '🍊', imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=200&h=200', activityTag: 'Low stock' },
];

export const todaysOffers: TodaysOffer[] = [
  { dishName: 'Spicy Tuna Sushi Roll', originalPrice: 490, promoPrice: 350, restaurant: 'Kyoto House', discountBadge: '-29%', emoji: '🍣', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { dishName: 'Wireless Earbuds Pro', originalPrice: 5999, promoPrice: 3999, restaurant: 'Tech Zone', discountBadge: '-33%', emoji: '🎧', image: 'https://images.unsplash.com/photo-1590674899484-d5640d2f9365?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { dishName: 'Fresh Avocados (4pcs)', originalPrice: 240, promoPrice: 160, restaurant: 'Farm Fresh', discountBadge: '-33%', emoji: '🥑', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { dishName: 'Multivitamin Daily Pack', originalPrice: 899, promoPrice: 599, restaurant: 'Pharma', discountBadge: '-33%', emoji: '💊', image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=400&h=300' },
];

export const mixedRecommendations: MixedRecommendation[] = [
  { id: 'mr-1', name: 'Creamy Mushroom Soup', price: 220, sector: 'Food', rating: 4.7, imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'mr-2', name: 'Mechanical Keyboard', price: 2999, sector: 'Mart', rating: 4.8, imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'mr-3', name: 'Greek Yogurt Tub', price: 180, sector: 'Mart', rating: 4.8, imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { id: 'mr-4', name: 'Sleep Elixir Gummies', price: 420, sector: 'Pharma', rating: 4.7, imageUrl: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?fm=jpg&fit=crop&q=80&w=400&h=300' },
];

export const popularDining: PopularDiningItem[] = [
  { name: 'Lobster Thermidor', cuisine: 'French • Premium', price: 1250, rating: '4.9', trending: true, image: 'https://images.unsplash.com/photo-1559737558-2f5304b0c0d0?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { name: 'Kobe Beef Sushi', cuisine: 'Japanese • Raw', price: 1899, rating: '4.8', trending: true, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { name: 'Vegan Buddha Bowl', cuisine: 'Healthy • Bowl', price: 490, rating: '4.7', trending: false, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?fm=jpg&fit=crop&q=80&w=400&h=300' },
];

export const recentlyViewedMart: Product[] = [
  { id: 'rvm-1', app: 'MART', category: 'Fashion', name: 'Premium Cotton Hoodie', price: 1499, originalPrice: 1999, unit: 'M', emoji: '🧥', image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Ultra-soft heavyweight cotton fleece', rating: 4.8, badge: 'Mega Deal', badgeBg: 'bg-red-500', shop: 'Faazio' },
  { id: 'rvm-2', app: 'MART', category: 'Electronics', name: 'Slim Mechanical Keyboard', price: 2999, originalPrice: 3999, emoji: '⌨️', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Gateron brown switches with RGB backlight', rating: 4.8, badge: 'Popular', badgeBg: 'bg-slate-700', attributes: { type: 'Keyboard', brand: 'Faazio' } },
  { id: 'rvm-3', app: 'MART', category: 'Electronics', name: 'Pro Noise Cancelling Headphones', price: 4499, originalPrice: 5999, emoji: '🎧', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Hybrid ANC with memory foam earcups', rating: 4.9, badge: 'Top Rated', badgeBg: 'bg-purple-600', attributes: { type: 'Audio', brand: 'Faazio' } },
  { id: 'rvm-4', app: 'MART', category: 'Home Appliances', name: 'Smart Wi-Fi Air Purifier Pro', price: 8999, originalPrice: 11999, emoji: '🌪️', image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'True HEPA H13 filter with app monitoring', rating: 4.9, badge: 'Mega Deal', badgeBg: 'bg-emerald-600', attributes: { type: 'Air Purifier', brand: 'Faazio' } },
  // Formerly recentlyViewedGrocery — merged into the Mart rail (grocery → Mart).
  { id: 'rvg-1', app: 'MART', category: 'Fresh Produce', name: 'Organic Royal Gala Apples', price: 249, originalPrice: 320, unit: '1 kg', emoji: '🍎', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Certified zero-pesticide orchard apples', rating: 4.9, badge: 'Weekly staple', badgeBg: 'bg-green-500', attributes: { brand: 'Farm Fresh' } },
  { id: 'rvg-2', app: 'MART', category: 'Bakery', name: 'Artisan Sourdough Loaf', price: 150, originalPrice: 190, unit: '450g', emoji: '🍞', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Naturally leavened, baked fresh daily', rating: 4.8, badge: 'Baked Daily', badgeBg: 'bg-amber-500', attributes: { brand: 'Baker\'s Joy' } },
  { id: 'rvg-3', app: 'MART', category: 'Beverages', name: 'Almond Milk Unsweetened', price: 190, originalPrice: 250, unit: '1 L', emoji: '🥛', image: 'https://images.unsplash.com/photo-1553456558-aff63285bdd1?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Dairy-free toasted Mediterranean almonds', rating: 4.7, badge: 'Vegan Fit', badgeBg: 'bg-emerald-500', attributes: { brand: 'Plantful' } },
  { id: 'rvg-4', app: 'MART', category: 'Snacks', name: 'Sea Salt Multigrain Crisps', price: 95, originalPrice: 130, unit: '150g', emoji: '🍿', image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Baked with pink Himalayan salt', rating: 4.6, badge: 'Gluten-Free', badgeBg: 'bg-orange-500', attributes: { brand: 'CrunchCo' } },
  { id: 'rvm-5', app: 'MART', category: 'Fashion', name: 'Floral Maxi Summer Dress', price: 1899, originalPrice: 2799, unit: 'M', emoji: '👗', image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Flowy midi viscose dress with floral print', rating: 4.7, badge: 'Trending', badgeBg: 'bg-blue-500', attributes: { type: 'Dress', brand: 'Vibe' } },
];

export const recentlyViewedFood: Product[] = [
  { id: 'rvf-1', app: 'FOOD', category: 'Featured', name: 'Hainanese Chicken Rice', price: 349, emoji: '🍛', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Poached chicken over fragrant ginger rice', rating: 4.8, badge: 'Ordered again', shop: 'Hawker Lane' },
  { id: 'rvf-2', app: 'FOOD', category: 'Seafood', name: 'Spicy Seafood Ramen', price: 450, emoji: '🍜', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'House noodles in spicy seafood broth', rating: 4.9, badge: 'Ordered twice', shop: 'Ramen House' },
  { id: 'rvf-3', app: 'FOOD', category: 'Soup', name: 'Creamy Mushroom Soup', price: 220, emoji: '🥣', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Puréed mushrooms with truffle oil', rating: 4.7, badge: 'Favourite', shop: 'Soup Bar' },
  { id: 'rvf-4', app: 'FOOD', category: 'Biryani', name: 'Chicken Dum Biryani', price: 320, emoji: '🍛', image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Saffron basmati layered with tender chicken', rating: 4.8, badge: 'Ordered again', shop: 'Paradise Biryani House' },
];

export const recentlyViewedPharma: Product[] = [
  { id: 'rvp-1', app: 'PHARMA', category: 'vitamin', name: 'Turmeric & Ginger Gummies', price: 810, originalPrice: 940, unit: '60 gummies', emoji: '🍊', image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?fm=jpg&fit=crop&q=80&w=200&h=200', desc: '270mg curcumin anti-oxidant treat', rating: 5, badge: 'Best Seller', badgeBg: 'bg-amber-500', attributes: { brand: 'NutraWell' } },
  { id: 'rvp-2', app: 'PHARMA', category: 'fever', name: 'Paracetamol 500mg (10 Tabs)', price: 45, unit: '10 tablets', emoji: '💊', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?fm=jpg&fit=crop&q=80&w=200&h=200', desc: 'Effective relief from fever and pain', rating: 4.9, badge: 'Essential', badgeBg: 'bg-teal-500', attributes: { brand: 'MediSafe' } },
  { id: 'rvp-3', app: 'PHARMA', category: 'supplements', name: 'Whey Protein Isolate 500g', price: 1299, originalPrice: 1699, unit: '500g', emoji: '💪', image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2c1cf?fm=jpg&fit=crop&q=80&w=200&h=200', desc: '27g protein, zero sugar, fast absorb', rating: 4.9, badge: 'New', badgeBg: 'bg-indigo-500', attributes: { brand: 'FitFuel' } },
];

export const hotBrandDeals: Product[] = [
  { id: 'hbd-1', app: 'MART', category: 'Electronics', name: 'Pro Noise Cancelling Headphones', price: 4499, originalPrice: 5999, emoji: '🎧', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?fm=jpg&fit=crop&q=80&w=400&h=300', desc: 'Hybrid ANC, hi-res studio acoustics', rating: 4.9, badge: 'Top Rated', badgeBg: 'bg-purple-600', attributes: { type: 'Audio', brand: 'SoundPro' } },
  { id: 'hbd-2', app: 'MART', category: 'Home Appliances', name: 'Digital Touch Air Fryer 5L', price: 5499, originalPrice: 7999, emoji: '🍟', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?fm=jpg&fit=crop&q=80&w=400&h=300', desc: 'Rapid hot air with 8 preset modes', rating: 4.8, badge: '40% OFF', badgeBg: 'bg-rose-600', attributes: { type: 'Kitchen Appliance', brand: 'CrispHome' } },
  { id: 'hbd-3', app: 'MART', category: 'Fashion', name: 'Chic Leather Jacket', price: 3999, originalPrice: 5499, unit: 'M', emoji: '🧥', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?fm=jpg&fit=crop&q=80&w=400&h=300', desc: 'Double chrome zippers, satin lining', rating: 4.9, badge: 'Hot Drop', badgeBg: 'bg-red-500', attributes: { type: 'Jacket', brand: 'UrbanEdge' } },
  { id: 'hbd-4', app: 'MART', category: 'Fashion', name: 'Comfort Street Sneakers', price: 2499, originalPrice: 3299, unit: 'UK 9', emoji: '👟', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?fm=jpg&fit=crop&q=80&w=400&h=300', desc: 'Flyknit mesh, ultra-grip outsoles', rating: 4.7, badge: 'Trending', badgeBg: 'bg-blue-500', attributes: { type: 'Sneakers', brand: 'Stride' } },
  { id: 'hbd-5', app: 'MART', category: 'Mobiles', name: 'Faazio Phone Pro Max', price: 89999, originalPrice: 109999, emoji: '📱', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?fm=jpg&fit=crop&q=80&w=400&h=300', desc: 'Ceramic screen, triple camera', rating: 4.9, badge: 'Flagship', badgeBg: 'bg-indigo-600', attributes: { type: 'Phone', brand: 'Faazio', storage: '512GB' } },
];

export const faMartFinds: FaMartFind[] = [
  { name: 'Premium Leather Bag', price: 2499, rating: '4.8', tag: 'Bestseller', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { name: 'Smart Water Bottle', price: 1299, rating: '4.7', tag: 'New Launch', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?fm=jpg&fit=crop&q=80&w=400&h=300' },
];

export const restaurantSpecials: RestaurantSpecial[] = [
  { name: 'Lobster Thermidor', cuisine: 'French • Premium', price: 1250, icon: '🏆', image: 'https://images.unsplash.com/photo-1559737558-2f5304b0c0d0?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { name: 'Kobe Beef Sushi', cuisine: 'Japanese • Raw', price: 1899, icon: '🏆', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?fm=jpg&fit=crop&q=80&w=400&h=300' },
  { name: 'Vegan Buddha Bowl', cuisine: 'Healthy • Bowl', price: 490, icon: '🏆', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?fm=jpg&fit=crop&q=80&w=400&h=300' },
];
