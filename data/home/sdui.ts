/**
 * @aspirational Simulates a Python + MongoDB SDUI microservice. A document tree
 * that describes the Home feed by *ID only* — every leaf references a row in the
 * catalog / directory / inventory tables rather than embedding product data.
 * Consolidates the structure of home/sections, home/rails, home/filterFeed.
 * The app still renders the legacy fixtures until the Gateway surface is wired.
 * See data/DATA_CONTROL.md.
 */
import type { AppBrand } from '../types';
import { homeSections, type HomeSectionKind } from './sections';
import { catalogIndex } from '../catalog/products';
import { storeDirectory } from '../directory/stores';
import { filterChips } from './filterFeed';

/** One editorial hero banner (image + copy) carried by a section. Never money — prices are joined. */
export interface SduiBanner {
  id: string;
  title: string;
  subtitle?: string;
  /** Background hex for the banner card (mirrors `bgHex`). */
  accent?: string;
  imageUrl?: string;
}

/** A Home feed section, resolved by ID only. */
export interface SduiSection {
  id: HomeSectionKind;
  title: string;
  subtitle?: string;
  accent: string;
  /** Catalog product ids shown in this section's rail. */
  productIds: string[];
  /** Store ids shown in this section. */
  storeIds?: string[];
  /** Optional per-chip product ids (filter feed). */
  chips?: { id: string; label: string; accent: string; productIds: string[] }[];
  /** Optional editorial hero banners (Mart hero rail). */
  banners?: SduiBanner[];
}

/** Resolve catalog ids for a set of product ids that exist in the index. */
function resolveProductIds(ids: string[]): string[] {
  const index = new Set(catalogIndex.map((e) => e.id));
  return ids.filter((id) => index.has(id));
}

/** Store ids for a given app that exist in the directory. */
function resolveStoreIds(app: AppBrand): string[] {
  const storeApps: Record<string, 'MART' | 'FOOD'> = { FOOD: 'FOOD', MART: 'MART' };
  return storeDirectory.filter((s) => s.app === (storeApps[app] ?? 'MART')).map((s) => s.id);
}

const FILTER_FEED: SduiSection['chips'] = filterChips.map((chip) => ({
  id: chip.id,
  label: chip.label,
  accent: chip.accent,
  productIds: resolveProductIds(chipProductIds(chip.id)),
}));

function chipProductIds(chipId: string): string[] {
  switch (chipId) {
    case 'trendy': return ['men-1', 'hbd-1', 'rvm-2'];
    case 'fashion': return ['men-1', 'men-3', 'wom-2', 'kid-3'];
    case 'homeAppliances': return ['hbd-2', 'rvm-4'];
    case 'fastFood': return ['lm-1', 'bf-1', 'bf-2'];
    case 'snacks': return ['rvg-4'];
    case 'hotMeals': return ['m-seafood-ramen', 'm-chicken-rice', 'm-mushroom-soup', 'm-crispy-dumplings'];
    case 'skincare': return ['hs-1', 'hs-4'];
    case 'freshVeggies': return ['nb-3', 'rvg-1'];
    case 'coughSyrup': return ['ph-c1', 'ph-c2', 'ph-c3'];
    default: return [];
  }
}

export const homeSdui: SduiSection[] = [
  // Mart-only sections live in the same Home doc so the Mart feed has one merchandising owner
  // (super-admin SDUI editor) and the mock/remote shapes match exactly. `HomeView` skips unknown
  // ids (`default → null`); `martService.fetchMartFeed` is the only reader. The `md-*`/`gr-*` ids
  // are raw here (not `resolveProductIds`) so the seed generator can fail loudly on a typo.
  {
    id: 'martHero',
    title: 'Mart Highlights',
    accent: '#F25C3D',
    productIds: [],
    banners: [
      { id: 'hb-1', title: 'Big Savings Everyday', subtitle: 'UP TO 50% OFF', accent: '#FFF8D6', imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&fit=crop&q=80&w=400&h=400' },
      { id: 'hb-2', title: 'Fresh Groceries Doorstep', subtitle: 'FREE DELIVERY', accent: '#E8F5E9', imageUrl: 'https://images.unsplash.com/photo-1579113800032-c38bd1625818?fm=jpg&fit=crop&q=80&w=400&h=400' },
      { id: 'hb-3', title: 'Electronics Mega Sale', subtitle: 'FLAT 40% OFF', accent: '#FFF3E0', imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?fm=jpg&fit=crop&q=80&w=400&h=400' },
    ],
  },
  { id: 'adBanner', title: 'Offers', accent: '#111827', productIds: [] },
  { id: 'diningSpecials', title: "Today's Special", accent: '#1E5D44', productIds: [], storeIds: resolveStoreIds('FOOD') },
  { id: 'hotBrandDeals', title: 'Deals of the day', accent: '#1162D3', productIds: resolveProductIds(['hbd-1', 'hbd-2', 'hbd-3', 'hbd-4', 'hbd-5']) },
  { id: 'dealsOfDay', title: 'Daily Essentials', accent: '#F25C3D', productIds: resolveProductIds(['md-1', 'md-2', 'md-3', 'md-4', 'md-5', 'md-6']) },
  // Mart "Deals of the Day" and "Daily Essentials" rails — portal-editable id lists (were split:
  // Deals lived in code, Essentials in SDUI). Money is joined at compile time by the gateway.
  { id: 'martDeals', title: 'Deals of the Day', accent: '#F25C3D', productIds: ['md-1', 'md-2', 'md-3', 'md-4', 'md-5', 'md-6'] },
  { id: 'martEssentials', title: 'Daily Essentials', accent: '#0F766E', productIds: ['gr-p3', 'gr-p4', 'gr-p5', 'gr-p6', 'gr-p7'] },
  // Food-only section, same pattern as the Mart rails: lives in the Home doc so Food has one
  // merchandising owner (super-admin SDUI editor) and the mock/remote shapes match. Only
  // `diningService.fetchDiningFeed` reads it (via `GET /sdui/food`); `HomeView` skips the
  // unknown id. Banners are editorial (never money) and render as the organic fallback when the
  // paid `FOOD_HERO` placement has no LIVE fill. Raw ids so the seed generator can fail loudly.
  {
    id: 'foodHero',
    title: 'Food Highlights',
    accent: '#1E5D44',
    productIds: [],
    banners: [
      { id: 'fb-1', title: 'Dining Deals Near You', subtitle: 'UP TO 40% OFF', accent: '#E8F5E9', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?fm=jpg&fit=crop&q=80&w=800&h=450' },
      { id: 'fb-2', title: 'Biryani Festival', subtitle: 'FLAT ₹150 OFF', accent: '#FFF3E0', imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?fm=jpg&fit=crop&q=80&w=800&h=450' },
      { id: 'fb-3', title: 'Late Night Cravings', subtitle: 'FREE DELIVERY', accent: '#EDE9FE', imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?fm=jpg&fit=crop&q=80&w=800&h=450' },
    ],
  },
  // Paid placement: the doc owns the slot order, the ad-server (`GET /ads/live`) owns the fill.
  // No productIds are baked in — the app resolves LIVE ads at render time (they expire).
  { id: 'sponsoredRail', title: 'Sponsored picks', accent: '#B45309', productIds: [] },
  { id: 'mostRatedDining', title: 'Most Rated Dining', accent: '#1E5D44', productIds: [], storeIds: resolveStoreIds('FOOD') },
  { id: 'recentlyViewedMart', title: 'Recently Viewed — Mart', accent: '#1162D3', productIds: resolveProductIds(['rvm-1', 'rvm-2', 'rvm-3', 'rvm-4']) },
  { id: 'recentlyViewedFood', title: 'Recently Viewed — Food', accent: '#1E5D44', productIds: resolveProductIds(['rvf-1', 'rvf-2', 'rvf-3']) },
  { id: 'recentlyViewedPharma', title: 'Recently Viewed — Pharma', accent: '#065F46', productIds: resolveProductIds(['rvp-1', 'rvp-2', 'rvp-3']) },
  { id: 'nearbyOffers', title: 'Nearby Offers', accent: '#111827', productIds: resolveProductIds(['nb-1', 'nb-2', 'nb-3', 'nb-4', 'nb-5', 'nb-6']) },
  { id: 'mens', title: 'Men', accent: '#1162D3', productIds: resolveProductIds(['men-1', 'men-2', 'men-3', 'men-4', 'men-5', 'men-6']) },
  { id: 'womens', title: 'Women', accent: '#1162D3', productIds: resolveProductIds(['wom-1', 'wom-2', 'wom-3', 'wom-4', 'wom-5', 'wom-6']) },
  { id: 'childrens', title: 'Kids', accent: '#1162D3', productIds: resolveProductIds(['kid-1', 'kid-2', 'kid-3', 'kid-4', 'kid-5']) },
  { id: 'hairSkinCare', title: 'Hair & Skin Care', accent: '#0F766E', productIds: resolveProductIds(['hs-1', 'hs-2', 'hs-3', 'hs-4', 'hs-5']) },
  { id: 'filterFeed', title: 'Filter Feed', accent: '#8B5CF6', productIds: [], chips: FILTER_FEED },
];

/** The canonical ordered section registry mirrors the legacy `homeSections`. */
export const sduiSectionOrder: HomeSectionKind[] = homeSections.map((s) => s.id);

export function getSduiSection(id: HomeSectionKind): SduiSection | undefined {
  return homeSdui.find((s) => s.id === id);
}
