/**
 * @static-editorial Feature-local Mart home rail content with no backing table — hero
 * banners and the `mf-*` daily-essentials cards. Presentation-owned; the correct long-term
 * home is the SDUI layout doc, not a per-table migration (see data/DATA_CONTROL.md,
 * docs/architecture/data-layer-sdui.md). `MART_DEALS` / `dealToProduct` are re-exported from
 * `@data/mart/deals`; the `md-*` deals are seeded catalog rows and are resolved through the
 * server (`martService.fetchMartFeed` → `getProductsByIds`), this fixture being the offline
 * first-paint fallback.
 */
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

export interface MartEssential {
  id: string;
  brand: string;
  name: string;
  size: string;
  price: number;
  originalPrice: number;
  discountTag: string;
  rating?: number;
  priceNote?: string;
  imageUrl: string;
  emoji: string;
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

export const MART_DAILY_ESSENTIALS: MartEssential[] = [
  { id: 'mf-1', brand: 'Cool Drinks', name: 'Sparkling Soda Pack', size: '750ml × 4', price: 99, originalPrice: 199, discountTag: '50% OFF', rating: 4.3, priceNote: 'Lowest price in 30 days', imageUrl: squareImg('photo-1527661591475-527312dd65f5', 300), emoji: '🥤' },
  { id: 'mf-2', brand: 'Crispy Co.', name: 'Potato Chips Variety', size: '200g × 3', price: 149, originalPrice: 299, discountTag: '50% OFF', rating: 4.1, priceNote: 'Lowest price in 30 days', imageUrl: squareImg('photo-1566478989037-eec170784d71', 300), emoji: '🍟' },
  { id: 'mf-3', brand: 'Clean & Fresh', name: 'Hand Wash 3-Pack', size: '250ml each', price: 199, originalPrice: 399, discountTag: '50% OFF', rating: 4.4, imageUrl: squareImg('photo-1585386959984-c4e2e9f0dfc0', 300), emoji: '🧴' },
  { id: 'mf-4', brand: 'Pure Petals', name: 'Rose Petal Soap Trio', size: '75g × 3', price: 129, originalPrice: 249, discountTag: '48% OFF', rating: 3.9, imageUrl: squareImg('photo-1600857544200-b2f666a9f5ab', 300), emoji: '🧼' },
  { id: 'mf-5', brand: 'HomeFresh', name: 'Almond Milk', size: '1L', price: 79, originalPrice: 159, discountTag: '50% OFF', rating: 4.5, priceNote: 'Lowest price in 30 days', imageUrl: squareImg('photo-1563636619-e9143da7973b', 300), emoji: '🥛' },
];

export const essentialToProduct = (item: MartEssential): Product => ({
  id: item.id,
  app: 'MART',
  category: 'Groceries',
  name: item.name,
  price: item.price,
  emoji: item.emoji,
  rating: item.rating ?? 4.5,
  desc: `${item.brand} · ${item.size}`,
  badge: item.discountTag,
  badgeBg: '#F25C3D',
  image: item.imageUrl,
});

export type { MartDeal } from '@data/types';
export { MART_DEALS, dealToProduct } from '@data/mart/deals';
