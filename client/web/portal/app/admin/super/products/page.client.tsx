"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatNumber } from "@/lib/format";
import { deleteProduct, setProductStatus } from "@/lib/api";
import { useMockLoading, useProducts } from "@/lib/api/hooks";
import type { Sector } from "@/data/types";
import { ProductThumb } from "@/components/patterns/ProductThumb";


const SECTORS: (Sector | "ALL")[] = ["ALL", "MART", "FOOD", "PHARMA"];

function SuperProducts() {
  const loading = useMockLoading();
  const [sector, setSector] = useState<Sector | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const products = useProducts({ sector, query });

  function toggle(id: string) {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Global catalog" description="Every listing across every state and seller." />

      <KpiStrip
        items={[
          { label: "Listings", value: formatNumber(products.length) },
          { label: "Active", value: formatNumber(products.filter((p) => p.status === "ACTIVE").length) },
          {
            label: "Pending review",
            value: formatNumber(products.filter((p) => p.status === "PENDING_REVIEW").length),
          },
          { label: "Selected", value: formatNumber(selected.length) },
        ]}
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
          {selected.length > 0 ? (
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  selected.forEach((id) => setProductStatus(id, "ACTIVE", "Bulk approved"));
                  toast.success(`${selected.length} listings approved`);
                  setSelected([]);
                }}
              >
                Approve selected
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    Delete selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selected.length} listings?</AlertDialogTitle>
                    <AlertDialogDescription>
                      They disappear from the consumer app immediately. The deletion is logged.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        selected.forEach((id) => deleteProduct(id, "Bulk removal by super admin"));
                        toast.success(`${selected.length} listings removed`);
                        setSelected([]);
                      }}
                    >
                      Delete listings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </div>
        <DataShell
          loading={loading}
          isEmpty={products.length === 0}
          empty={<EmptyState title="No listings match" description="Clear the filters to see the full catalog." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Product</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.productId} className="h-12">
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(product.productId)}
                      onCheckedChange={() => toggle(product.productId)}
                      aria-label={`Select ${product.name}`}
                    />
                  </TableCell>
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
                  <TableCell className="num text-right">{product.discountPercent}%</TableCell>
                  <TableCell>
                    <StatusPill status={product.status} />
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

export default SuperProducts;
