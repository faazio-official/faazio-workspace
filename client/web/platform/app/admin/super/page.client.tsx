"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { GmvTrend, StatusDonut } from "@/components/patterns/Charts";
import { DataShell } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { StatusPill } from "@/components/patterns/Pills";
import { formatINR, formatNumber } from "@/lib/format";
import { periodDelta, sparkline, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { globalMetrics } from "@/lib/api";
import {
  useCampaigns,
  useMockLoading,
  useOrders,
  useSellers,
  useDistrictAdmins,
} from "@/lib/api/hooks";
import { DISTRICTS, districtName } from "@/data/districts";


function SuperDashboard() {
  const loading = useMockLoading();
  const series = globalMetrics(30);
  const sellers = useSellers();
  const orders = useOrders();
  const campaigns = useCampaigns();
  const admins = useDistrictAdmins();
  const [showUncoveredOnly, setShowUncoveredOnly] = useState(false);

  const uncovered = DISTRICTS.filter(
    (d) => admins.filter((a) => a.districtCode === d.districtCode && a.active).length === 0,
  );
  const visibleDistricts = showUncoveredOnly ? uncovered : DISTRICTS;
  const sectorMix = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.sector] = (acc[o.sector] ?? 0) + o.amountPaisa;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-4">
      <PageHeader title="Command center" description="Global scope — every district, seller and campaign." />

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
            { label: "Districts live", value: formatNumber(DISTRICTS.length) },
            { label: "Uncovered districts", value: formatNumber(uncovered.length) },
            { label: "District admins", value: formatNumber(admins.filter((a) => a.active).length) },
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

      <SectionCard
        title="District matrix"
        description="Sellers and admin coverage per district"
        actions={
          <div className="flex gap-1">
            <FilterChip
              label="All"
              active={!showUncoveredOnly}
              onClick={() => setShowUncoveredOnly(false)}
            />
            <FilterChip
              label="Uncovered only"
              active={showUncoveredOnly}
              onClick={() => setShowUncoveredOnly(true)}
            />
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleDistricts.map((info) => {
            const districtSellers = sellers.filter((s) => s.districtCode === info.districtCode);
            const roster = admins.filter((a) => a.districtCode === info.districtCode && a.active);
            return (
              <Link
                key={info.districtCode}
                href="/admin/super/districts"
                className="lift rounded-xl border border-border p-3 transition-transform"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold">
                    <span className="num">{info.districtCode}</span> · {info.name}
                  </p>
                  <StatusPill status={roster.length === 0 ? "AT_RISK" : "HEALTHY"} />
                </div>
                <p className="num mt-2 text-[18px] font-semibold leading-none">
                  {formatNumber(districtSellers.length)}
                </p>
                <p className="num mt-1 text-[11px] text-muted-foreground">
                  sellers · {roster.length} admin{roster.length === 1 ? "" : "s"} · {info.stateCode}
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
            {uncovered.slice(0, 6).map((info) => (
              <li key={info.districtCode}>
                <Link
                  href="/admin/super/district-admins"
                  className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[13px]"
                >
                  <AlertTriangle className="size-4 text-warning" />
                  0 active admins for <span className="num">{info.districtCode}</span> — {districtName(info.districtCode)}
                </Link>
              </li>
            ))}
            {uncovered.length > 6 ? (
              <li>
                <Link
                  href="/admin/super/district-admins"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] text-muted-foreground"
                >
                  <span className="num">
                    {uncovered.length - 6} more uncovered district{uncovered.length - 6 === 1 ? "" : "s"}
                  </span>
                  — review the roster
                </Link>
              </li>
            ) : null}
            {sellers.filter((s) => s.status === "PENDING_REVIEW").length > 0 ? (
              <li>
                <Link
                  href="/admin/super/sellers"
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px]"
                >
                  {sellers.filter((s) => s.status === "PENDING_REVIEW").length} seller applications open
                  across all districts
                </Link>
              </li>
            ) : null}
            {uncovered.length === 0 ? (
              <li className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-[13px]">
                Every district has at least one active admin.
              </li>
            ) : null}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

export default SuperDashboard;
