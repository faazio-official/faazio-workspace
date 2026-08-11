/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { FoodProduct, TopOfWeekDish } from '../types';

export const foodProducts: FoodProduct[] = [
  { id: 'm-squid-sweet', app: 'FOOD', category: 'Seafood', name: 'Squid Sweet & Sour', price: 399, emoji: '🦑', image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?fm=jpg&fit=crop&q=80&w=400&h=400', categories: ['All', 'Top of Week', 'Seafood'], desc: 'Zesty wok-tossed premium squid, caramelized pineapples, and a rich sweet & sour glaze.', rating: 4.9 },
  { id: 'm-pepper-beef', app: 'FOOD', category: 'Featured', name: 'Black Pepper Beef', price: 549, emoji: '🥩', image: 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?fm=jpg&fit=crop&q=80&w=400&h=400', categories: ['All', 'Top of Week', 'Featured'], desc: 'Tender grain-fed beef slices sautéed with crushed tellicherry black pepper and spring onion.', rating: 4.8 },
  { id: 'm-mushroom-soup', app: 'FOOD', category: 'Soup', name: 'Creamy Mushroom Soup', price: 220, emoji: '🥣', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?fm=jpg&fit=crop&q=80&w=400&h=400', categories: ['All', 'Soup'], desc: 'Velvety puréed forest mushrooms, simmered light cream, and wild truffle oil drizzle.', rating: 4.7 },
  { id: 'm-seafood-ramen', app: 'FOOD', category: 'Seafood', name: 'Spicy Seafood Ramen', price: 450, emoji: '🍜', image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?fm=jpg&fit=crop&q=80&w=400&h=400', categories: ['All', 'Seafood', 'Top of Week'], desc: 'House-made wheat noodles in spicy slow-simmered seafood broth, topped with Tiger prawns.', rating: 4.9 },
  { id: 'm-chicken-rice', app: 'FOOD', category: 'Featured', name: 'Hainanese Chicken Rice', price: 349, emoji: '🍛', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?fm=jpg&fit=crop&q=80&w=400&h=400', categories: ['All', 'Featured'], desc: 'Tender poached farm chicken served over fragrant ginger rice with chili soy sauce.', rating: 4.8 },
  { id: 'm-crispy-dumplings', app: 'FOOD', category: 'Featured', name: 'Golden Crispy Dumplings', price: 280, emoji: '🥟', image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?fm=jpg&fit=crop&q=80&w=400&h=400', categories: ['All', 'Featured'], desc: 'Pan-seared handmade wrappers filled with fresh seasoned chicken & Chinese chives.', rating: 4.6 },
];

export const topOfWeekDishes: TopOfWeekDish[] = [
  { id: 'tow-1', name: 'Hongkong Hainanese Chicken Rice', price: 349, emoji: '🍛', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?fm=jpg&fit=crop&q=80&w=400&h=400', desc: 'Slow poached organic chicken, fragrant jasmine rice with cool cucumber.', rating: '4.8', reviewsCount: 320, time: '30 mins' },
  { id: 'tow-2', name: 'Hot & Sour Corn Soup', price: 249, emoji: '🍜', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?fm=jpg&fit=crop&q=80&w=400&h=400', desc: 'Authentic Sichuan spices, sweet golden corn, and organic field greens.', rating: '4.7', reviewsCount: 156, time: '20 mins' },
  { id: 'tow-3', name: 'Singapura Hainan Curry', price: 499, emoji: '🍛', image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?fm=jpg&fit=crop&q=80&w=400&h=400', desc: 'Rich coconut curry leaf broth, fresh wild prawns & golden tofu puffs.', rating: '4.9', reviewsCount: 520, time: '40 mins' },
];
