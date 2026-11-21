"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CATEGORY_APPS,
  deleteGSTRateCategory,
  upsertGSTRateCategory,
} from "@/lib/api";
import type { CategoryApp, GSTRateCategory } from "@/lib/api";
import { useGSTRateCategories } from "@/lib/api/hooks";

/** GST slabs in force. 40 is the demerit slab (aerated drinks, tobacco). */
const GST_SLABS = [0, 5, 12, 18, 28, 40];

const SECTOR_LABEL: Record<CategoryApp, string> = {
  MART: "Mart",
  FOOD: "Food",
  PHARMA: "Pharma",
  MAIN_APP_HEADER: "Main app header",
};

/** One GST slab per sector, as the GST slab pick-list uses them. */
const SECTORS: CategoryApp[] = [...CATEGORY_APPS];

interface FormState {
  id?: string;
  name: string;
  sector: CategoryApp;
  gstRatePct: string;
}

const EMPTY_FORM: FormState = { name: "", sector: "MART", gstRatePct: "5" };

/**
 * SUPER_ADMIN-owned GST rate pick-list (`tax.gst_rate_categories`, 0118). Every taxonomy category and
 * sub-category links to exactly one of these rows, so a rate can never be invented per listing.
 * Deleting a slab is refused while a category still uses it — re-rate the category first.
 */
function SuperGSTRates() {
  const { items, loading, error, reload } = useGSTRateCategories();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(row: GSTRateCategory) {
    setForm({
      id: row.id,
      name: row.name,
      sector: row.sector,
      gstRatePct: String(row.gstRatePct),
    });
    setDialogOpen(true);
  }

  async function save() {
    if (form.name.trim().length < 2) {
      toast.error("Give the GST rate a name.");
      return;
    }
    setBusy(true);
    try {
      await upsertGSTRateCategory({
        ...(form.id ? { id: form.id } : {}),
        name: form.name.trim(),
        sector: form.sector,
        gstRatePct: Number(form.gstRatePct),
      });
      toast.success(form.id ? "GST rate updated" : "GST rate added");
      setDialogOpen(false);
      reload();
    } catch (err) {
      toast.error("Could not save the GST rate", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: GSTRateCategory) {
    setBusy(true);
    try {
      await deleteGSTRateCategory(row.id);
      toast.success(`${row.name} deactivated`);
      reload();
    } catch (err) {
      toast.error("Could not deactivate the GST rate", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  const bySector = (sector: CategoryApp) => items.filter((r) => r.sector === sector);

  return (
    <div className="space-y-4">
      <PageHeader
        title="GST rates"
        description="The GST rate pick-list. Each row is a named slab — the superadmin assigns one to every category and sub-category on the Categories page, so checkout tax always follows the category."
        actions={
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus className="size-4" /> New GST rate
          </Button>
        }
      />

      <DataShell
        loading={loading}
        error={error ?? undefined}
        isEmpty={items.length === 0}
        empty={
          <EmptyState
            title="No GST rates yet"
            description="Add a named slab, then assign it to a category."
          />
        }
      >
        <div className="space-y-4">
          {SECTORS.map((sector) => {
            const rows = bySector(sector);
            if (rows.length === 0) return null;
            return (
              <SectionCard key={sector} title={SECTOR_LABEL[sector]} bodyClassName="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-24">GST</TableHead>
                      <TableHead className="w-28">Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} className="h-12">
                        <TableCell className="text-[13px] font-medium">
                          {row.name}
                          <span className="num block text-[11px] text-muted-foreground">
                            {row.id}
                          </span>
                        </TableCell>
                        <TableCell className="num text-[13px]">{row.gstRatePct}%</TableCell>
                        <TableCell>
                          <span
                            className={
                              row.isActive
                                ? "text-[12px] text-foreground"
                                : "text-[12px] text-muted-foreground"
                            }
                          >
                            {row.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                              <Pencil className="size-3.5" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              disabled={!row.isActive || busy}
                              onClick={() => void remove(row)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            );
          })}
        </div>
      </DataShell>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit GST rate" : "New GST rate"}</DialogTitle>
            <DialogDescription>
              A named slab. Categories and sub-categories pick from this list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gst-name">Name</Label>
              <Input
                id="gst-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Fresh & Unbranded Staples"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sector</Label>
              <Select
                value={form.sector}
                onValueChange={(v) => setForm((f) => ({ ...f, sector: v as CategoryApp }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SECTOR_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>GST rate</Label>
              <Select
                value={form.gstRatePct}
                onValueChange={(v) => setForm((f) => ({ ...f, gstRatePct: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GST_SLABS.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.id ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <span className="text-[13px]">Active</span>
                <Switch
                  checked={items.find((r) => r.id === form.id)?.isActive ?? true}
                  disabled
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              {busy ? "Saving..." : form.id ? "Save changes" : "Add GST rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SuperGSTRates;
