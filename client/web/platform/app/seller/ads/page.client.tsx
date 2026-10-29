"use client";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import { useAdSlots, useHeroCampaigns, useMockLoading } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { HERO_PLACEMENT_META } from "@/data/ads/placements";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { CampaignWizard } from "./components/CampaignWizard";

function SellerAds() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const slots = useAdSlots({ sellerId });
  const campaigns = useHeroCampaigns({ sellerId });

  const impressions =
    slots.reduce((t, s) => t + s.impressions, 0) + campaigns.reduce((t, c) => t + c.impressions, 0);
  const clicks =
    slots.reduce((t, s) => t + s.clicks, 0) + campaigns.reduce((t, c) => t + c.clicks, 0);
  const attributed =
    slots.reduce((t, s) => t + s.ordersAttributed, 0) +
    campaigns.reduce((t, c) => t + c.ordersAttributed, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ads"
        description="Ads go live instantly — machine-checked, not admin-approved. Abuse is removed only after a report."
        actions={<ComponentHelp id="campaign-wizard" label="About creating a campaign" />}
      />

      <DataShell loading={loading}>
        <KpiStrip
          items={[
            { label: "Impressions", value: formatNumber(impressions) },
            { label: "Clicks", value: formatNumber(clicks) },
            {
              label: "CTR",
              value: impressions ? formatPercent((clicks / impressions) * 100, 2) : "0%",
            },
            { label: "Orders attributed", value: formatNumber(attributed) },
          ]}
        />
      </DataShell>

      <CampaignWizard sellerId={sellerId} stateCode={session?.stateCode} />

      <SectionCard
        title="My campaigns"
        bodyClassName="p-0"
        actions={<ComponentHelp id="my-campaigns" />}
      >
        <DataShell
          loading={loading}
          isEmpty={campaigns.length === 0}
          empty={
            <EmptyState
              title="No hero campaigns yet"
              description="Publish a campaign above — it goes live immediately on the placements you pick."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placement</TableHead>
                <TableHead>Creative</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.placementId} className="h-14">
                  <TableCell className="text-[13px] font-medium">
                    {HERO_PLACEMENT_META[c.placement]?.label ?? c.placement.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt="" className="h-8 w-14 rounded object-cover" />
                      ) : (
                        <span className="h-8 w-14 rounded bg-muted" />
                      )}
                      <span className="text-[12px] font-medium">{c.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {c.targetType} · {c.targetId}
                  </TableCell>
                  <TableCell className="num text-right">{formatNumber(c.impressions)}</TableCell>
                  <TableCell className="num text-right">{formatNumber(c.clicks)}</TableCell>
                  <TableCell className="num text-right">
                    {c.impressions ? formatPercent((c.clicks / c.impressions) * 100, 2) : "—"}
                  </TableCell>
                  <TableCell className="num text-right">{c.ordersAttributed}</TableCell>
                  <TableCell>
                    <StatusPill status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <SectionCard
        title="Product rails"
        bodyClassName="p-0"
        actions={<ComponentHelp id="product-rails" />}
      >
        <DataShell
          loading={loading}
          isEmpty={slots.length === 0}
          empty={
            <EmptyState
              title="No rail placements yet"
              description="Rail placements are requested from the placement picker."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placement</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map((slot) => (
                <TableRow key={slot.slotId} className="h-12">
                  <TableCell className="text-[13px] font-medium">
                    {slot.placement.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {slot.productId}
                  </TableCell>
                  <TableCell className="num text-right">{formatNumber(slot.impressions)}</TableCell>
                  <TableCell className="num text-right">{formatNumber(slot.clicks)}</TableCell>
                  <TableCell className="num text-right">
                    {slot.impressions
                      ? formatPercent((slot.clicks / slot.impressions) * 100, 2)
                      : "—"}
                  </TableCell>
                  <TableCell className="num text-right">{slot.ordersAttributed}</TableCell>
                  <TableCell>
                    <StatusPill status={slot.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default SellerAds;
