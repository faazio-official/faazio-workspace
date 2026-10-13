// Provenance: inventory.stock (product_id, quantity, low_stock_threshold, eta_minutes)
// Quantities derived from a deterministic hash seed (no drift between reloads).
import type { StockRecord } from "@/data/types";
import { PRODUCTS } from "@/data/catalog/products";
import { seededInt } from "@/lib/seed";

export const STOCK: StockRecord[] = PRODUCTS.map((p) => ({
  productId: p.productId,
  quantity: seededInt(`stock:${p.productId}`, 0, 180),
  lowStockThreshold: 12,
  etaMinutes: 20 + seededInt(`eta:${p.productId}`, 0, 40),
  updatedAt: "2026-09-11T18:00:00.000Z",
}));
