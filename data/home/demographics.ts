/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { Product } from '../types';

// Curated MART fashion picks per audience segment.
export const mensPicks: Product[] = [
  { id: 'men-1', app: 'MART', category: 'Fashion', name: 'Chic Leather Jacket', price: 3999, emoji: '🧥', rating: 4.9, desc: 'Double chrome zippers, satin inner lining', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Hot Drop', badgeBg: 'bg-red-500' },
  { id: 'men-2', app: 'MART', category: 'Sports', name: 'Adjustable Kettlebell Set', price: 2199, emoji: '🏋️', rating: 4.8, desc: 'Cast-iron handles, locks up to 10kg', image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Heavy Duty', badgeBg: 'bg-stone-700' },
  { id: 'men-3', app: 'MART', category: 'Fashion', name: 'Premium Cotton Hoodie', price: 1499, emoji: '🧥', rating: 4.8, desc: 'Heavyweight cotton fleece, dropped shoulders', image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Best Seller', badgeBg: 'bg-amber-500' },
  { id: 'men-4', app: 'MART', category: 'Electronics', name: 'Smart Fitness Tracker v3', price: 1999, emoji: '⌚', rating: 4.7, desc: 'Heart tracking, sleep staging, 10-day battery', image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Budget Pick', badgeBg: 'bg-blue-500' },
  { id: 'men-5', app: 'MART', category: 'Fashion', name: 'Comfort Street Sneakers', price: 2499, emoji: '👟', rating: 4.7, desc: 'Flyknit mesh with dynamic cushioning', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Trending', badgeBg: 'bg-blue-500' },
  { id: 'men-6', app: 'MART', category: 'Books & Stationery', name: 'Executive Hardcover Journal & Pen Set', price: 899, emoji: '📓', rating: 4.9, desc: '120gsm bleed-proof paper, brass rollerball', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Best Seller', badgeBg: 'bg-amber-600' },
];

export const womensPicks: Product[] = [
  { id: 'wom-1', app: 'MART', category: 'Beauty', name: 'Organic Hydrating Serum', price: 799, emoji: '🧴', rating: 4.8, desc: 'Multi-layer hyaluronic acid, glass skin glow', image: 'https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Eco-Choice', badgeBg: 'bg-emerald-500' },
  { id: 'wom-2', app: 'MART', category: 'Fashion', name: 'Premium Cotton Hoodie', price: 1499, emoji: '🧥', rating: 4.8, desc: 'Heavyweight cotton fleece, dropped shoulders', image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Best Seller', badgeBg: 'bg-amber-500' },
  { id: 'wom-3', app: 'MART', category: 'Fashion', name: 'Comfort Street Sneakers', price: 2499, emoji: '👟', rating: 4.7, desc: 'Flyknit mesh with dynamic cushioning', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Trending', badgeBg: 'bg-blue-500' },
  { id: 'wom-4', app: 'MART', category: 'Beauty', name: 'Matte Lip Cream Duo', price: 649, emoji: '💄', rating: 4.5, desc: '12-hour matte with jojoba extract', image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Duo Deal', badgeBg: 'bg-rose-500' },
  { id: 'wom-5', app: 'MART', category: 'Electronics', name: 'Pro Noise Cancelling Headphones', price: 4499, emoji: '🎧', rating: 4.9, desc: 'Hybrid ANC, hi-res studio acoustics', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Top Rated', badgeBg: 'bg-purple-600' },
  { id: 'wom-6', app: 'MART', category: 'Fashion', name: 'Premium Leather Bag', price: 2499, emoji: '👛', rating: 4.8, desc: 'Handcrafted full-grain leather tote', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Bestseller', badgeBg: 'bg-indigo-600' },
];

export const childrensPicks: Product[] = [
  { id: 'kid-1', app: 'MART', category: 'Toys', name: 'High-Speed RC Racing Car', price: 1249, emoji: '🏎️', rating: 4.7, desc: '2.4GHz full-scale RC with suspension', image: 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Kids Pick', badgeBg: 'bg-sky-500' },
  { id: 'kid-2', app: 'MART', category: 'Toys & Gifts', name: 'Modular Magnetic Building Blocks (100p)', price: 2499, emoji: '🧱', rating: 4.9, desc: 'STEM magnetic tiles for 3D architecture', image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Kids Top Pick', badgeBg: 'bg-purple-600' },
  { id: 'kid-3', app: 'MART', category: 'Fashion', name: 'Comfort Street Sneakers', price: 2499, emoji: '👟', rating: 4.7, desc: 'Flyknit mesh with dynamic cushioning', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Trending', badgeBg: 'bg-blue-500' },
  { id: 'kid-4', app: 'MART', category: 'Books & Stationery', name: 'Scientific Graphic Calculator v4', price: 3499, emoji: '🧮', rating: 4.8, desc: '400+ functions, high-res LCD', image: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Student Choice', badgeBg: 'bg-blue-600' },
  { id: 'kid-5', app: 'MART', category: 'Books & Stationery', name: 'Executive Hardcover Journal & Pen Set', price: 899, emoji: '📓', rating: 4.9, desc: '120gsm bleed-proof paper, brass rollerball', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Best Seller', badgeBg: 'bg-amber-600' },
];

// Hair & Skin Care — merged Mart Beauty catalog + Pharma OTC/wellness products.
export const hairSkinPicks: Product[] = [
  { id: 'hs-1', app: 'MART', category: 'Beauty', name: 'Organic Hydrating Serum', price: 799, emoji: '🧴', rating: 4.8, desc: 'Multi-layer hyaluronic acid, glass skin glow', image: 'https://images.unsplash.com/photo-1608248597481-496100c80836?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Eco-Choice', badgeBg: 'bg-emerald-500' },
  { id: 'hs-2', app: 'PHARMA', category: 'vitamin', name: 'Collagen Complex Gummies', price: 810, emoji: '💊', rating: 4.8, desc: 'Hydrolyzed collagen peptides, biotin, Vitamin E', image: 'https://images.unsplash.com/photo-1607619056574-7b8d304f2c38?auto=format&fit=crop&q=80&w=400&h=400', badge: '15% OFF', badgeBg: 'bg-rose-500' },
  { id: 'hs-3', app: 'PHARMA', category: 'vitamin', name: 'Vitamin D3 2000 IU (60 Caps)', price: 450, emoji: '☀️', rating: 4.7, desc: 'Bone, immunity & calcium absorption support', image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400', badge: '30% OFF', badgeBg: 'bg-amber-500' },
  { id: 'hs-4', app: 'MART', category: 'Beauty', name: 'Matte Lip Cream Duo', price: 649, emoji: '💄', rating: 4.5, desc: '12-hour matte with jojoba extract', image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=400&h=400', badge: 'Duo Deal', badgeBg: 'bg-rose-500' },
  { id: 'hs-5', app: 'PHARMA', category: 'vitamin', name: 'Turmeric & Ginger Gummies', price: 810, emoji: '🍊', rating: 5, desc: '270mg curcumin anti-oxidant treat', image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=400&h=400', badge: '14% OFF', badgeBg: 'bg-teal-500' },
  { id: 'hs-6', app: 'PHARMA', category: 'supplements', name: 'Whey Protein Isolate 500g', price: 1299, emoji: '💪', rating: 4.9, desc: '27g protein, zero sugar, fast absorb', image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2c1cf?auto=format&fit=crop&q=80&w=400&h=400', badge: '23% OFF', badgeBg: 'bg-indigo-500' },
];
