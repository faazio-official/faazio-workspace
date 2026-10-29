"use client";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
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
import { updateStock } from "@/lib/api";
import { useMockLoading, useStock } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ProductThumb } from "@/components/patterns/ProductThumb";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

function SellerInventory() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const rows = useStock(sellerId);
  const [drafts, setDrafts] = useState<Record<string, { qty: string; eta: string }>>({});
  const [bulk, setBulk] = useState("");

  const lowStock = rows.filter((r) => r.quantity <= r.lowStockThreshold);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        description="Out-of-stock rows stop showing in the consumer app immediately."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Input
                className="h-9 w-40"
                placeholder="Set all to qty"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                inputMode="numeric"
              />
              <ComponentHelp id="bulk-qty-input" />
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={!bulk}
                onClick={() => {
                  rows.forEach((row) => updateStock(row.productId, Number(bulk), row.etaMinutes));
                  setBulk("");
                  setDrafts({});
                  toast.success("Stock updated for all listings");
                }}
              >
                Apply
              </Button>
              <ComponentHelp id="bulk-apply-button" />
            </div>
          </div>
        }
      />

      {lowStock.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px]">
          <AlertTriangle className="size-4 text-warning" />
          <span className="num font-semibold">{lowStock.length}</span> listings are at or below the
          low-stock threshold.
        </div>
      ) : null}

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title="No stock rows"
              description="Stock appears once you list a product."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-32 text-right">
                  <span className="flex items-center justify-end gap-1">
                    Quantity
                    <ComponentHelp id="qty-column" />
                  </span>
                </TableHead>
                <TableHead className="w-32 text-right">
                  <span className="flex items-center justify-end gap-1">
                    ETA (min)
                    <ComponentHelp id="eta-column" />
                  </span>
                </TableHead>
                <TableHead>Signal</TableHead>
                <TableHead className="text-right">
                  <ComponentHelp id="save-column" label="About saving stock" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const draft = drafts[row.productId] ?? {
                  qty: String(row.quantity),
                  eta: String(row.etaMinutes),
                };
                const low = Number(draft.qty) <= row.lowStockThreshold;
                return (
                  <TableRow key={row.productId} className="h-12">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProductThumb product={row.product} />
                        <div>
                          <p className="text-[13px] font-medium">{row.product.name}</p>
                          <p className="num text-[11px] text-muted-foreground">{row.productId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="num h-8 text-right"
                        value={draft.qty}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [row.productId]: { ...draft, qty: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="num h-8 text-right"
                        value={draft.eta}
                        onChange={(e) =>
                          setDrafts((d) => ({
                            ...d,
                            [row.productId]: { ...draft, eta: e.target.value },
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-[12px]">
                      {low ? (
                        <span className="text-warning">Low stock</span>
                      ) : (
                        <span className="text-success">Healthy</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          updateStock(row.productId, Number(draft.qty), Number(draft.eta));
                          toast.success("Stock saved");
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
    </div>
  );
}

export default SellerInventory;
