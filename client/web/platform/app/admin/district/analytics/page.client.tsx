"use client";
import { useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { CategoryBars, GmvTrend, OrdersTrend, StatusDonut } from "@/components/patterns/Charts";
import { DataShell } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { StatusPill } from "@/components/patterns/Pills";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatNumber, formatPercent } from "@/lib/format";
import { periodDelta, sparkline, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { sellerMetrics, stateMetrics } from "@/lib/api";
import { useMockLoading, useOrders, useSellers } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";


const PERIODS = [7, 30, 90];

function StateAnalytics() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "TN";
  // No hardcoded district fallback — see the sellers page; the gateway already scopes the rows.
  const districtCode = session?.districtCode;
  const loading = useMockLoading();
  const [days, setDays] = useState(30);
  const series = stateMetrics(stateCode, days);
  const sellers = useSellers({ districtCode });
  const orders = useOrders({ stateCode });

  const leaderboard = sellers
    .map((seller) => {
      const s = sellerMetrics(seller.sellerId, days);
      return { seller, gmv: sumGmv(s), orders: sumOrders(s) };
    })
    .sort((a, b) => b.gmv - a.gmv);

  const byCity = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.city] = (acc[o.city] ?? 0) + o.amountPaisa;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const bySector = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.sector] = (acc[o.sector] ?? 0) + o.amountPaisa;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  const funnel = [
    { label: "Applications", value: sellers.length },
    { label: "Approved", value: sellers.filter((s) => s.status === "ACTIVE").length },
    {
      label: "Selling",
      value: new Set(orders.map((o) => o.sellerId)).size,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="State analytics"
        description="Scoped to your district, generated from the same deterministic series everywhere."
        actions={
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1">
              {PERIODS.map((option) => (
                <FilterChip
                  key={option}
                  label={`${option}d`}
                  active={days === option}
                  onClick={() => setDays(option)}
                />
              ))}
            </div>
            <ComponentHelp id="period-filter" label="About the reporting window" />
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
              spark: sparkline(series, (p) => p.gmvPaisa),
            },
            {
              label: "Orders",
              value: formatNumber(sumOrders(series)),
              deltaPercent: periodDelta(series, (p) => p.orders),
              spark: sparkline(series, (p) => p.orders),
            },
            { label: "Sellers", value: formatNumber(sellers.length) },
            {
              label: "Approval rate",
              value: sellers.length
                ? formatPercent(
                    (sellers.filter((s) => s.status === "ACTIVE").length / sellers.length) * 100,
                  )
                : "0%",
            },
          ]}
        />
      </DataShell>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="GMV by day" className="lg:col-span-2">
          <GmvTrend data={series} />
        </SectionCard>
        <SectionCard title="Sector mix">
          <StatusDonut data={bySector} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Orders by day" className="lg:col-span-2">
          <OrdersTrend data={series} />
        </SectionCard>
        <SectionCard title="Onboarding funnel">
          <ul className="space-y-3">
            {funnel.map((step, index) => (
              <li key={step.label}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">{step.label}</span>
                  <span className="num font-semibold">{formatNumber(step.value)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{
                      width: `${Math.max(4, (step.value / (funnel[0]?.value || 1)) * 100)}%`,
                    }}
                  />
                </div>
                {index > 0 ? (
                  <p className="num mt-1 text-[11px] text-muted-foreground">
                    {formatPercent((step.value / (funnel[index - 1]?.value || 1)) * 100)} of previous step
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="GMV by city">
        <CategoryBars data={byCity.slice(0, 8)} />
      </SectionCard>

      <SectionCard
        title="Seller leaderboard"
        description="Top and bottom movers"
        actions={<ComponentHelp id="seller-leaderboard" label="About the leaderboard" />}
        bodyClassName="p-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead className="text-right">GMV</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((row, index) => (
              <TableRow key={row.seller.sellerId} className="h-12">
                <TableCell className="num text-[12px] text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="text-[13px] font-medium">{row.seller.businessName}</TableCell>
                <TableCell className="num text-right font-semibold">{formatINR(row.gmv)}</TableCell>
                <TableCell className="num text-right">{formatNumber(row.orders)}</TableCell>
                <TableCell className="num text-right">{row.seller.rating.toFixed(1)}</TableCell>
                <TableCell>
                  <StatusPill status={row.seller.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

export default StateAnalytics;
