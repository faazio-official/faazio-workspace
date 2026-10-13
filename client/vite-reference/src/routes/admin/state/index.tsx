// 'use client'
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { CategoryBars, GmvTrend } from "@/components/patterns/Charts";
import { DataShell } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { pageMeta } from "@/lib/seo";
import { formatINR, formatNumber, formatPercent } from "@/lib/format";
import { periodDelta, sparkline, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { stateMetrics } from "@/lib/api";
import { useCampaigns, useMockLoading, useOrders, useSellers } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { stateName } from "@/data/states";

export const Route = createFileRoute("/admin/state/")({
  head: () =>
    pageMeta(
      "State dashboard",
      "State GMV, orders, seller supply, SLA health and live festival campaigns at a glance.",
    ),
  component: StateDashboard,
});

function StateDashboard() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const series = stateMetrics(stateCode, 30);
  const sellers = useSellers({ stateCode });
  const orders = useOrders({ stateCode });
  const campaigns = useCampaigns({ stateCode });

  const pendingKyc = sellers.filter((s) => s.status === "PENDING_REVIEW").length;
  const breaches = orders.filter(
    (o) => new Date(o.slaDueAt).getTime() < Date.now() && o.status !== "DELIVERED",
  );
  const sectorMix = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.sector] = (acc[o.sector] ?? 0) + o.amountPaisa;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${stateName(stateCode)} dashboard`}
        description="Everything here is scoped to your state only."
      />

      <DataShell loading={loading}>
        <KpiStrip
          items={[
            {
              label: "GMV (30d)",
              value: formatINR(sumGmv(series), { compact: true }),
              deltaPercent: periodDelta(series, (p) => p.gmvPaisa),
              spark: sparkline(series, (p) => p.gmvPaisa),
            },
            {
              label: "Orders (30d)",
              value: formatNumber(sumOrders(series)),
              deltaPercent: periodDelta(series, (p) => p.orders),
              spark: sparkline(series, (p) => p.orders),
            },
            { label: "Active sellers", value: formatNumber(sellers.filter((s) => s.status === "ACTIVE").length) },
            { label: "Pending KYC", value: formatNumber(pendingKyc), hint: "Awaiting your review" },
            {
              label: "SLA breaches",
              value: formatNumber(breaches.length),
              hint: orders.length ? formatPercent((breaches.length / orders.length) * 100) : "0%",
            },
          ]}
        />
      </DataShell>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="GMV trend" description="Last 30 days" className="lg:col-span-2">
          <DataShell loading={loading} skeletonRows={4}>
            <GmvTrend data={series} />
          </DataShell>
        </SectionCard>
        <SectionCard title="Sector mix" description="GMV by sector">
          <CategoryBars data={sectorMix} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Festival campaigns"
          description="Your state plus global campaigns you must obey"
          actions={
            <Link to="/admin/state/festival" className="text-[12px] font-semibold text-primary">
              Manage
            </Link>
          }
        >
          <ul className="space-y-2">
            {campaigns.map((c) => (
              <li
                key={c.campaignId}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="text-[13px] font-medium">{c.name}</p>
                  <p className="num text-[11px] text-muted-foreground">
                    {c.scope}
                    {c.stateCode ? ` · ${c.stateCode}` : ""}
                  </p>
                </div>
                <StatusPill status={c.status} />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Alerts" description="Each alert links to its entity">
          <ul className="space-y-2">
            {pendingKyc > 0 ? (
              <li>
                <Link
                  to="/admin/state/sellers"
                  className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[13px]"
                >
                  <AlertTriangle className="size-4 text-warning" />
                  {pendingKyc} seller application{pendingKyc > 1 ? "s" : ""} awaiting KYC review
                </Link>
              </li>
            ) : null}
            {breaches.slice(0, 4).map((order) => (
              <li key={order.orderId}>
                <Link
                  to="/admin/state/orders"
                  className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px]"
                >
                  <AlertTriangle className="size-4 text-destructive" />
                  <span className="num">{order.orderId}</span> breached its dispatch SLA
                </Link>
              </li>
            ))}
            {pendingKyc === 0 && breaches.length === 0 ? (
              <li className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-[13px]">
                No open alerts for {stateName(stateCode)}.
              </li>
            ) : null}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
