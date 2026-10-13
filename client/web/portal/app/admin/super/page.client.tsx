"use client";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { GmvTrend, StatusDonut } from "@/components/patterns/Charts";
import { DataShell } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { formatINR, formatNumber } from "@/lib/format";
import { periodDelta, sparkline, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { globalMetrics, stateMetrics } from "@/lib/api";
import {
  useCampaigns,
  useMockLoading,
  useOrders,
  useSellers,
  useStateAdmins,
} from "@/lib/api/hooks";
import { STATES } from "@/data/states";


function SuperDashboard() {
  const loading = useMockLoading();
  const series = globalMetrics(30);
  const sellers = useSellers();
  const orders = useOrders();
  const campaigns = useCampaigns();
  const admins = useStateAdmins();

  const uncovered = STATES.filter(
    (s) => admins.filter((a) => a.stateCode === s.stateCode && a.active).length === 0,
  );
  const sectorMix = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.sector] = (acc[o.sector] ?? 0) + o.amountPaisa;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-4">
      <PageHeader title="Command center" description="Global scope — every state, seller and campaign." />

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
            { label: "Sellers", value: formatNumber(sellers.length) },
            { label: "States live", value: formatNumber(STATES.length) },
            { label: "State admins", value: formatNumber(admins.filter((a) => a.active).length) },
          ]}
        />
      </DataShell>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Platform GMV" description="Last 30 days" className="lg:col-span-2">
          <DataShell loading={loading} skeletonRows={4}>
            <GmvTrend data={series} />
          </DataShell>
        </SectionCard>
        <SectionCard title="Sector mix">
          <StatusDonut data={sectorMix} />
        </SectionCard>
      </div>

      <SectionCard title="State matrix" description="GMV, sellers and admin coverage per state">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {STATES.map((info) => {
            const stateSeries = stateMetrics(info.stateCode, 30);
            const stateSellers = sellers.filter((s) => s.stateCode === info.stateCode);
            const roster = admins.filter((a) => a.stateCode === info.stateCode && a.active);
            return (
              <Link
                key={info.stateCode}
                href="/admin/super/states"
                className="lift rounded-xl border border-border p-3 transition-transform"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold">
                    <span className="num">{info.stateCode}</span> · {info.name}
                  </p>
                  <StatusPill status={roster.length === 0 ? "AT_RISK" : "HEALTHY"} />
                </div>
                <p className="num mt-2 text-[18px] font-semibold leading-none">
                  {formatINR(sumGmv(stateSeries), { compact: true })}
                </p>
                <p className="num mt-1 text-[11px] text-muted-foreground">
                  {stateSellers.length} sellers · {roster.length} admin{roster.length === 1 ? "" : "s"}
                </p>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Festival overview"
          actions={
            <Link href="/admin/super/festival" className="text-[12px] font-semibold text-primary">
              Governance
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

        <SectionCard title="System alerts">
          <ul className="space-y-2">
            {uncovered.map((info) => (
              <li key={info.stateCode}>
                <Link
                  href="/admin/super/state-admins"
                  className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[13px]"
                >
                  <AlertTriangle className="size-4 text-warning" />
                  0 active admins for <span className="num">{info.stateCode}</span> — {info.name}
                </Link>
              </li>
            ))}
            {sellers.filter((s) => s.status === "PENDING_REVIEW").length > 0 ? (
              <li>
                <Link
                  href="/admin/super/sellers"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px]"
                >
                  {sellers.filter((s) => s.status === "PENDING_REVIEW").length} seller applications open
                  across all states
                </Link>
              </li>
            ) : null}
            {uncovered.length === 0 ? (
              <li className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-[13px]">
                Every state has at least one active admin.
              </li>
            ) : null}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

export default SuperDashboard;
