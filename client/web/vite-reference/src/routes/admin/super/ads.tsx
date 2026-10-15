// 'use client'
import { createFileRoute } from "@tanstack/react-router";
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
import { pageMeta } from "@/lib/seo";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { setAdStatus } from "@/lib/api";
import { useAdSlots, useMockLoading } from "@/lib/api/hooks";

export const Route = createFileRoute("/admin/super/ads")({
  head: () =>
    pageMeta("Sponsored slots", "Approve, reject or pause every sponsored placement across the platform."),
  component: SuperAds,
});

function SuperAds() {
  const loading = useMockLoading();
  const slots = useAdSlots();
  const impressions = slots.reduce((t, s) => t + s.impressions, 0);
  const clicks = slots.reduce((t, s) => t + s.clicks, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sponsored slots"
        description="You can override a state admin's approval in either direction."
      />

      <KpiStrip
        items={[
          { label: "Requests", value: formatNumber(slots.length) },
          { label: "Awaiting decision", value: formatNumber(slots.filter((s) => s.status === "REQUESTED").length) },
          { label: "Impressions", value: formatNumber(impressions) },
          { label: "CTR", value: impressions ? formatPercent((clicks / impressions) * 100, 2) : "0%" },
        ]}
      />

      <SectionCard title="All placements" bodyClassName="p-0">
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
