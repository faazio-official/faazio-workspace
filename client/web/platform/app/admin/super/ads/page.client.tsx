"use client";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { setAdStatus, setHeroCampaignStatus } from "@/lib/api";
import { useAdSlots, useHeroCampaigns, useMockLoading } from "@/lib/api/hooks";
import { HERO_PLACEMENT_META } from "@/data/ads/placements";


function SuperAds() {
  const loading = useMockLoading();
  const slots = useAdSlots();
  const campaigns = useHeroCampaigns();
  const impressions = slots.reduce((t, s) => t + s.impressions, 0);
  const clicks = slots.reduce((t, s) => t + s.clicks, 0);
  const pendingCampaigns = campaigns.filter((c) => c.status === "REQUESTED").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sponsored slots"
        description="You can override a state admin's approval in either direction."
      />

      <KpiStrip
        items={[
          { label: "Requests", value: formatNumber(slots.length + campaigns.length) },
          { label: "Awaiting decision", value: formatNumber(slots.filter((s) => s.status === "REQUESTED").length + pendingCampaigns) },
          { label: "Impressions", value: formatNumber(impressions) },
          { label: "CTR", value: impressions ? formatPercent((clicks / impressions) * 100, 2) : "0%" },
        ]}
      />

      <SectionCard title="Hero campaigns" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={campaigns.length === 0}
          empty={<EmptyState title="No hero campaigns" description="Sellers request hero campaigns from their ads page." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creative</TableHead>
                <TableHead>Placement</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Window</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.placementId} className="h-14">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt="" className="h-9 w-16 rounded object-cover" />
                      ) : (
                        <span className="h-9 w-16 rounded bg-muted" />
                      )}
                      <span className="text-[12px] font-medium">{c.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] font-medium">
                    {HERO_PLACEMENT_META[c.placement]?.label ?? c.placement.replace(/_/g, " ")}
                    {c.category ? <span className="num block text-[11px] text-muted-foreground">{c.category}</span> : null}
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">{c.sellerId}</TableCell>
                  <TableCell className="num text-[12px]">
                    {c.targetType} · {c.targetId}
                  </TableCell>
                  <TableCell className="num text-[11px] text-muted-foreground">
                    {formatDate(c.startsAt)} – {formatDate(c.endsAt)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {c.impressions ? formatPercent((c.clicks / c.impressions) * 100, 2) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={c.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={c.status === "LIVE"}
                        onClick={() => {
                          setHeroCampaignStatus(c.placementId, "LIVE");
                          toast.success("Campaign approved");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={c.status === "REJECTED"}
                        onClick={() => {
                          setHeroCampaignStatus(c.placementId, "REJECTED");
                          toast.success("Campaign rejected");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <SectionCard title="Rail placements" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={slots.length === 0}
          empty={<EmptyState title="No requests" description="Sellers request placements from their ads page." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placement</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map((slot) => (
                <TableRow key={slot.slotId} className="h-12">
                  <TableCell className="text-[13px] font-medium">
                    {slot.placement.replace(/_/g, " ")}
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">{slot.sellerId}</TableCell>
                  <TableCell className="num text-[12px]">{slot.productId}</TableCell>
                  <TableCell className="num text-[12px]">{slot.stateCode ?? "All"}</TableCell>
                  <TableCell className="num text-[12px]">{formatDate(slot.requestedAt)}</TableCell>
                  <TableCell className="num text-right">{formatNumber(slot.impressions)}</TableCell>
                  <TableCell className="num text-right">
                    {slot.impressions ? formatPercent((slot.clicks / slot.impressions) * 100, 2) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={slot.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={slot.status === "APPROVED"}
                        onClick={() => {
                          setAdStatus(slot.slotId, "APPROVED");
                          toast.success("Placement approved");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={slot.status === "REJECTED"}
                        onClick={() => {
                          setAdStatus(slot.slotId, "REJECTED");
                          toast.success("Placement rejected");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
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

export default SuperAds;
