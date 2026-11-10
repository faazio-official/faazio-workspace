"use client";
// Shared festival opt-in surface. Promotions is campaign-first (pick a campaign, then products);
// Offers is product-first (browse products, then join the live campaign). Both use the same
// validation so a seller can never submit a discount the gateway would reject or silently cap.
import { useState } from "react";
import { BadgePercent, ChevronDown, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Card, EmptyState, PageHeader, RadioRow, Sheet } from "@/components/sellers/kit";
import { formatDate, formatINR } from "@/lib/format";
import { optinCap, validateOptin } from "@/lib/pricing/rules";
import { upsertOptin } from "@/lib/api";
import {
  useCampaigns,
  useOptins,
  usePortalLoading,
  useProducts,
  useSectorCaps,
  useSellerScope,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import type { Sector } from "@/data/types";

const CAP_STATUS: Record<string, string> = {
  APPROVED: "bg-success-soft text-success",
  PENDING: "bg-warning-soft text-warning",
  REJECTED: "bg-brand-soft text-brand",
};

export function FestivalOptins({
  title,
  sub,
  intro,
  sectorScoped = false,
}: {
  title: string;
  sub: string;
  intro?: string;
  /** Restrict the product list to the active store's sector (Mart/Pharmacy offers). */
  sectorScoped?: boolean;
}) {
  const { sellerId, storeId, activeStore } = useSellerScope();
  const loading = usePortalLoading();
  const products = useProducts({ sellerId, storeId });
  const campaigns = useCampaigns().filter(
    (c) => c.status === "LIVE" || c.status === "SCHEDULED",
  );
  const caps = useSectorCaps();
  const optins = useOptins({ sellerId });
  const [campaignId, setCampaignId] = useState("");
  const [picker, setPicker] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  const campaign = campaigns.find((c) => c.campaignId === campaignId) ?? campaigns[0];
  const sector = sectorScoped ? activeStore?.sector : undefined;
  const scoped = sectorScoped
    ? activeStore
      ? products.filter((p) => p.sector === activeStore.sector)
      : []
    : products;
  const visible = query
    ? scoped.filter((p) => {
        const q = query.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.productId.toLowerCase().includes(q);
      })
    : scoped;
  const campaignState = campaign?.scope === "STATE" ? campaign.stateCode : undefined;
  const capSectors: Sector[] =
    sectorScoped && sector ? [sector] : ["MART", "FOOD", "PHARMA"];

  return (
    <>
      <PageHeader title={title} sub={sub} />

      <div className="space-y-3 px-4 pt-3 pb-8">
        {intro && <p className="text-[12px] text-muted-foreground">{intro}</p>}

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
              <div
                className={cn(
                  "grid gap-2 text-center text-xs",
                  capSectors.length === 1 ? "grid-cols-1" : "grid-cols-3",
                )}
              >
                {capSectors.map((s) => {
                  const cap = optinCap(caps, s, campaignState);
                  return (
                    <div key={s}>
                      <p className="text-muted-foreground">{s} cap</p>
                      <p className="font-bold">{cap.configured ? `${cap.percent}%` : "Not set"}</p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 border-t border-border pt-2 text-center text-[10px] text-muted-foreground">
                Shoppers see the live price only after a district admin approves the opt-in.
              </p>
            </Card>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your products"
                aria-label="Search products"
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-9 text-sm outline-none focus:border-info"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {loading && scoped.length === 0 ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : scoped.length === 0 ? (
              <EmptyState text="No products listed yet" />
            ) : visible.length === 0 ? (
              <EmptyState text="No products match your search" />
            ) : (
              visible.map((product) => {
                const cap = optinCap(caps, product.sector, campaignState);
                const existing = optins.find(
                  (o) =>
                    o.productId === product.productId && o.campaignId === campaign.campaignId,
                );
                const draftKey = `${campaign.campaignId}:${product.productId}`;
                const draft =
                  drafts[draftKey] ?? (existing ? String(existing.discountPercent) : "");
                const requested = draft === "" ? 0 : Number(draft);
                const check = validateOptin(caps, product.sector, requested, campaignState);
                const pct = check.ok ? requested : 0;
                const livePaisa =
                  pct > 0
                    ? Math.round((product.pricePaisa * (100 - pct)) / 100)
                    : product.pricePaisa;
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
                          {product.sector} ·{" "}
                          {cap.configured ? `cap ${cap.percent}%` : "no cap set"} ·{" "}
                          {formatINR(product.pricePaisa)}
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
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          Not joined
                        </span>
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
                            setDrafts((d) => ({
                              ...d,
                              [draftKey]: e.target.value.replace(/[^0-9]/g, "").slice(0, 2),
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-info"
                        />
                      </div>
                      <button
                        disabled={!check.ok}
                        onClick={() => {
                          upsertOptin({
                            campaignId: campaign.campaignId,
                            sellerId,
                            productId: product.productId,
                            discountPercent: requested,
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
          <EmptyState text="Your district admin hasn't opened a campaign window yet" />
        )}
      </div>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Choose campaign">
        {campaigns.map((c) => (
          <RadioRow
            key={c.campaignId}
            label={c.name}
            sub={`${formatDate(c.startsAt)} → ${formatDate(c.endsAt)}`}
            checked={campaign?.campaignId === c.campaignId}
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
