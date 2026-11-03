"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Card, EmptyState } from "@/components/sellers/kit";
import { formatINR, formatDateTime, parseRupeesToPaisa } from "@/lib/format";
import { validatePrice } from "@/lib/pricing/rules";
import { upsertPrice } from "@/lib/api";
import { useAuditLogs, useMockLoading, useProducts, useSellerScope } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

function SellerPricing() {
  const { sellerId, storeId } = useSellerScope();
  const loading = useMockLoading();
  const products = useProducts({ sellerId, storeId });
  const logs = useAuditLogs({ query: "" }).filter((l) => l.action === "PRICE_UPDATE");
  const [drafts, setDrafts] = useState<Record<string, { price: string; mrp: string }>>({});
  const [massPercent, setMassPercent] = useState("");

  const median = useMemo(() => {
    if (products.length === 0) return 0;
    const sorted = [...products].map((p) => p.pricePaisa).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  }, [products]);

  function draftFor(productId: string, price: number, mrp: number) {
    return drafts[productId] ?? { price: String(price / 100), mrp: String(mrp / 100) };
  }

  function applyMass() {
    const pct = Number(massPercent);
    if (!pct) return;
    products.forEach((p) => {
      const next = Math.round(p.pricePaisa * (1 - pct / 100));
      if (validatePrice(p.mrpPaisa, next).ok) upsertPrice(p.productId, next, p.mrpPaisa);
    });
    setDrafts({});
    setMassPercent("");
    toast.success(`Applied ${pct}% cut where the floor allowed it`);
  }

  return (
    <>
      <PageHeader
        title="Pricing"
        sub="Catalog"
        right={
          <div className="flex items-center gap-2">
            <input
              value={massPercent}
              inputMode="numeric"
              placeholder="Mass cut %"
              onChange={(e) => setMassPercent(e.target.value)}
              className="w-20 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-info"
            />
            <button
              disabled={!massPercent}
              onClick={applyMass}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Apply to all
            </button>
          </div>
        }
      />

      <div className="space-y-3 px-4 pt-3 pb-8">
        {loading && products.length === 0 ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState text="List a product first, then set its shelf price here" />
        ) : (
          products.map((product) => {
            const draft = draftFor(product.productId, product.pricePaisa, product.mrpPaisa);
            const mrpPaisa = parseRupeesToPaisa(draft.mrp);
            const pricePaisa = parseRupeesToPaisa(draft.price);
            const check = validatePrice(mrpPaisa, pricePaisa);
            const ratio = median ? (pricePaisa / median) * 100 : 100;
            return (
              <Card key={product.productId}>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-lg">
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
                    <p className="num text-[10px] text-muted-foreground">
                      {product.productId} ·{" "}
                      <span className={cn(!check.ok && "text-brand")}>{check.discountPercent}% off</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                      MRP (₹)
                    </span>
                    <input
                      value={draft.mrp}
                      inputMode="decimal"
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [product.productId]: { ...draft, mrp: e.target.value },
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-info"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                      Price (₹)
                    </span>
                    <input
                      value={draft.price}
                      inputMode="decimal"
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [product.productId]: { ...draft, price: e.target.value },
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-info"
                    />
                  </label>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 w-full flex-1 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-1.5 rounded-full",
                        ratio > 115 ? "bg-warning" : "bg-success",
                      )}
                      style={{ width: `${Math.min(100, ratio / 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    vs median {ratio.toFixed(0)}%
                  </span>
                  <button
                    disabled={!check.ok}
                    onClick={() => {
                      upsertPrice(product.productId, pricePaisa, mrpPaisa);
                      toast.success(`${product.name} now ${formatINR(pricePaisa)}`);
                    }}
                    className="shrink-0 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
                {!check.ok && (
                  <p className="mt-2 text-[11px] font-semibold text-brand">{check.message}</p>
                )}
              </Card>
            );
          })
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold">Price change history</p>
          <p className="mb-2 text-[10px] text-muted-foreground">Written to the audit log on every save.</p>
          {logs.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No price changes yet — saved edits appear here with before and after values.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {logs.slice(0, 8).map((log) => (
                <li key={log.logId} className="py-2.5 text-xs">
                  <span className="text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                  <span className="ml-2 font-semibold">{log.entityId}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {log.before ?? "—"} → {log.after ?? "—"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}

export default SellerPricing;