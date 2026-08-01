import type { AppBrand } from '../types';

export const portalSectors = [
  { emoji: '🛍️', name: 'FA Mart', tagline: 'Shop the latest trends', imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=200&h=200', themeColor: '#1162D3', app: 'MART' as AppBrand },
  { emoji: '🍲', name: 'Food', tagline: 'Taste the extraordinary', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=200&h=200', themeColor: '#1E5D44', app: 'FOOD' as AppBrand },
  { emoji: '🍏', name: 'Grocery', tagline: 'Fresh from the farm', imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200', themeColor: '#10B981', app: 'GROCERY' as AppBrand },
  { emoji: '💊', name: 'Pharma', tagline: 'Your health, our priority', imageUrl: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=200&h=200', themeColor: '#065F46', app: 'PHARMA' as AppBrand },
];

export const topAdSlides = [
  { title: '💊 Free Pharma Delivery', tagline: 'On your first order', badge: 'LIVE VIDEO CAM', imageUrl: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&q=80&w=800&h=400', targetApp: 'PHARMA' as AppBrand },
  { title: '🍎 Farm Fresh Apples', tagline: 'Direct from Kashmir valleys', badge: 'LIVE NOW', imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=800&h=400', targetApp: 'GROCERY' as AppBrand },
  { title: '🍕 Monsoon Special Pizza', tagline: 'Buy 1 Get 1 Free', badge: 'FLASH DEAL', imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=800&h=400', targetApp: 'FOOD' as AppBrand },
];

export const sponsoredAds = [
  { title: 'Truffle Mushroom Burger', tagline: 'Limited edition plant-based smash', brand: 'Hungry Minds', discount: '20% OFF', imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600&h=300', targetApp: 'FOOD' as AppBrand },
  { title: 'Air Max Retro Kicks', tagline: 'Limited street drop', brand: 'Nike', discount: 'FLAT ₹2000 OFF', imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600&h=300', targetApp: 'MART' as AppBrand },
  { title: 'Immunity Shot Pack', tagline: 'Daily wellness boost', brand: 'Fa Pharma', discount: 'Buy 2 Get 1', imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=600&h=300', targetApp: 'PHARMA' as AppBrand },
];

export const recentlyViewedHistory = [
  { id: 'rh-1', name: 'Spicy Tonkotsu Ramen', price: 450, emoji: '🍜', imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=200&h=200', activityTag: 'Ordered again' },
  { id: 'rh-2', name: 'Premium Cotton Hoodie', price: 1499, emoji: '🧥', imageUrl: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=200&h=200', activityTag: 'In your cart' },
  { id: 'rh-3', name: 'Organic Royal Gala Apples', price: 249, emoji: '🍎', imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=200&h=200', activityTag: 'Weekly staple' },
  { id: 'rh-4', name: 'Vitamin C Gummies', price: 499, emoji: '🍊', imageUrl: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=200&h=200', activityTag: 'Low stock' },
];

export const todaysOffers = [
  { dishName: 'Spicy Tuna Sushi Roll', originalPrice: 490, promoPrice: 350, restaurant: 'Kyoto House', discountBadge: '-29%', emoji: '🍣', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=400&h=300' },
  { dishName: 'Wireless Earbuds Pro', originalPrice: 5999, promoPrice: 3999, restaurant: 'Tech Zone', discountBadge: '-33%', emoji: '🎧', image: 'https://images.unsplash.com/photo-1590674899484-d5640d2f9365?auto=format&fit=crop&q=80&w=400&h=300' },
  { dishName: 'Fresh Avocados (4pcs)', originalPrice: 240, promoPrice: 160, restaurant: 'Farm Fresh', discountBadge: '-33%', emoji: '🥑', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&q=80&w=400&h=300' },
  { dishName: 'Multivitamin Daily Pack', originalPrice: 899, promoPrice: 599, restaurant: 'Fa Pharma', discountBadge: '-33%', emoji: '💊', image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=300' },
];

export const mixedRecommendations = [
  { id: 'mr-1', name: 'Creamy Mushroom Soup', price: 220, sector: 'Food', rating: 4.7, imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=400&h=300' },
  { id: 'mr-2', name: 'Mechanical Keyboard', price: 2999, sector: 'Mart', rating: 4.8, imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=400&h=300' },
  { id: 'mr-3', name: 'Greek Yogurt Tub', price: 180, sector: 'Grocery', rating: 4.8, imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=400&h=300' },
  { id: 'mr-4', name: 'Sleep Elixir Gummies', price: 420, sector: 'Pharma', rating: 4.7, imageUrl: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?auto=format&fit=crop&q=80&w=400&h=300' },
];

export const popularDining = [
  { name: 'Lobster Thermidor', cuisine: 'French • Premium', price: 1250, rating: '4.9', trending: true, image: 'https://images.unsplash.com/photo-1559737558-2f5304b0c0d0?auto=format&fit=crop&q=80&w=400&h=300' },
  { name: 'Kobe Beef Sushi', cuisine: 'Japanese • Raw', price: 1899, rating: '4.8', trending: true, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=400&h=300' },
  { name: 'Vegan Buddha Bowl', cuisine: 'Healthy • Bowl', price: 490, rating: '4.7', trending: false, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400&h=300' },
];

export const recentlyViewedMart = [
  { name: 'Smart Air Purifier', price: 8999, emoji: '🌪️', image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&q=80&w=200&h=200', badge: 'Mega Deal' },
  { name: 'Mechanical Keyboard', price: 2999, emoji: '⌨️', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=200&h=200', badge: 'Popular' },
  { name: 'Noise Cancelling Headphones', price: 4499, emoji: '🎧', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=200&h=200', badge: 'Top Rated' },
];

export const recentlyViewedGrocery = [
  { name: 'Artisan Sourdough Loaf', price: 150, emoji: '🍞', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200&h=200', badge: 'Baked Daily' },
  { name: 'Organic Avocados (2pcs)', price: 160, emoji: '🥑', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&q=80&w=200&h=200', badge: 'Trending' },
  { name: 'Almond Milk 1L', price: 190, emoji: '🥛', image: 'https://images.unsplash.com/photo-1553456558-aff63285bdd1?auto=format&fit=crop&q=80&w=200&h=200', badge: 'Plant Based' },
];

export const recentlyViewedPharma = [
  { name: 'Vitamin C Gummies', price: 499, emoji: '🍊', image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=200&h=200', badge: 'Best Seller' },
  { name: 'First Aid Kit', price: 799, emoji: '🩹', image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&q=80&w=200&h=200', badge: 'Essential' },
  { name: 'Sleep Elixir Drops', price: 599, emoji: '🍵', image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?auto=format&fit=crop&q=80&w=200&h=200', badge: 'New' },
];

export const faMartFinds = [
  { name: 'Premium Leather Bag', price: 2499, rating: '4.8', tag: 'Bestseller', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=400&h=300' },
  { name: 'Smart Water Bottle', price: 1299, rating: '4.7', tag: 'New Launch', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=400&h=300' },
];

export const restaurantSpecials = [
  { name: 'Lobster Thermidor', cuisine: 'French • Premium', price: 1250, icon: '🏆', image: 'https://images.unsplash.com/photo-1559737558-2f5304b0c0d0?auto=format&fit=crop&q=80&w=400&h=300' },
  { name: 'Kobe Beef Sushi', cuisine: 'Japanese • Raw', price: 1899, icon: '🏆', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=400&h=300' },
  { name: 'Vegan Buddha Bowl', cuisine: 'Healthy • Bowl', price: 490, icon: '🏆', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400&h=300' },
];
