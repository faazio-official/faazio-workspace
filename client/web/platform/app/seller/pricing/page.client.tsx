"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
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
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { validatePrice } from "@/lib/pricing/rules";
import { upsertPrice } from "@/lib/api";
import { useAuditLogs, useMockLoading, useProducts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductThumb } from "@/components/patterns/ProductThumb";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

function SellerPricing() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const products = useProducts({ sellerId });
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
    <div className="space-y-4">
      <PageHeader
        title="Pricing"
        description="Everyday pricing is yours. Festival discounts stay inside admin caps."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Input
                className="h-9 w-40"
                placeholder="Mass cut %"
                value={massPercent}
                onChange={(e) => setMassPercent(e.target.value)}
                inputMode="numeric"
              />
              <ComponentHelp id="mass-cut-input" />
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={applyMass} disabled={!massPercent}>
                Apply to all
              </Button>
              <ComponentHelp id="apply-to-all-button" />
            </div>
          </div>
        }
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={products.length === 0}
          empty={
            <EmptyState
              title="Nothing to price"
              description="List a product first, then set its shelf price here."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-32 text-right">
                  <span className="flex items-center justify-end gap-1">
                    MRP (₹)
                    <ComponentHelp id="mrp-input" />
                  </span>
                </TableHead>
                <TableHead className="w-32 text-right">
                  <span className="flex items-center justify-end gap-1">
                    Price (₹)
                    <ComponentHelp id="price-input" />
                  </span>
                </TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead>vs category median</TableHead>
                <TableHead className="text-right">
                  <ComponentHelp id="save-price-button" label="About saving a price" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const draft = draftFor(product.productId, product.pricePaisa, product.mrpPaisa);
                const mrpPaisa = parseRupeesToPaisa(draft.mrp);
                const pricePaisa = parseRupeesToPaisa(draft.price);
                const check = validatePrice(mrpPaisa, pricePaisa);
                const ratio = median ? (pricePaisa / median) * 100 : 100;
                return (
                  <TableRow key={product.productId} className="h-12">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProductThumb product={product} />
                        <div>
                          <p className="text-[13px] font-medium">{product.name}</p>
                          <p className="num text-[11px] text-muted-foreground">
                            {product.productId}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="num h-8 text-right"
                        value={draft.mrp}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [product.productId]: { ...draft, mrp: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        className={cn("num h-8 text-right", !check.ok && "border-destructive")}
                        value={draft.price}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [product.productId]: { ...draft, price: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="num text-right">{check.discountPercent}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-secondary">
                          <div
                            className={cn(
                              "h-1.5 rounded-full",
                              ratio > 115 ? "bg-warning" : "bg-success",
                            )}
                            style={{ width: `${Math.min(100, ratio / 2)}%` }}
                          />
                        </div>
                        <span className="num text-[12px] text-muted-foreground">
                          {ratio.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!check.ok}
                        onClick={() => {
                          upsertPrice(product.productId, pricePaisa, mrpPaisa);
                          toast.success(`${product.name} now ${formatINR(pricePaisa)}`);
                        }}
                      >
                        Save
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <SectionCard
        title="Price change history"
        description="Written to the audit log on every save"
      >
        <DataShell
          loading={loading}
          isEmpty={logs.length === 0}
          empty={
            <EmptyState
              title="No price changes yet"
              description="Saved edits appear here with before and after values."
            />
          }
          skeletonRows={3}
        >
          <ol className="space-y-3">
            {logs.slice(0, 8).map((log) => (
              <li key={log.logId} className="flex gap-3 text-[13px]">
                <span className="num w-32 shrink-0 text-muted-foreground">
                  {formatDateTime(log.createdAt)}
                </span>
                <span className="num font-medium">{log.entityId}</span>
                <span className="num text-muted-foreground">
                  {log.before ?? "—"} → {log.after ?? "—"}
                </span>
              </li>
            ))}
          </ol>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default SellerPricing;
