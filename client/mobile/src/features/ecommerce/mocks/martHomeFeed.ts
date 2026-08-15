const img = (id: string, w = 900, h = 620) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${h}`;

const squareImg = (id: string, w = 560) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

import type { Product } from '@data/types';

export interface MartHeroBanner {
  id: string;
  title: string;
  subtitle: string;
  bgHex: string;
  imageUrl: string;
}

export interface MartDeal {
  id: string;
  brand: string;
  name: string;
  size: string;
  price: number;
  originalPrice: number;
  discountTag: string;
  imageUrl: string;
  emoji: string;
}

export interface MartFlashSale {
  id: string;
  brand: string;
  name: string;
  size: string;
  price: number;
  originalPrice: number;
  discountTag: string;
  remainingTimeSec: number;
  imageUrl: string;
  emoji: string;
}

export interface MartTopBrand {
  id: string;
  name: string;
  logoUrl: string;
}

export interface MartLocalVendor {
  id: string;
  name: string;
  distance: string;
  rating: number;
  deliveryTime: string;
  imageUrl: string;
}

export const MART_HERO_BANNERS: MartHeroBanner[] = [
  {
    id: 'hb-1',
    title: 'Big Savings Everyday',
    subtitle: 'UP TO 50% OFF',
    bgHex: '#FFF8D6',
    imageUrl: squareImg('photo-1542838132-92c53300491e', 400),
  },
  {
    id: 'hb-2',
    title: 'Fresh Groceries Doorstep',
    subtitle: 'FREE DELIVERY',
    bgHex: '#E8F5E9',
    imageUrl: squareImg('photo-1579113800032-c38bd1625818', 400),
  },
  {
    id: 'hb-3',
    title: 'Electronics Mega Sale',
    subtitle: 'FLAT 40% OFF',
    bgHex: '#FFF3E0',
    imageUrl: squareImg('photo-1498050108023-c5249f4df085', 400),
  },
];

export const MART_DEALS: MartDeal[] = [
  { id: 'md-1', brand: 'Fresh Farm', name: 'Organic Whole Milk', size: '1L', price: 128, originalPrice: 198, discountTag: '35% OFF', imageUrl: squareImg('photo-1550583724-b2692b85b150', 300), emoji: '🥛' },
  { id: 'md-2', brand: 'Golden Grain', name: 'Basmati Rice Premium', size: '5kg', price: 449, originalPrice: 599, discountTag: '25% OFF', imageUrl: squareImg('photo-1586201375761-83865001e31c', 300), emoji: '🍚' },
  { id: 'md-3', brand: 'Pure Harvest', name: 'Cold Pressed Coconut Oil', size: '1L', price: 299, originalPrice: 499, discountTag: '40% OFF', imageUrl: squareImg('photo-1474979266404-7eaacbcd87c5', 300), emoji: '🥥' },
  { id: 'md-4', brand: 'Nature\'s Basket', name: 'Mixed Nuts Combo', size: '500g', price: 349, originalPrice: 549, discountTag: '36% OFF', imageUrl: squareImg('photo-1604068549290-dea0e4a305ca', 300), emoji: '🥜' },
  { id: 'md-5', brand: 'Daily Fresh', name: 'Free Range Eggs', size: '12 pcs', price: 89, originalPrice: 129, discountTag: '31% OFF', imageUrl: squareImg('photo-1582722872445-44dc5f7e3c8f', 300), emoji: '🥚' },
  { id: 'md-6', brand: 'Baker\'s Joy', name: 'Whole Wheat Bread', size: '400g', price: 35, originalPrice: 55, discountTag: '36% OFF', imageUrl: squareImg('photo-1509440159596-0249088772ff', 300), emoji: '🍞' },
];

export const MART_FLASH_SALES: MartFlashSale[] = [
  { id: 'mf-1', brand: 'Cool Drinks', name: 'Sparkling Soda Pack', size: '750ml × 4', price: 99, originalPrice: 199, discountTag: '50% OFF', remainingTimeSec: 3540, imageUrl: squareImg('photo-1527661591475-527312dd65f5', 300), emoji: '🥤' },
  { id: 'mf-2', brand: 'Crispy Co.', name: 'Potato Chips Variety', size: '200g × 3', price: 149, originalPrice: 299, discountTag: '50% OFF', remainingTimeSec: 5400, imageUrl: squareImg('photo-1566478989037-eec170784d71', 300), emoji: '🍟' },
  { id: 'mf-3', brand: 'Clean & Fresh', name: 'Hand Wash 3-Pack', size: '250ml each', price: 199, originalPrice: 399, discountTag: '50% OFF', remainingTimeSec: 7200, imageUrl: squareImg('photo-1585386959984-c4e2e9f0dfc0', 300), emoji: '🧴' },
  { id: 'mf-4', brand: 'Pure Petals', name: 'Rose Petal Soap Trio', size: '75g × 3', price: 129, originalPrice: 249, discountTag: '48% OFF', remainingTimeSec: 1800, imageUrl: squareImg('photo-1600857544200-b2f666a9f5ab', 300), emoji: '🧼' },
  { id: 'mf-5', brand: 'HomeFresh', name: 'Almond Milk', size: '1L', price: 79, originalPrice: 159, discountTag: '50% OFF', remainingTimeSec: 9000, imageUrl: squareImg('photo-1563636619-e9143da7973b', 300), emoji: '🥛' },
];

export const MART_TOP_BRANDS: MartTopBrand[] = [
  { id: 'tb-1', name: 'Tata', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Tata_logo.svg/120px-Tata_logo.svg.png' },
  { id: 'tb-2', name: 'Amul', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Amul_logo.svg/120px-Amul_logo.svg.png' },
  { id: 'tb-3', name: 'Nestlé', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Nestl%C3%A9_logo.svg/120px-Nestl%C3%A9_logo.svg.png' },
  { id: 'tb-4', name: 'P&G', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/P%26G_logo.svg/120px-P%26G_logo.svg.png' },
  { id: 'tb-5', name: 'Britannia', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Britannia_Logo.svg/120px-Britannia_Logo.svg.png' },
  { id: 'tb-6', name: 'HUL', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Hindustan_Unilever_Logo.svg/120px-Hindustan_Unilever_Logo.svg.png' },
];

export const MART_LOCAL_VENDORS: MartLocalVendor[] = [
  { id: 'lv-1', name: 'Fresh Mart Express', distance: '0.8 km', rating: 4.8, deliveryTime: '25 min', imageUrl: img('photo-1578916171728-46686eacb58a', 400, 300) },
  { id: 'lv-2', name: 'Green Grocers', distance: '1.2 km', rating: 4.6, deliveryTime: '30 min', imageUrl: img('photo-1488459716781-31db52582fe9', 400, 300) },
  { id: 'lv-3', name: 'Daily Needs Store', distance: '0.5 km', rating: 4.9, deliveryTime: '15 min', imageUrl: img('photo-1441986300917-64674bd600d8', 400, 300) },
  { id: 'lv-4', name: 'Organic Bazaar', distance: '1.5 km', rating: 4.7, deliveryTime: '35 min', imageUrl: img('photo-1488459716781-31db52582fe9', 400, 300) },
  { id: 'lv-5', name: 'Metro Supermarket', distance: '2.0 km', rating: 4.5, deliveryTime: '40 min', imageUrl: img('photo-1578916171728-46686eacb58a', 400, 300) },
  { id: 'lv-6', name: 'Corner Grocery', distance: '0.3 km', rating: 4.8, deliveryTime: '10 min', imageUrl: img('photo-1441986300917-64674bd600d8', 400, 300) },
];

const MART_DEAL_RATING = 4.5;

export const dealToProduct = (deal: MartDeal): Product => ({
  id: deal.id,
  app: 'MART',
  category: 'Groceries',
  name: deal.name,
  price: deal.price,
  emoji: deal.emoji,
  rating: MART_DEAL_RATING,
  desc: `${deal.brand} · ${deal.size}`,
  badge: deal.discountTag,
  badgeBg: '#F25C3D',
  image: deal.imageUrl,
});

export const flashSaleToProduct = (sale: MartFlashSale): Product => ({
  id: sale.id,
  app: 'MART',
  category: 'Groceries',
  name: sale.name,
  price: sale.price,
  emoji: sale.emoji,
  rating: MART_DEAL_RATING,
  desc: `${sale.brand} · ${sale.size}`,
  badge: sale.discountTag,
  badgeBg: '#F25C3D',
  image: sale.imageUrl,
});
