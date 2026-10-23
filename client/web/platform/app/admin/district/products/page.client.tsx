"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { discountPercent } from "@/lib/pricing/rules";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { deleteProduct, updateProduct, upsertPrice } from "@/lib/api";
import { useMockLoading, useProducts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import type { ProductRecord, Sector } from "@/data/types";
import { ProductThumb } from "@/components/patterns/ProductThumb";


const SECTORS: (Sector | "ALL")[] = ["ALL", "MART", "FOOD", "PHARMA"];

function StateProducts() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const [sector, setSector] = useState<Sector | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const products = useProducts({ stateCode, sector, query });
  const [active, setActive] = useState<ProductRecord | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");

  function open(product: ProductRecord) {
    setActive(product);
    setName(product.name);
    setPrice((product.pricePaisa / 100).toString());
    setReason("");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Catalog moderation"
        description="Every edit and deletion is written to the audit log with your reason."
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product or id"
            className="h-9 w-56"
          />
          {SECTORS.map((option) => (
            <FilterChip
              key={option}
              label={option === "ALL" ? "All sectors" : option}
              active={sector === option}
              onClick={() => setSector(option)}
            />
          ))}
        </div>
        <DataShell
          loading={loading}
          isEmpty={products.length === 0}
          empty={<EmptyState title="No products" description="No seller in your district has listed a matching product." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
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
                  <TableCell className="num text-[12px] text-muted-foreground">{product.sellerId}</TableCell>
                  <TableCell className="num text-right">{formatINR(product.mrpPaisa)}</TableCell>
                  <TableCell className="num text-right">{formatINR(product.pricePaisa)}</TableCell>
                  <TableCell className="num text-right">{discountPercent(product.mrpPaisa, product.pricePaisa)}%</TableCell>
                  <TableCell>
                    <StatusPill status={product.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => open(product)}>
                      Moderate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Sheet open={Boolean(active)} onOpenChange={(next) => !next && setActive(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Moderate listing</SheetTitle>
            <SheetDescription>{active?.productId}</SheetDescription>
          </SheetHeader>
          {active ? (
            <div className="space-y-4 px-4 pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="mod-name">Product name</Label>
                <Input id="mod-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mod-price">Selling price (₹)</Label>
                <Input id="mod-price" className="num" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mod-reason">Reason (required)</Label>
                <Textarea id="mod-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={reason.trim().length < 4}
                  onClick={() => {
                    updateProduct(active.productId, { name });
                    upsertPrice(active.productId, parseRupeesToPaisa(price), active.mrpPaisa);
                    toast.success("Listing updated");
                    setActive(null);
                  }}
                >
                  Save changes
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={reason.trim().length < 4}
                  onClick={() => {
                    deleteProduct(active.productId, reason.trim());
                    toast.success("Listing removed");
                    setActive(null);
                  }}
                >
                  Delete listing
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default StateProducts;
