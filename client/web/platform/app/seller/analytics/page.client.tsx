"use client";
import { useState } from "react";
import { HubHeader } from "@/components/sellers/shells";
import { Card, EmptyState } from "@/components/sellers/kit";
import { LineSpark, Bars } from "@/components/sellers/charts";
import { formatINR, formatNumber } from "@/lib/format";
import { periodDelta, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { useAnalyticsRanks, useAnalyticsSeries, useMockLoading, useOrders, useProducts, useSellerScope } from "@/lib/api/hooks";
import { orderStatusLabel } from "@/lib/sector";
import { cn } from "@/lib/utils";

const PERIODS = [
  { key: 7, label: "7d" },
  { key: 30, label: "30d" },
  { key: 90, label: "90d" },
];

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
  const up = value > 0;
  return (
    <span className={cn("text-[10px] font-semibold", up ? "text-success" : "text-brand")}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(value))}%
    </span>
  );
}

function SellerAnalytics() {
  const { sellerId, storeId, activeStore } = useSellerScope();
  const sector = activeStore?.sector;
  const loading = useMockLoading();
  const [days, setDays] = useState(30);
  const series = useAnalyticsSeries("seller", sellerId, days);
  const ranks = useAnalyticsRanks(days);
  const productTotal = new Map(ranks.products.map((p) => [p.id, p]));
  const products = useProducts({ sellerId, storeId });
  const orders = useOrders({ sellerId, storeId });

  const orderCount = sumOrders(series);
  const gmvTotal = sumGmv(series);
  const gmvSerie = series.map((p) => p.gmvPaisa);
  const orderSerie = series.map((p) => p.orders);

  const perProduct = products.map((product) => {
    const rank = productTotal.get(product.productId);
    return { product, gmv: rank?.gmvPaisa ?? 0, orders: rank?.orders ?? 0 };
  });

  const categoryMix = Object.entries(
    perProduct.reduce<Record<string, number>>((acc, row) => {
      acc[row.product.category] = (acc[row.product.category] ?? 0) + row.gmv;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const statusMix = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const maxStatus = Math.max(1, ...statusMix.map((s) => s.value));

  const cityMix = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.city] = (acc[o.city] ?? 0) + o.amountPaisa;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const maxCity = Math.max(1, ...cityMix.map((c) => c.value));

  const sortedProducts = [...perProduct].sort((a, b) => b.gmv - a.gmv).slice(0, 8);

  return (
    <>
      <HubHeader
        actions={
          <div className="flex items-center gap-1">
            {PERIODS.map((option) => (
              <button
                key={option.key}
                onClick={() => setDays(option.key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  days === option.key ? "border-foreground bg-foreground text-background" : "border-border bg-card",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-3 px-4 pt-3 pb-8">
        {loading && series.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <p className="text-[10px] text-muted-foreground">GMV ({days}d)</p>
                <p className="mt-1 text-xl font-bold">
                  {formatINR(gmvTotal, { compact: true })}{" "}
                  <Delta value={periodDelta(series, (p) => p.gmvPaisa)} />
                </p>
                <p className="mt-3 text-[10px] text-muted-foreground">vs previous period</p>
                {gmvSerie.length > 1 ? <LineSpark data={gmvSerie} height={34} /> : null}
              </Card>
              <Card>
                <p className="text-[10px] text-muted-foreground">Orders ({days}d)</p>
                <p className="mt-1 text-xl font-bold">
                  {formatNumber(orderCount)} <Delta value={periodDelta(series, (p) => p.orders)} />
                </p>
                <p className="mt-3 text-[10px] text-muted-foreground">vs previous period</p>
                {orderSerie.length > 1 ? <LineSpark data={orderSerie} height={34} /> : null}
              </Card>
            </div>

            <Card>
              <p className="text-sm font-bold">Revenue trend</p>
              <p className="text-[10px] text-muted-foreground">Last {days} days, settled order value</p>
              {gmvSerie.length > 1 ? (
                <Bars data={gmvSerie} />
              ) : (
                <EmptyState text="Not enough data yet to plot revenue" />
              )}
            </Card>

            <Card>
              <p className="text-sm font-bold">Order status split</p>
              {statusMix.length === 0 ? (
                <EmptyState text="No orders in this period" />
              ) : (
                statusMix.map((s) => (
                  <div key={s.label} className="mt-3">
                    <div className="flex justify-between text-xs">
                      <span>{orderStatusLabel(s.label, sector)}</span>
                      <b>{formatNumber(s.value)}</b>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-info"
                        style={{ width: `${Math.max(4, (s.value / maxStatus) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </Card>

            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <p className="text-sm font-bold">Category mix</p>
                <p className="text-[10px] text-muted-foreground">GMV share by category</p>
                {categoryMix.length === 0 ? (
                  <EmptyState text="No category data yet" />
                ) : (
                  categoryMix.map((c) => (
                    <div key={c.label} className="mt-3 flex items-center justify-between text-xs">
                      <span className="truncate">{c.label}</span>
                      <span className="pl-3 font-semibold">{formatINR(c.value, { compact: true })}</span>
                    </div>
                  ))
                )}
              </Card>
              <Card>
                <p className="text-sm font-bold">Top cities</p>
                <p className="text-[10px] text-muted-foreground">GMV by delivery city</p>
                {cityMix.length === 0 ? (
                  <EmptyState text="No city data yet" />
                ) : (
                  cityMix.slice(0, 6).map((c) => (
                    <div key={c.label} className="mt-3">
                      <div className="flex justify-between text-xs">
                        <span>{c.label}</span>
                        <b>{formatINR(c.value, { compact: true })}</b>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-brand"
                          style={{ width: `${Math.max(4, (c.value / maxCity) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </div>

            <Card>
              <p className="text-sm font-bold">Product performance</p>
              <p className="text-[10px] text-muted-foreground">GMV and orders by product</p>
              {sortedProducts.length === 0 ? (
                <EmptyState text="No product sales in this period" />
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {sortedProducts.map((row) => (
                    <li key={row.product.productId} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <span className="min-w-0 truncate">{row.product.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatNumber(row.orders)} orders
                      </span>
                      <span className="w-20 shrink-0 text-right font-semibold">
                        {formatINR(row.gmv, { compact: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}

export default SellerAnalytics;