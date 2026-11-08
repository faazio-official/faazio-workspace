"use client";
import { Megaphone } from "lucide-react";
import { HubHeader } from "@/components/sellers/shells";
import { Card, EmptyState } from "@/components/sellers/kit";
import { formatNumber, formatPercent } from "@/lib/format";
import { useAdSlots, useHeroCampaigns, usePortalLoading, usePlacements, useSellerScope } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { placementLabel } from "@/lib/api/reference";
import { CampaignWizard } from "./components/CampaignWizard";
import { cn } from "@/lib/utils";
import type { AdStatus } from "@/data/types";

const AD_PILL: Record<AdStatus, string> = {
  REQUESTED: "bg-info-soft text-info",
  APPROVED: "bg-info-soft text-info",
  REJECTED: "bg-brand-soft text-brand",
  LIVE: "bg-success-soft text-success",
};

function SellerAds() {
  const session = useSession();
  const { sellerId, storeId } = useSellerScope();
  const loading = usePortalLoading();
  const placements = usePlacements();
  const slots = useAdSlots({ sellerId, storeId: storeId || undefined });
  const campaigns = useHeroCampaigns({ sellerId, storeId: storeId || undefined });

  const impressions =
    slots.reduce((t, s) => t + s.impressions, 0) + campaigns.reduce((t, c) => t + c.impressions, 0);
  const clicks =
    slots.reduce((t, s) => t + s.clicks, 0) + campaigns.reduce((t, c) => t + c.clicks, 0);
  const attributed =
    slots.reduce((t, s) => t + s.ordersAttributed, 0) +
    campaigns.reduce((t, c) => t + c.ordersAttributed, 0);

  const kpis = [
    { label: "Impressions", value: formatNumber(impressions) },
    { label: "Clicks", value: formatNumber(clicks) },
    { label: "CTR", value: impressions ? formatPercent((clicks / impressions) * 100, 2) : "0%" },
    { label: "Orders attributed", value: formatNumber(attributed) },
  ];

  return (
    <>
      <HubHeader />
      <div className="space-y-3 px-4 pt-3 pb-8">
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((k) => (
            <Card key={k.label}>
              <p className="text-[10px] text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-lg font-bold">{k.value}</p>
            </Card>
          ))}
        </div>

        <CampaignWizard sellerId={sellerId} stateCode={session?.stateCode} />

        <p className="pt-2 text-sm font-bold">My campaigns</p>
        {loading && campaigns.length === 0 ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-12 w-12" strokeWidth={1.2} />}
            text="No hero campaigns yet — publish one above and it goes live instantly"
          />
        ) : (
          campaigns.map((c) => (
            <div key={c.placementId} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Megaphone className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {placementLabel(placements, c.placement)}
                  </p>
                  <p className="truncate text-xs">{c.title}</p>
                  <p className="num text-[10px] text-muted-foreground">
                    {c.targetType} · {c.targetId}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                    AD_PILL[c.status],
                  )}
                >
                  {c.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center text-[10px] min-[400px]:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Impressions</p>
                  <b>{formatNumber(c.impressions)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">Clicks</p>
                  <b>{formatNumber(c.clicks)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">CTR</p>
                  <b>{c.impressions ? formatPercent((c.clicks / c.impressions) * 100, 2) : "—"}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">Orders</p>
                  <b>{c.ordersAttributed}</b>
                </div>
              </div>
            </div>
          ))
        )}

        <p className="pt-2 text-sm font-bold">Product rails</p>
        {slots.length === 0 ? (
          <EmptyState text="No rail placements yet — requested from the placement picker" />
        ) : (
          slots.map((slot) => (
            <div key={slot.slotId} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{slot.placement.replace(/_/g, " ")}</p>
                  <p className="num truncate text-[11px] text-muted-foreground">{slot.productId}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                    AD_PILL[slot.status],
                  )}
                >
                  {slot.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center text-[10px] min-[400px]:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Impressions</p>
                  <b>{formatNumber(slot.impressions)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">Clicks</p>
                  <b>{formatNumber(slot.clicks)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">CTR</p>
                  <b>{slot.impressions ? formatPercent((slot.clicks / slot.impressions) * 100, 2) : "—"}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">Orders</p>
                  <b>{slot.ordersAttributed}</b>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default SellerAds;