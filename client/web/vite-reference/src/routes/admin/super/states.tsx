// 'use client'
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { GmvTrend } from "@/components/patterns/Charts";
import { FilterChip } from "@/components/patterns/FilterChip";
import { StatusPill } from "@/components/patterns/Pills";
import { EmptyState } from "@/components/patterns/DataState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pageMeta } from "@/lib/seo";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { periodDelta, sparkline, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { stateMetrics } from "@/lib/api";
import { useCampaigns, useSellers, useStateAdmins } from "@/lib/api/hooks";
import { STATES, stateName } from "@/data/states";

export const Route = createFileRoute("/admin/super/states")({
  head: () =>
    pageMeta("State drilldown", "Per-state sellers, GMV, live campaigns and the admin roster in one view."),
  component: SuperStates,
});

function SuperStates() {
  const [stateCode, setStateCode] = useState(STATES[0]?.stateCode ?? "MH");
  const series = stateMetrics(stateCode, 30);
  const sellers = useSellers({ stateCode });
  const admins = useStateAdmins(stateCode);
  const campaigns = useCampaigns({ stateCode });

  return (
    <div className="space-y-4">
      <PageHeader
        title="States"
        description="Pick a state to see its supply, demand and governance in one place."
        actions={
          <div className="flex flex-wrap gap-1">
            {STATES.map((info) => (
              <FilterChip
                key={info.stateCode}
                label={info.stateCode}
                active={stateCode === info.stateCode}
                onClick={() => setStateCode(info.stateCode)}
              />
            ))}
          </div>
        }
      />

      <KpiStrip
        items={[
          {
            label: "GMV (30d)",
            value: formatINR(sumGmv(series), { compact: true }),
            deltaPercent: periodDelta(series, (p) => p.gmvPaisa),
            spark: sparkline(series, (p) => p.gmvPaisa),
          },
          { label: "Orders (30d)", value: formatNumber(sumOrders(series)) },
          { label: "Sellers", value: formatNumber(sellers.length) },
          { label: "Active admins", value: formatNumber(admins.filter((a) => a.active).length) },
          { label: "Campaigns", value: formatNumber(campaigns.length) },
        ]}
      />

      <SectionCard title={`${stateName(stateCode)} GMV`} description="Last 30 days">
        <GmvTrend data={series} />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Admin roster" bodyClassName="p-0">
          {admins.length === 0 ? (
            <EmptyState
              title="No admins for this state"
              description="Create one from the State admins page so KYC and campaigns are covered."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.adminId} className="h-12">
                    <TableCell className="text-[13px] font-medium">{admin.name}</TableCell>
                    <TableCell className="num text-[12px]">{admin.email}</TableCell>
                    <TableCell>
                      <StatusPill status={admin.active ? "ACTIVE" : "DEACTIVATED"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard title="Campaigns" bodyClassName="p-0">
          {campaigns.length === 0 ? (
            <EmptyState title="No campaigns" description="This state has no festival campaigns yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.campaignId} className="h-12">
                    <TableCell className="text-[13px] font-medium">{campaign.name}</TableCell>
                    <TableCell className="num text-[12px]">
                      {formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={campaign.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Sellers in this state" bodyClassName="p-0">
        {sellers.length === 0 ? (
          <EmptyState title="No sellers" description="No seller has applied from this state yet." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller) => (
                <TableRow key={seller.sellerId} className="h-12">
                  <TableCell className="text-[13px] font-medium">{seller.businessName}</TableCell>
                  <TableCell className="text-[13px]">{seller.ownerName}</TableCell>
                  <TableCell className="num text-right">{seller.rating.toFixed(1)}</TableCell>
                  <TableCell>
                    <StatusPill status={seller.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
