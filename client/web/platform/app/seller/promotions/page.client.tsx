"use client";
import { useState } from "react";
import { BadgePercent, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, Sheet, RadioRow, EmptyState } from "@/components/sellers/kit";
import { formatDate, formatINR } from "@/lib/format";
import { capFor, validateOptin } from "@/lib/pricing/rules";
import { upsertOptin } from "@/lib/api";
import {
  useCampaigns,
  usePortalLoading,
  useOptins,
  useProducts,
  useSellerScope,
  useSectorCaps,
} from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { cn } from "@/lib/utils";

const CAP_STATUS: Record<string, string> = {
  APPROVED: "bg-success-soft text-success",
  PENDING: "bg-warning-soft text-warning",
  REJECTED: "bg-brand-soft text-brand",
};

function SellerPromotions() {
  const session = useSession();
  const { sellerId, storeId } = useSellerScope();
  const stateCode = session?.stateCode;
  const loading = usePortalLoading();
  const products = useProducts({ sellerId, storeId });
  const campaigns = useCampaigns({ stateCode }).filter(
    (c) => c.status === "LIVE" || c.status === "SCHEDULED",
  );
  const caps = useSectorCaps();
  const optins = useOptins({ sellerId });
  const [campaignId, setCampaignId] = useState(campaigns[0]?.campaignId ?? "");
  const [picker, setPicker] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const campaign = campaigns.find((c) => c.campaignId === campaignId) ?? campaigns[0];

  return (
    <>
      <PageHeader title="Promotions" sub="Growth" />

      <div className="space-y-3 px-4 pt-3 pb-8">
        {campaign ? (
          <>
            <button
              onClick={() => setPicker(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
            >
              <BadgePercent className="h-4 w-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-semibold">{campaign.name}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {formatDate(campaign.startsAt)} → {formatDate(campaign.endsAt)} ·{" "}
                  {campaign.scope === "STATE" ? campaign.stateCode : "All states"}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                  campaign.status === "LIVE"
                    ? "bg-success-soft text-success"
                    : "bg-warning-soft text-warning",
                )}
              >
                {campaign.status}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            <Card>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {(["MART", "FOOD", "PHARMA"] as const).map((sector) => (
                  <div key={sector}>
                    <p className="text-muted-foreground">{sector} cap</p>
                    <p className="font-bold">
                      {capFor(
                        caps,
                        sector,
                        campaign.scope === "STATE" ? campaign.stateCode : undefined,
                      )}
                      %
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 border-t border-border pt-2 text-center text-[10px] text-muted-foreground">
                Shoppers see the live price only after a district admin approves the opt-in.
              </p>
            </Card>

            {loading && products.length === 0 ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState text="List a product first, then join the festival campaign" />
            ) : (
              products.map((product) => {
                const cap = capFor(
                  caps,
                  product.sector,
                  campaign.scope === "STATE" ? campaign.stateCode : undefined,
                );
                const existing = optins.find(
                  (o) => o.productId === product.productId && o.campaignId === campaign.campaignId,
                );
                const draft = drafts[product.productId] ?? String(existing?.discountPercent ?? "");
                const check = validateOptin(
                  caps,
                  product.sector,
                  Number(draft || 0),
                  campaign.scope === "STATE" ? campaign.stateCode : undefined,
                );
                const pct = check.ok ? Number(draft) : 0;
                const livePaisa =
                  pct > 0 ? Math.round((product.pricePaisa * (100 - pct)) / 100) : product.pricePaisa;
                return (
                  <Card key={product.productId}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xl">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          product.emoji
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{product.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {product.sector} · cap {cap}% · {formatINR(product.pricePaisa)}
                        </p>
                      </div>
                      {existing ? (
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                            CAP_STATUS[existing.status] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {existing.status}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] text-muted-foreground">Not joined</span>
                      )}
                    </div>
                    <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-medium text-muted-foreground">
                          Live price · <b>{formatINR(livePaisa)}</b>
                        </p>
                        <input
                          value={draft}
                          inputMode="numeric"
                          placeholder="Your discount %"
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [product.productId]: e.target.value }))
                          }
                          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-info"
                        />
                      </div>
                      <button
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
                        className="shrink-0 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background disabled:opacity-40"
                      >
                        {existing ? "Update" : "Opt in"}
                      </button>
                    </div>
                    {!check.ok && draft && (
                      <p className="mt-2 text-[11px] font-semibold text-brand">{check.message}</p>
                    )}
                  </Card>
                );
              })
            )}
          </>
        ) : (
          <EmptyState text="Your district admin has not opened a festival window yet" />
        )}
      </div>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Choose campaign">
        {campaigns.map((c) => (
          <RadioRow
            key={c.campaignId}
            label={c.name}
            sub={`${formatDate(c.startsAt)} → ${formatDate(c.endsAt)}`}
            checked={campaignId === c.campaignId}
            onClick={() => {
              setCampaignId(c.campaignId);
              setPicker(false);
            }}
          />
        ))}
      </Sheet>
    </>
  );
}

export default SellerPromotions;