"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatINR } from "@/lib/format";
import { capFor, validateOptin } from "@/lib/pricing/rules";
import { upsertOptin } from "@/lib/api";
import { useCampaigns, useMockLoading, useOptins, useProducts, useSectorCaps } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ProductThumb } from "@/components/patterns/ProductThumb";


function SellerPromotions() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const stateCode = session?.stateCode;
  const loading = useMockLoading();
  const products = useProducts({ sellerId });
  const campaigns = useCampaigns({ stateCode }).filter(
    (c) => c.status === "LIVE" || c.status === "SCHEDULED",
  );
  const caps = useSectorCaps();
  const optins = useOptins({ sellerId });
  const [campaignId, setCampaignId] = useState(campaigns[0]?.campaignId ?? "");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const campaign = campaigns.find((c) => c.campaignId === campaignId) ?? campaigns[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Promotions"
        description="Your everyday discounts stay yours. Festival discounts must sit under the cap."
        actions={
          campaigns.length > 0 ? (
            <Select value={campaign?.campaignId ?? ""} onValueChange={setCampaignId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.campaignId} value={c.campaignId}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />

      {campaign ? (
        <div className="surface flex flex-wrap items-center gap-4 p-4">
          <div>
            <p className="text-[14px] font-semibold">{campaign.name}</p>
            <p className="num text-[12px] text-muted-foreground">
              {formatDate(campaign.startsAt)} → {formatDate(campaign.endsAt)} ·{" "}
              {campaign.scope === "STATE" ? campaign.stateCode : "All states"}
            </p>
          </div>
          <StatusPill status={campaign.status} />
          <div className="ml-auto flex gap-4 text-[12px]">
            {(["MART", "FOOD", "PHARMA"] as const).map((sector) => (
              <div key={sector}>
                <p className="text-muted-foreground">{sector} cap</p>
                <p className="num font-semibold">
                  {capFor(caps, sector, campaign.scope === "STATE" ? campaign.stateCode : undefined)}%
                </p>
              </div>
            ))}
          </div>
          <p className="w-full text-[11px] text-muted-foreground">
            Shoppers see the live price only after a district admin approves the opt-in; the sector cap
            is enforced server-side.
          </p>
        </div>
      ) : null}

      <SectionCard title="Opt products in" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={products.length === 0 || !campaign}
          empty={
            <EmptyState
              title={campaign ? "No products to opt in" : "No live or scheduled campaign"}
              description={
                campaign
                  ? "List a product first, then join the festival campaign."
                  : "Your district admin has not opened a festival window yet."
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Cap</TableHead>
                <TableHead className="text-right">Live price</TableHead>
                <TableHead className="w-36 text-right">Your discount %</TableHead>
                <TableHead>Opt-in status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const cap = capFor(
                  caps,
                  product.sector,
                  campaign?.scope === "STATE" ? campaign.stateCode : undefined,
                );
                const existing = optins.find(
                  (o) => o.productId === product.productId && o.campaignId === campaign?.campaignId,
                );
                const draft = drafts[product.productId] ?? String(existing?.discountPercent ?? "");
                const check = validateOptin(
                  caps,
                  product.sector,
                  Number(draft || 0),
                  campaign?.scope === "STATE" ? campaign.stateCode : undefined,
                );
                return (
                  <TableRow key={product.productId} className="h-12">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProductThumb product={product} />
                        <span className="text-[13px] font-medium">{product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <SectorPill sector={product.sector} />
                    </TableCell>
                    <TableCell className="num text-right">{cap}%</TableCell>
                    <TableCell className="num text-right">
                      {(() => {
                        const pct = check.ok ? Number(draft) : 0;
                        const livePaisa =
                          pct > 0
                            ? Math.round((product.pricePaisa * (100 - pct)) / 100)
                            : product.pricePaisa;
                        return (
                          <div className="flex flex-col items-end leading-tight">
                            <span className="font-semibold">{formatINR(livePaisa)}</span>
                            {product.mrpPaisa > livePaisa ? (
                              <span className="text-[11px] text-muted-foreground line-through">
                                {formatINR(product.mrpPaisa)}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="num h-8 text-right"
                        value={draft}
                        inputMode="numeric"
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [product.productId]: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {existing ? <StatusPill status={existing.status} /> : <span className="text-[12px] text-muted-foreground">Not joined</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!check.ok || !campaign}
                        onClick={() => {
                          if (!campaign) return;
                          upsertOptin({
                            campaignId: campaign.campaignId,
                            sellerId,
                            productId: product.productId,
                            discountPercent: Number(draft),
                          });
                          toast.success("Opt-in submitted for approval");
                        }}
                      >
                        {existing ? "Update" : "Opt in"}
                      </Button>
                      {!check.ok && draft ? (
                        <p className="text-[11px] text-destructive">{check.message}</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default SellerPromotions;
