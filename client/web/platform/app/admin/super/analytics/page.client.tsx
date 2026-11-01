"use client";
import { useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
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
import { globalMetrics, sellerMetrics, stateMetrics } from "@/lib/api";
import { useMockLoading, useOrders, useProducts, useSellers } from "@/lib/api/hooks";
import { STATES } from "@/data/states";


const PERIODS = [7, 30, 90];

function SuperAnalytics() {
  const loading = useMockLoading();
  const [days, setDays] = useState(30);
  const series = globalMetrics(days);
  const sellers = useSellers();
  const products = useProducts();
  const orders = useOrders();

  const gmv = sumGmv(series);
  const perSeller = sellers
    .map((seller) => ({ seller, gmv: sumGmv(sellerMetrics(seller.sellerId, days)) }))
    .sort((a, b) => b.gmv - a.gmv);
  const topTenShare = perSeller.slice(0, 10).reduce((t, r) => t + r.gmv, 0);
  const sellerGmvTotal = perSeller.reduce((t, r) => t + r.gmv, 0);

  const byState = STATES.map((info) => ({
    label: info.stateCode,
    value: sumGmv(stateMetrics(info.stateCode, days)),
  })).sort((a, b) => b.value - a.value);

  const byCategory = Object.entries(
    products.reduce<Record<string, number>>((acc, product) => {
      acc[product.category] = (acc[product.category] ?? 0) + product.pricePaisa;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const sectorMix = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.sector] = (acc[o.sector] ?? 0) + o.amountPaisa;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Global analytics"
        description="Platform GMV, orders and category mix across every district."
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
            <ComponentHelp id="period-filter" label="About the date range" />
          </div>
        }
      />

      <DataShell loading={loading}>
        <KpiStrip
          items={[
            {
              label: `GMV (${days}d)`,
              value: formatINR(gmv, { compact: true }),
              deltaPercent: periodDelta(series, (p) => p.gmvPaisa),
              compare: "vs previous period",
            },
            {
              label: "Orders",
              value: formatNumber(sumOrders(series)),
              deltaPercent: periodDelta(series, (p) => p.orders),
              compare: "vs previous period",
            },
            {
              label: "Avg order value",
              value: sumOrders(series) ? formatINR(Math.round(gmv / sumOrders(series))) : "—",
            },
            {
              label: "Top-10 seller share",
              value: sellerGmvTotal ? formatPercent((topTenShare / sellerGmvTotal) * 100) : "0%",
              hint: "Concentration risk",
            },
            { label: "Listings", value: formatNumber(products.length) },
          ]}
        />
      </DataShell>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="GMV trend" className="lg:col-span-2">
          <GmvTrend data={series} />
        </SectionCard>
        <SectionCard title="Sector mix">
          <StatusDonut
            data={sectorMix}
            colors={{
              MART: "var(--color-mart)",
              FOOD: "var(--color-food)",
              PHARMA: "var(--color-pharma)",
            }}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Orders per day">
          <OrdersTrend data={series} />
        </SectionCard>
        <SectionCard title="GMV by state">
          <CategoryBars data={byState} />
        </SectionCard>
      </div>

      <SectionCard
        title="Category performance"
        description="Catalogue value by category"
        actions={<ComponentHelp id="category-performance" label="About category performance" />}
      >
        <CategoryBars data={byCategory.slice(0, 8)} />
      </SectionCard>

      <SectionCard
        title="Seller concentration"
        description={`Ranked by GMV over ${days} days`}
        bodyClassName="p-0"
        actions={<ComponentHelp id="seller-concentration" label="About seller concentration" />}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">GMV</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perSeller.map((row, index) => (
              <TableRow key={row.seller.sellerId} className="h-12">
                <TableCell className="num text-[12px] text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="text-[13px] font-medium">{row.seller.businessName}</TableCell>
                <TableCell className="num text-[13px]">{row.seller.stateCode}</TableCell>
                <TableCell className="num text-right font-medium">{formatINR(row.gmv)}</TableCell>
                <TableCell className="num text-right">
                  {sellerGmvTotal ? formatPercent((row.gmv / sellerGmvTotal) * 100) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

export default SuperAnalytics;
