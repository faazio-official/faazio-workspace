/**
 * @mock Simulates a Go + DynamoDB key-value stock microservice. One row per
 * catalog product id. Availability/pricing is derived deterministically from the
 * product id so lookups are stable across reloads. See data/DATA_CONTROL.md.
 */
import { catalogIndex } from '../catalog/products';

export interface StockRow {
  productId: string;
  available: boolean;
  inStockQty: number;
  price: number;
  mrp?: number;
  eta: string;
  isPrescription?: boolean;
}

/** Deterministic pseudo-random from a string seed (stable across reloads). */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export const stockTable: StockRow[] = catalogIndex.map((entry) => {
  const seed = hashSeed(entry.id);
  const inStockQty = (seed % 40) + 1;
  const available = seed % 7 !== 0; // ~85% in stock
  const discount = seed % 30; // 0-29% off
  const price = Math.round(entry.price * (1 - discount / 100));
  const isPrescription =
    entry.app === 'PHARMA' &&
    ['hypertension', 'asthma', 'fever'].includes(entry.category);
  const eta = entry.app === 'FOOD' ? '25-30 min' : entry.app === 'PHARMA' ? '45 min' : '1-2 days';
  return {
    productId: entry.id,
    available,
    inStockQty,
    price,
    mrp: discount > 0 ? entry.price : undefined,
    eta,
    isPrescription: isPrescription || undefined,
  };
});

export function getStockByProductId(productId: string): StockRow | undefined {
  return stockTable.find((s) => s.productId === productId);
}

export function getStockByProductIds(ids: string[]): StockRow[] {
  return ids.map(getStockByProductId).filter((s): s is StockRow => !!s);
}
