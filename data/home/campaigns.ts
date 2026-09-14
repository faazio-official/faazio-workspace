/**
 * @mock Static fixture — ad campaigns backing the Home "Deals of the day" section.
 * Each campaign promotes a **real Mart vendor** (resolved by `storeId` against the
 * store directory) and references catalog products **by id only** (SDUI rule),
 * resolved via `getProductById`. No product/store rows are duplicated — the card
 * and the Deals landing page look the store up at render time. See DATA_CONTROL.md.
 */
import type { AdCampaign, Product } from '../types';
import { getProductById } from '../catalog/products';
import { getStoreById } from '../directory/stores';

/**
 * Vendor campaigns shown in the two stacked auto-playing carousels of the Home
 * "Deals of the day" section. Product ids are verified against the catalog index
 * at authoring time and all reference `martProducts` rows whose `storeId` matches
 * the campaign's vendor, so `getCampaignProducts` resolves them against the store's
 * real inventory.
 */
export const adCampaigns: AdCampaign[] = [
  // ---- Carousel 1 (top) — mobiles & smart-home vendors ----
  {
    id: 'camp-darling-mobiles',
    storeId: 'store-m1',
    productIds: ['fm-m1', 'fm-m2'],
    carousel: 1,
  },
  {
    id: 'camp-smarthome',
    storeId: 'store-m7',
    productIds: ['fm-ha1', 'fm-ha3', 'fm-ha2'],
    carousel: 1,
  },
  // ---- Carousel 2 (bottom) — electronics & sports vendors ----
  {
    id: 'camp-volt-electronics',
    storeId: 'store-m12',
    productIds: ['fm-e4', 'fm-e5', 'fm-e6'],
    carousel: 2,
  },
  {
    id: 'camp-peak-sports',
    storeId: 'store-m11',
    productIds: ['fm-s2', 'fm-s3', 'fm-s4'],
    carousel: 2,
  },
  // ---- Carousel 1 (top) — fashion & lifestyle vendors ----
  {
    id: 'camp-thread-labs',
    storeId: 'store-m3',
    productIds: ['fm-f1', 'fm-f2', 'fm-f3'],
    carousel: 1,
  },
  {
    id: 'camp-vibe-apparel',
    storeId: 'store-m4',
    productIds: ['fm-v1', 'fm-v2', 'fm-v4'],
    carousel: 1,
  },
  // ---- Carousel 2 (bottom) — books & furniture ----
  {
    id: 'camp-scholars-bookland',
    storeId: 'store-m6',
    productIds: ['fm-bk1', 'fm-bk2', 'fm-bk3'],
    carousel: 2,
  },
  {
    id: 'camp-wood-steel',
    storeId: 'store-m8',
    productIds: ['fm-fur1', 'fm-fur3', 'fm-fur4'],
    carousel: 2,
  },
];

/**
 * Resolve a campaign's catalog products by id, keeping only rows that belong to the
 * campaign's vendor (the `storeId` match guards against stale/mis-linked ids).
 */
export function getCampaignProducts(campaign: AdCampaign): Product[] {
  return campaign.productIds
    .map((id) => getProductById(id))
    .filter((p): p is Product => !!p && p.storeId === campaign.storeId);
}

/** The store (`StoreRecord`) backing a campaign — used for the card title + discount label. */
export function getCampaignStore(campaign: AdCampaign) {
  return getStoreById(campaign.storeId);
}

/** The campaigns rendered in the first (top) stacked carousel. */
export const carouselOneCampaigns: AdCampaign[] = adCampaigns.filter((c) => c.carousel === 1);
/** The campaigns rendered in the second (bottom) stacked carousel. */
export const carouselTwoCampaigns: AdCampaign[] = adCampaigns.filter((c) => c.carousel === 2);
