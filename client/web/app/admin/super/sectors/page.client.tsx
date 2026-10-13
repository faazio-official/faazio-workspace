"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell } from "@/components/patterns/DataState";
import { SectorPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatINR, formatNumber } from "@/lib/format";
import { capFor } from "@/lib/pricing/rules";
import { updateProduct } from "@/lib/api";
import { useMockLoading, useProducts, useSectorCaps } from "@/lib/api/hooks";
import type { Sector } from "@/data/types";


const SECTORS: Sector[] = ["MART", "FOOD", "PHARMA"];

function SuperSectors() {
  const loading = useMockLoading();
  const products = useProducts();
  const caps = useSectorCaps();
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeInto, setMergeInto] = useState("");

  const categories = [...new Set(products.map((p) => p.category))].sort();
  const rows = categories.map((category) => {
    const items = products.filter((p) => p.category === category);
    const prices = items.map((p) => p.pricePaisa);
    return {
      category,
      sector: items[0]?.sector ?? "MART",
      count: items.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      prescription: items.filter((p) => p.isPrescription).length,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sectors & categories"
        description="Sectors are fixed (MART, FOOD, PHARMA). Categories inside them are editable."
      />

      <SectionCard title="Sector caps in force">
        <div className="grid gap-3 md:grid-cols-3">
          {SECTORS.map((sector) => (
            <div key={sector} className="rounded-xl border border-border p-3">
              <SectorPill sector={sector} />
              <p className="num mt-2 text-[22px] font-semibold leading-none">{capFor(caps, sector)}%</p>
              <p className="text-[11px] text-muted-foreground">
                {formatNumber(products.filter((p) => p.sector === sector).length)} listings
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Rename a category" description="Applies to every listing in that category">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={renameFrom} onValueChange={setRenameFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rename-to">New name</Label>
              <Input id="rename-to" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              disabled={!renameFrom || renameTo.trim().length < 2}
              onClick={() => {
                products
                  .filter((p) => p.category === renameFrom)
                  .forEach((p) => updateProduct(p.productId, { category: renameTo.trim() }));
                toast.success(`Renamed "${renameFrom}" to "${renameTo.trim()}"`);
                setRenameFrom("");
                setRenameTo("");
              }}
            >
              Rename category
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Merge categories" description="Moves every listing from one category into another">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Merge from</Label>
              <Select value={mergeFrom} onValueChange={setMergeFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Merge into</Label>
              <Select value={mergeInto} onValueChange={setMergeInto}>
                <SelectTrigger>
                  <SelectValue placeholder="Target" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => c !== mergeFrom)
                    .map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!mergeFrom || !mergeInto}
              onClick={() => {
                products
                  .filter((p) => p.category === mergeFrom)
                  .forEach((p) => updateProduct(p.productId, { category: mergeInto }));
                toast.success(`Merged "${mergeFrom}" into "${mergeInto}"`);
                setMergeFrom("");
                setMergeInto("");
              }}
            >
              Merge categories
            </Button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Category master" bodyClassName="p-0">
        <DataShell loading={loading}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Listings</TableHead>
                <TableHead className="text-right">Lowest price</TableHead>
                <TableHead className="text-right">Highest price</TableHead>
                <TableHead className="text-right">Prescription items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.category} className="h-12">
                  <TableCell className="text-[13px] font-medium">{row.category}</TableCell>
                  <TableCell>
                    <SectorPill sector={row.sector} />
                  </TableCell>
                  <TableCell className="num text-right">{row.count}</TableCell>
                  <TableCell className="num text-right">{formatINR(row.min)}</TableCell>
                  <TableCell className="num text-right">{formatINR(row.max)}</TableCell>
                  <TableCell className="num text-right">{row.prescription}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default SuperSectors;
