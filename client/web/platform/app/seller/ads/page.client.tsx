"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import { requestAdSlot } from "@/lib/api";
import { useAdSlots, useMockLoading, useProducts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import type { AdSlot } from "@/data/types";


const PLACEMENTS: AdSlot["placement"][] = ["HOME_TOP", "SPONSORED_SHOWCASE", "SECTOR_RAIL"];

function SellerAds() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const slots = useAdSlots({ sellerId });
  const products = useProducts({ sellerId });
  const [placement, setPlacement] = useState<AdSlot["placement"]>("HOME_TOP");
  const [productId, setProductId] = useState(products[0]?.productId ?? "");

  const impressions = slots.reduce((t, s) => t + s.impressions, 0);
  const clicks = slots.reduce((t, s) => t + s.clicks, 0);
  const attributed = slots.reduce((t, s) => t + s.ordersAttributed, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ads"
        description="Sponsored slots go live only after an admin approves them."
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

      <SectionCard title="Request a placement">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Placement</Label>
            <Select value={placement} onValueChange={(v) => setPlacement(v as AdSlot["placement"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACEMENTS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.productId} value={p.productId}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              disabled={!productId}
              onClick={() => {
                requestAdSlot({
                  sellerId,
                  productId,
                  placement,
                  ...(session?.stateCode ? { stateCode: session.stateCode } : {}),
                });
                toast.success("Slot requested — pending admin approval");
              }}
            >
              Request slot
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="My placements" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={slots.length === 0}
          empty={<EmptyState title="No placements yet" description="Request a slot above to promote a product." />}
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
                    {slot.impressions ? formatPercent((slot.clicks / slot.impressions) * 100, 2) : "—"}
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
