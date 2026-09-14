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
  { id: 'adBanner', title: 'Offers', accent: '#111827', productIds: [] },
  { id: 'diningSpecials', title: 'Dining Specials', accent: '#1E5D44', productIds: [], storeIds: resolveStoreIds('FOOD') },
  { id: 'hotBrandDeals', title: 'Deals of the day', accent: '#1162D3', productIds: resolveProductIds(['hbd-1', 'hbd-2', 'hbd-3', 'hbd-4', 'hbd-5']) },
  { id: 'dealsOfDay', title: 'Daily Essentials', accent: '#F25C3D', productIds: resolveProductIds(['md-1', 'md-2', 'md-3', 'md-4', 'md-5', 'md-6']) },
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
