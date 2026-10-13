// Provenance: analytics.seller_metrics / state_metrics / product_metrics (daily aggregates)
// Generated deterministically from a hash seed — no literal series stored.
import type { DailyPoint } from "@/data/types";
import { seededFloat, seededInt } from "@/lib/seed";

const ANCHOR_DATE = "2026-09-12T00:00:00.000Z";

export function dailySeries(key: string, days: number, baseGmvPaisa: number): DailyPoint[] {
  const anchor = new Date(ANCHOR_DATE).getTime();
  const points: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(anchor - i * 86400000);
    const iso = date.toISOString().slice(0, 10);
    const wave = 1 + Math.sin((days - i) / 6) * 0.18;
    const noise = 0.82 + seededFloat(`${key}:${iso}`) * 0.36;
    const gmvPaisa = Math.round(baseGmvPaisa * wave * noise);
    const orders = Math.max(1, Math.round(gmvPaisa / (140000 + seededInt(`${key}:aov:${iso}`, 0, 60000))));
    const views = orders * (28 + seededInt(`${key}:v:${iso}`, 0, 22));
    const carts = Math.round(views * (0.12 + seededFloat(`${key}:c:${iso}`) * 0.08));
    points.push({ date: iso, gmvPaisa, orders, views, carts });
  }
  return points;
}

export function sellerSeries(sellerId: string, days = 30): DailyPoint[] {
  return dailySeries(`seller:${sellerId}`, days, 380000 + seededInt(`base:${sellerId}`, 0, 620000));
}

export function stateSeries(stateCode: string, days = 30): DailyPoint[] {
  return dailySeries(`state:${stateCode}`, days, 4200000 + seededInt(`base:${stateCode}`, 0, 5200000));
}

export function globalSeries(days = 30): DailyPoint[] {
  return dailySeries("global", days, 28500000);
}

export function productSeries(productId: string, days = 30): DailyPoint[] {
  return dailySeries(`product:${productId}`, days, 60000 + seededInt(`base:${productId}`, 0, 240000));
}
