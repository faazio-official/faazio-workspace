/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { Product } from '../types';

// Combined "Instant / Trending" feed — mixed catalog products across all four
// sub-apps. Each item carries its own `app`, so the feed renders each card with
// its native brand skin (via UniversalFeedCard).
export const instantFeed: Product[] = [
  { id: 'in-1', app: 'FOOD', category: 'Featured', name: 'Black Pepper Beef', price: 549, emoji: '🥩', rating: 4.8, desc: 'Tellicherry pepper, spring onion', image: 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Trending', badgeBg: 'bg-red-500' },
  { id: 'in-2', app: 'MART', category: 'Fashion', name: 'Comfort Street Sneakers', price: 2499, emoji: '👟', rating: 4.7, desc: 'Flyknit mesh with dynamic cushioning', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Trending', badgeBg: 'bg-blue-500' },
  { id: 'in-3', app: 'MART', category: 'Home Appliances', name: 'Digital Touch Air Fryer 5L', price: 5499, emoji: '🍟', rating: 4.8, desc: 'Rapid hot air with 8 preset modes', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=400&h=400', badge: '40% OFF', badgeBg: 'bg-rose-600' },
  { id: 'in-4', app: 'FOOD', category: 'Seafood', name: 'Squid Sweet & Sour', price: 399, emoji: '🦑', rating: 4.9, desc: 'Wok-tossed with caramelized pineapple', image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Chef Special', badgeBg: 'bg-orange-500' },
  { id: 'in-5', app: 'GROCERY', category: 'Fresh Produce', name: 'Fresh Farm Broccoli Crown', price: 120, emoji: '🥦', rating: 4.8, desc: 'Harvested fresh from local farms', image: 'https://images.unsplash.com/photo-1515002246390-7bf7e8f87b54?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Farm Pick', badgeBg: 'bg-green-500' },
  { id: 'in-6', app: 'MART', category: 'Electronics', name: 'Pro Noise Cancelling Headphones', price: 4499, emoji: '🎧', rating: 4.9, desc: 'Hybrid ANC, hi-res studio acoustics', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Top Rated', badgeBg: 'bg-purple-600' },
  { id: 'in-7', app: 'FOOD', category: 'Soup', name: 'Creamy Mushroom Soup', price: 220, emoji: '🥣', rating: 4.7, desc: 'Puréed mushrooms with truffle oil', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Trending', badgeBg: 'bg-amber-500' },
  { id: 'in-8', app: 'PHARMA', category: 'vitamin', name: 'Vitamin D3 2000 IU (60 Caps)', price: 450, emoji: '☀️', rating: 4.7, desc: 'Bone, immunity & calcium absorption', image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400', badge: '30% OFF', badgeBg: 'bg-amber-500' },
  { id: 'in-9', app: 'GROCERY', category: 'Snacks', name: 'Sea Salt Multigrain Crisps', price: 95, emoji: '🍿', rating: 4.6, desc: 'Baked with pink Himalayan salt', image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Gluten-Free', badgeBg: 'bg-orange-500' },
  { id: 'in-10', app: 'MART', category: 'Mobiles', name: 'Faazio Phone Pro Max', price: 89999, emoji: '📱', rating: 4.9, desc: 'Ceramic screen, triple camera', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Flagship', badgeBg: 'bg-indigo-600' },
  { id: 'in-11', app: 'FOOD', category: 'Featured', name: 'Golden Crispy Dumplings', price: 280, emoji: '🥟', rating: 4.6, desc: 'Pan-seared chicken & chive wrappers', image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Trending', badgeBg: 'bg-red-500' },
  { id: 'in-12', app: 'GROCERY', category: 'Beverages', name: 'Arabica Coffee Beans Medium', price: 450, emoji: '☕', rating: 4.9, desc: 'Caramel and hazelnut notes, freshly roasted', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Premium', badgeBg: 'bg-stone-700' },
];
