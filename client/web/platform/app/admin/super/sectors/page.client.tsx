"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
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
import { remote } from "@/lib/api/http";
import { remoteConfigured } from "@/lib/config";


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
          <div className="mt-4 flex items-center justify-end gap-1.5">
            <ComponentHelp id="rename-category" label="About renaming a category" />
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
          <div className="mt-4 flex items-center justify-end gap-1.5">
            <ComponentHelp id="merge-categories" label="About merging categories" />
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

      <GstRateMaster />

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


interface TaxCategoryRow {
  taxRateId: string;
  sector: string;
  category: string;
  gstRatePct: number;
  isActive: boolean;
}

const GST_RATES = [0, 5, 12, 18, 28];

/**
 * SUPER_ADMIN-owned category → GST rate master. These rows drive the seller category picker and the
 * gateway's checkout tax split, so a seller can never invent a category or pick a lower rate.
 */
function GstRateMaster() {
  const [rows, setRows] = useState<TaxCategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sector, setSector] = useState<Sector>("MART");
  const [category, setCategory] = useState("");
  const [rate, setRate] = useState("5");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!remoteConfigured()) return;
    setLoading(true);
    remote
      .get<Record<string, unknown>[]>("/admin/tax/categories")
      .then((data) =>
        setRows(
          data.map((r) => ({
            taxRateId: String(r["taxRateId"] ?? ""),
            sector: String(r["sector"] ?? ""),
            category: String(r["category"] ?? ""),
            gstRatePct: Number(r["gstRatePct"] ?? 5),
            isActive: Boolean(r["isActive"] ?? true),
          })),
        ),
      )
      .catch(() => toast.error("Could not load the GST rate master"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const save = (body: { sector: string; category: string; gstRatePct: number }) => {
    setSaving(true);
    remote
      .put("/admin/tax/categories", body)
      .then(() => {
        toast.success(`${body.category} set to GST ${body.gstRatePct}%`);
        load();
      })
      .catch(() => toast.error("Could not save the category rate"))
      .finally(() => setSaving(false));
  };

  const remove = (row: TaxCategoryRow) => {
    remote
      .delete(`/admin/tax/categories/${encodeURIComponent(row.taxRateId)}`)
      .then(() => {
        toast.success(`${row.category} removed`);
        load();
      })
      .catch(() => toast.error("Could not delete the category"));
  };

  return (
    <SectionCard
      title="GST rate master"
      description="Category, sector and GST rate — authoritative for seller listings and checkout."
    >
      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Sector</Label>
          <Select value={sector} onValueChange={(v) => setSector(v as Sector)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTORS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gst-category">Category</Label>
          <Input
            id="gst-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Audio, Thali, Devices…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>GST rate</Label>
          <Select value={rate} onValueChange={setRate}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GST_RATES.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-1.5">
          <ComponentHelp id="gst-add" label="About adding a category" />
          <Button
            size="sm"
            className="w-full"
            disabled={saving || category.trim().length < 2}
            onClick={() => {
              save({ sector, category: category.trim(), gstRatePct: Number(rate) });
              setCategory("");
            }}
          >
            Save category
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1.5">
                  GST rate
                  <ComponentHelp id="gst-rate" label="About the GST rate" />
                </span>
              </TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1.5">
                  Action
                  <ComponentHelp id="gst-delete" label="About deleting a category" />
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-[12px] text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-[12px] text-muted-foreground">
                  No categories yet. Add one above.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.taxRateId} className="h-12">
                  <TableCell className="text-[13px] font-medium">{row.category}</TableCell>
                  <TableCell>
                    <SectorPill sector={row.sector as Sector} />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={String(row.gstRatePct)}
                      onValueChange={(v) =>
                        save({ sector: row.sector, category: row.category, gstRatePct: Number(v) })
                      }
                    >
                      <SelectTrigger className="h-8 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GST_RATES.map((r) => (
                          <SelectItem key={r} value={String(r)}>
                            {r}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => remove(row)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

export default SuperSectors;
