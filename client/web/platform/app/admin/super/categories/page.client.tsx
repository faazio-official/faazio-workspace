"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { FilterChip } from "@/components/patterns/FilterChip";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/lib/api";
import type { CategoryInput, CategoryRow } from "@/lib/api";
import type { Sector } from "@/data/types";

const SECTORS: Sector[] = ["MART", "FOOD", "PHARMA"];
const TABS = ["ALL", ...SECTORS] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  ALL: "All",
  MART: "Mart",
  FOOD: "Food",
  PHARMA: "Pharma",
};

export function CategoriesPage() {
  const [tab, setTab] = useState<Tab>("ALL");
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

  const [formApp, setFormApp] = useState<Sector>("MART");
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [formIconUrl, setFormIconUrl] = useState("");
  const [formSearchQuery, setFormSearchQuery] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formActive, setFormActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCategories(tab));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the category taxonomy.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setFormApp("MART");
    setFormName("");
    setFormParentId("");
    setFormIconUrl("");
    setFormSearchQuery("");
    setFormSortOrder("0");
    setFormActive(true);
  }

  function openCreate() {
    resetForm();
    setCreating(true);
    setEditing(null);
  }

  function openEdit(row: CategoryRow) {
    setFormApp((SECTORS.includes(row.app as Sector) ? row.app : "MART") as Sector);
    setFormName(row.name);
    setFormParentId(row.parentId ?? "");
    setFormIconUrl(row.iconUrl ?? "");
    setFormSearchQuery(row.searchQuery ?? "");
    setFormSortOrder(String(row.sortOrder));
    setFormActive(row.isActive);
    setEditing(row);
    setCreating(false);
  }

  function closeSheet() {
    setCreating(false);
    setEditing(null);
  }

  async function save() {
    if (!formName.trim()) {
      toast.error("Category name is required.");
      return;
    }
    const input: CategoryInput = {
      app: formApp,
      name: formName.trim(),
      parentId: formParentId.trim() ? formParentId.trim() : null,
      sortOrder: Number.isFinite(Number(formSortOrder)) ? Number(formSortOrder) : 0,
      isActive: formActive,
      ...(formIconUrl.trim() ? { iconUrl: formIconUrl.trim() } : {}),
      ...(formSearchQuery.trim() ? { searchQuery: formSearchQuery.trim() } : {}),
    };
    setBusy(true);
    try {
      if (editing) {
        await updateCategory(editing.id, input);
        toast.success("Category updated");
      } else {
        await createCategory(input);
        toast.success("Category created");
      }
      closeSheet();
      void load();
    } catch (err) {
      toast.error("Could not save the category", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteCategory(deleting.id);
      toast.success("Category deactivated", {
        description: "It is hidden in the apps; existing sellers keep their reference.",
      });
      setDeleting(null);
      void load();
    } catch (err) {
      toast.error("Could not deactivate the category", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  const parentName = (id: string | null) =>
    id ? rows.find((r) => r.id === id)?.name ?? id : "—";
  const sheetOpen = creating || Boolean(editing);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categories"
        description="The central category taxonomy (Mart, Food, Pharma). Every app and seller picks from this list — delete hides a category without breaking existing references."
        actions={
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus className="size-4" /> New category
          </Button>
        }
      />

      <SectionCard title="Category tree" bodyClassName="p-0">
        <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
          {TABS.map((t) => (
            <FilterChip
              key={t}
              label={TAB_LABEL[t]}
              active={tab === t}
              onClick={() => setTab(t)}
            />
          ))}
        </div>

        <DataShell
          loading={loading}
          error={error ?? undefined}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title="No categories yet"
              description="Create a top-level category, then add its children."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="h-12">
                  <TableCell className="text-[13px] font-medium">
                    {row.name}
                    <span className="num block text-[11px] text-muted-foreground">{row.id}</span>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{row.app}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {parentName(row.parentId)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={row.isActive ? "ACTIVE" : "INACTIVE"} />
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {row.sortOrder}
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {row.updatedAt ? formatDateTime(row.updatedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={!row.isActive}
                        onClick={() => setDeleting(row)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Sheet
        open={sheetOpen}
        onOpenChange={(next) => {
          if (!next) closeSheet();
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.name}` : "New category"}</SheetTitle>
            <SheetDescription>
              App-scoped and parent/child. Leave parent blank for a top-level category.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <Label>App</Label>
              <Select value={formApp} onValueChange={(v) => setFormApp(v as Sector)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TAB_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. North Indian"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-parent">Parent category id</Label>
              <Input
                id="category-parent"
                value={formParentId}
                onChange={(e) => setFormParentId(e.target.value)}
                placeholder="blank = top level (e.g. cat_north_indian)"
                disabled={Boolean(editing) && formParentId === editing?.id}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-icon">Icon URL</Label>
              <Input
                id="category-icon"
                value={formIconUrl}
                onChange={(e) => setFormIconUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-search">Vendor search query</Label>
              <Input
                id="category-search"
                value={formSearchQuery}
                onChange={(e) => setFormSearchQuery(e.target.value)}
                placeholder="leaf only — routes the drill-in to vendors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-sort">Sort order</Label>
              <Input
                id="category-sort"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
                inputMode="numeric"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <label htmlFor="category-active" className="text-[13px]">
                Active
                <span className="block text-[11px] text-muted-foreground">
                  Hidden when off, without deleting it.
                </span>
              </label>
              <Switch id="category-active" checked={formActive} onCheckedChange={setFormActive} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeSheet}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? "Saving..." : editing ? "Save changes" : "Create category"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The category is hidden in the apps immediately. Existing sellers and products that
              reference it are preserved, and you can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmDelete()}>
              {busy ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CategoriesPage;
