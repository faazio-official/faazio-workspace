"use client";
import { useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { CategoryBars, GmvTrend, OrdersTrend, StatusDonut } from "@/components/patterns/Charts";
import { DataShell } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatNumber, formatPercent } from "@/lib/format";
import { periodDelta, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { productMetrics, sellerMetrics } from "@/lib/api";
import { useMockLoading, useOrders, useProducts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

const PERIODS = [7, 30, 90];

function SellerAnalytics() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const [days, setDays] = useState(30);
  const series = sellerMetrics(sellerId, days);
  const products = useProducts({ sellerId });
  const orders = useOrders({ sellerId });

  const views = series.reduce((t, p) => t + p.views, 0);
  const carts = series.reduce((t, p) => t + p.carts, 0);
  const orderCount = sumOrders(series);

  const perProduct = products.map((product) => {
    const s = productMetrics(product.productId, days);
    return {
      product,
      gmv: sumGmv(s),
      orders: sumOrders(s),
      views: s.reduce((t, p) => t + p.views, 0),
    };
  });

  const categoryMix = Object.entries(
    perProduct.reduce<Record<string, number>>((acc, row) => {
      acc[row.product.category] = (acc[row.product.category] ?? 0) + row.gmv;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  const statusMix = Object.entries(
    orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  const cityMix = Object.entries(
    orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.city] = (acc[order.city] ?? 0) + order.amountPaisa;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shop analytics"
        description="Sales, conversion and category mix for your shop."
        actions={
          <div className="flex items-center gap-1.5">
            {PERIODS.map((option) => (
              <FilterChip
                key={option}
                label={`${option}d`}
                active={days === option}
                onClick={() => setDays(option)}
              />
            ))}
            <ComponentHelp id="period-filter" />
          </div>
        }
      />

      <DataShell loading={loading}>
        <KpiStrip
          items={[
            {
              label: `GMV (${days}d)`,
              value: formatINR(sumGmv(series), { compact: true }),
              deltaPercent: periodDelta(series, (p) => p.gmvPaisa),
              compare: "vs previous period",
            },
            {
              label: "Orders",
              value: formatNumber(orderCount),
              deltaPercent: periodDelta(series, (p) => p.orders),
              compare: "vs previous period",
            },
            {
              label: "Product views",
              value: formatNumber(views),
              deltaPercent: periodDelta(series, (p) => p.views),
              compare: "vs previous period",
            },
            {
              label: "View → order",
              value: views ? formatPercent((orderCount / views) * 100, 2) : "0%",
              hint: "Conversion",
            },
          ]}
        />
      </DataShell>

      <SectionCard title="Revenue trend" actions={<ComponentHelp id="revenue-trend" />}>
        <DataShell loading={loading} skeletonRows={4}>
          <GmvTrend data={series} />
        </DataShell>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Conversion funnel"
          description={`Last ${days} days`}
          actions={<ComponentHelp id="conversion-funnel" />}
        >
          <ul className="space-y-3">
            {[
              { label: "Views", value: views },
              { label: "Carts", value: carts },
              { label: "Orders", value: orderCount },
            ].map((step, index, all) => {
              const first = all[0]?.value ?? 1;
              return (
                <li key={step.label}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="num font-medium">{formatNumber(step.value)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-secondary">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.max(4, (step.value / first) * 100)}%` }}
                    />
                  </div>
                  {index > 0 ? (
                    <p className="num mt-1 text-[11px] text-muted-foreground">
                      {formatPercent((step.value / (all[index - 1]?.value ?? 1)) * 100)} of previous
                      step
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </SectionCard>
        <SectionCard title="Orders per day">
          <OrdersTrend data={series} />
        </SectionCard>
        <SectionCard title="Order status split">
          <StatusDonut data={statusMix} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Category mix" description="GMV share by category">
          <CategoryBars data={categoryMix} />
        </SectionCard>
        <SectionCard title="Top cities" description="GMV by delivery city">
          <CategoryBars data={cityMix.slice(0, 6)} />
        </SectionCard>
      </div>

      <SectionCard
        title="Product performance"
        bodyClassName="p-0"
        actions={<ComponentHelp id="product-performance" />}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
              <TableHead className="text-right">GMV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perProduct
              .sort((a, b) => b.gmv - a.gmv)
              .map((row) => (
                <TableRow key={row.product.productId} className="h-12">
                  <TableCell className="text-[13px] font-medium">{row.product.name}</TableCell>
                  <TableCell className="num text-right">{formatNumber(row.views)}</TableCell>
                  <TableCell className="num text-right">{formatNumber(row.orders)}</TableCell>
                  <TableCell className="num text-right">
                    {row.views ? formatPercent((row.orders / row.views) * 100, 2) : "—"}
                  </TableCell>
                  <TableCell className="num text-right font-medium">
                    {formatINR(row.gmv)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

export default SellerAnalytics;
