/**
 * @mock Static fixture — seeded sample data for local development until the Go Chi
 * backend (server/) is wired. See data/DATA_CONTROL.md.
 */
import type { MartDeal, Product } from '../types';

const squareImg = (id: string, w = 560) =>
  `https://images.unsplash.com/${id}?fm=jpg&fit=crop&q=80&w=${w}&h=${w}`;

export const MART_DEALS: MartDeal[] = [
  { id: 'md-1', brand: 'Fresh Farm', name: 'Organic Whole Milk', size: '1L', price: 128, originalPrice: 198, discountTag: '35% OFF', rating: 4.5, priceNote: 'Lowest price in 30 days', imageUrl: squareImg('photo-1550583724-b2692b85b150', 300), emoji: '🥛' },
  { id: 'md-2', brand: 'Golden Grain', name: 'Basmati Rice Premium', size: '5kg', price: 449, originalPrice: 599, discountTag: '25% OFF', rating: 4.6, priceNote: 'Lowest price in 30 days', imageUrl: squareImg('photo-1586201375761-83865001e31c', 300), emoji: '🍚' },
  { id: 'md-3', brand: 'Pure Harvest', name: 'Cold Pressed Coconut Oil', size: '1L', price: 299, originalPrice: 499, discountTag: '40% OFF', rating: 4.3, imageUrl: squareImg('photo-1474979266404-7eaacbcd87c5', 300), emoji: '🥥' },
  { id: 'md-4', brand: 'Nature\'s Basket', name: 'Mixed Nuts Combo', size: '500g', price: 349, originalPrice: 549, discountTag: '36% OFF', rating: 4.4, imageUrl: squareImg('photo-1604068549290-dea0e4a305ca', 300), emoji: '🥜' },
  { id: 'md-5', brand: 'Daily Fresh', name: 'Free Range Eggs', size: '12 pcs', price: 89, originalPrice: 129, discountTag: '31% OFF', rating: 4.2, priceNote: 'Lowest price in 30 days', imageUrl: squareImg('photo-1582722872445-44dc5f7e3c8f', 300), emoji: '🥚' },
  { id: 'md-6', brand: 'Baker\'s Joy', name: 'Whole Wheat Bread', size: '400g', price: 35, originalPrice: 55, discountTag: '36% OFF', rating: 3.8, imageUrl: squareImg('photo-1509440159596-0249088772ff', 300), emoji: '🍞' },
];

export const dealToProduct = (deal: MartDeal): Product => ({
  id: deal.id,
  app: 'MART',
  category: 'Groceries',
  name: deal.name,
  price: deal.price,
  emoji: deal.emoji,
  rating: deal.rating ?? 4.5,
  desc: `${deal.brand} · ${deal.size}`,
  badge: deal.discountTag,
  badgeBg: '#F25C3D',
  image: deal.imageUrl,
  originalPrice: deal.originalPrice,
  unit: deal.size,
  shop: deal.brand,
  attributes: { brand: deal.brand, packSize: deal.size },
});
