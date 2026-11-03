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
import { formatINR, formatNumber } from "@/lib/format";
import { periodDelta, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { useAnalyticsRanks, useAnalyticsSeries, useMockLoading, useOrders, useProducts, useSellerScope } from "@/lib/api/hooks";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

const PERIODS = [7, 30, 90];

function SellerAnalytics() {
  const { sellerId, storeId } = useSellerScope();
  const loading = useMockLoading();
  const [days, setDays] = useState(30);
  const series = useAnalyticsSeries("seller", sellerId, days);
  const ranks = useAnalyticsRanks(days);
  const productTotal = new Map(ranks.products.map((p) => [p.id, p]));
  const products = useProducts({ sellerId, storeId });
  const orders = useOrders({ sellerId, storeId });

  const orderCount = sumOrders(series);

  const perProduct = products.map((product) => {
    const rank = productTotal.get(product.productId);
    return {
      product,
      gmv: rank?.gmvPaisa ?? 0,
      orders: rank?.orders ?? 0,
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
    <div className="space-y-4 px-4 pt-4">
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
          ]}
        />
      </DataShell>

      <SectionCard title="Revenue trend" actions={<ComponentHelp id="revenue-trend" />}>
        <DataShell loading={loading} skeletonRows={4}>
          <GmvTrend data={series} />
        </DataShell>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
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
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">GMV</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perProduct
              .sort((a, b) => b.gmv - a.gmv)
              .map((row) => (
                <TableRow key={row.product.productId} className="h-12">
                  <TableCell className="text-[13px] font-medium">{row.product.name}</TableCell>
                  <TableCell className="num text-right">{formatNumber(row.orders)}</TableCell>
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
