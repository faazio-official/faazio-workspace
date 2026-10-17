/**
 * @fallback Feature-local Mart home rail content. The daily-essentials cards are **server-controlled**
 * through the Mongo SDUI home doc (`martEssentials.productIds`) and read by `martService.fetchMartFeed`
 * via `GET /sdui/home`; this fixture is the offline first-paint fallback only (see
 * data/DATA_CONTROL.md, docs/architecture/data-layer-sdui.md). `MART_DEALS` / `dealToProduct` are
 * re-exported from `@data/mart/deals`; the `md-*` deals are seeded catalog rows resolved through the
 * server (`getProductsByIds`), again falling back here offline. The Mart hero is a paid placement
 * (`MART_HERO`); its house fallback comes from the remote SDUI `martHero.banners` (rendered only when
 * there is no LIVE fill). Offline → no hero, no local hero fixture.
 */
const squareImg = (id: string, w = 560) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

import type { Product } from '@data/types';

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

export const MART_DAILY_ESSENTIALS: MartEssential[] = [
  { id: 'gr-p3', brand: 'Faazio Fresh', name: 'Fresh Farm Whole Milk', size: '1 L', price: 75, originalPrice: 95, discountTag: '21% OFF', rating: 4.9, imageUrl: squareImg('photo-1550583724-b2692b85b150', 300), emoji: '🥛' },
  { id: 'gr-p4', brand: 'Faazio Fresh', name: 'Artisan Sourdough Loaf', size: '450g', price: 150, originalPrice: 190, discountTag: '21% OFF', rating: 4.8, imageUrl: squareImg('photo-1509440159596-0249088772ff', 300), emoji: '🍞' },
  { id: 'gr-p5', brand: 'Faazio Fresh', name: 'Almond Milk Unsweetened', size: '1 L', price: 190, originalPrice: 250, discountTag: '24% OFF', rating: 4.7, imageUrl: squareImg('photo-1553456558-aff63285bdd1', 300), emoji: '🥛' },
  { id: 'gr-p6', brand: 'Faazio Fresh', name: 'Sea Salt Multigrain Crisps', size: '150g', price: 95, originalPrice: 130, discountTag: '27% OFF', rating: 4.6, imageUrl: squareImg('photo-1599490659213-e2b9527bb087', 300), emoji: '🍿' },
  { id: 'gr-p7', brand: 'Faazio Fresh', name: 'Arabica Coffee Beans Medium', size: '250g', price: 450, originalPrice: 580, discountTag: '22% OFF', rating: 4.9, imageUrl: squareImg('photo-1514432324607-a09d9b4aefdd', 300), emoji: '☕' },
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
