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
  listCategoriesByHeader,
  updateCategory,
} from "@/lib/api";
import type { CategoryHeader, CategoryInput, CategoryRow } from "@/lib/api";
import { tamilFieldError } from "@/lib/tamil";
import { cn } from "@/lib/utils";
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

const HEADER_LABEL: Record<CategoryHeader, string> = {
  MAIN_APP_HEADER: "Main app header",
  MART: "Mart",
  FOOD: "Food",
  PHARMA: "Pharma",
};

/** Quiet header-label chip — meta stays text, never a glowing pill. */
function HeaderTag({ header }: { header: CategoryHeader }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
        header === "MAIN_APP_HEADER"
          ? "bg-brand-soft text-brand"
          : "bg-muted text-muted-foreground",
      )}
    >
      {HEADER_LABEL[header]}
    </span>
  );
}

function HeaderTags({ labels }: { labels?: CategoryHeader[] }) {
  if (!labels || labels.length === 0) {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((h) => (
        <HeaderTag key={h} header={h} />
      ))}
    </div>
  );
}

export function CategoriesPage() {
  const [tab, setTab] = useState<Tab>("ALL");
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [mainRows, setMainRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainLoading, setMainLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainError, setMainError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

  const [formApp, setFormApp] = useState<Sector>("MART");
  const [formName, setFormName] = useState("");
  // Optional Tamil translations (0107). Tamil letters only; blank = not translated.
  const [formNameTa, setFormNameTa] = useState("");
  const [formDescriptionTa, setFormDescriptionTa] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [formIconUrl, setFormIconUrl] = useState("");
  const [formSearchQuery, setFormSearchQuery] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formActive, setFormActive] = useState(true);
  // MAIN_APP_HEADER label — the shared main app header list (0115). FOOD is not eligible.
  const [formMainHeader, setFormMainHeader] = useState(false);

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

  const loadMain = useCallback(async () => {
    setMainLoading(true);
    setMainError(null);
    try {
      setMainRows(await listCategoriesByHeader("MAIN_APP_HEADER"));
    } catch (err) {
      setMainError(
        err instanceof Error ? err.message : "Could not load the main app header list.",
      );
    } finally {
      setMainLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMain();
  }, [loadMain]);

  function resetForm() {
    setFormApp("MART");
    setFormName("");
    setFormNameTa("");
    setFormDescriptionTa("");
    setFormParentId("");
    setFormIconUrl("");
    setFormSearchQuery("");
    setFormSortOrder("0");
    setFormActive(true);
    setFormMainHeader(false);
  }

  function openCreate() {
    resetForm();
    setCreating(true);
    setEditing(null);
  }

  function openEdit(row: CategoryRow) {
    setFormApp((SECTORS.includes(row.app as Sector) ? row.app : "MART") as Sector);
    setFormName(row.name);
    setFormNameTa(row.nameTa ?? "");
    setFormDescriptionTa(row.descriptionTa ?? "");
    setFormParentId(row.parentId ?? "");
    setFormIconUrl(row.iconUrl ?? "");
    setFormSearchQuery(row.searchQuery ?? "");
    setFormSortOrder(String(row.sortOrder));
    setFormActive(row.isActive);
    // FOOD rows cannot carry the shared header (the server rejects them); never prefill a disabled
    // switch as checked, which would post a value the gateway would 400.
    setFormMainHeader(
      row.app !== "FOOD" &&
        (row.headerLabels?.includes("MAIN_APP_HEADER") ?? row.showOnHomeRail),
    );
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
    const nameTaError = tamilFieldError(formNameTa, 120);
    const descriptionTaError = tamilFieldError(formDescriptionTa, 2000);
    if (nameTaError || descriptionTaError) {
      toast.error("Check the Tamil fields", {
        description: nameTaError ?? descriptionTaError ?? undefined,
      });
      return;
    }
    if (formMainHeader && formApp === "FOOD") {
      toast.error("Food categories cannot be in the main app header.");
      return;
    }
    // The primary app label is always present; MAIN_APP_HEADER is the shared main app header list.
    const headerLabels: CategoryHeader[] = formMainHeader
      ? [formApp, "MAIN_APP_HEADER"]
      : [formApp];
    const input: CategoryInput = {
      app: formApp,
      name: formName.trim(),
      ...(formNameTa.trim() ? { nameTa: formNameTa.trim() } : {}),
      ...(formDescriptionTa.trim() ? { descriptionTa: formDescriptionTa.trim() } : {}),
      parentId: formParentId.trim() ? formParentId.trim() : null,
      sortOrder: Number.isFinite(Number(formSortOrder)) ? Number(formSortOrder) : 0,
      isActive: formActive,
      headerLabels,
      showOnHomeRail: formMainHeader,
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
      void loadMain();
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
      void loadMain();
    } catch (err) {
      toast.error("Could not deactivate the category", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  const parentName = (id: string | null) =>
    id
      ? mainRows.find((r) => r.id === id)?.name ??
        rows.find((r) => r.id === id)?.name ??
        id
      : "—";
  const sheetOpen = creating || Boolean(editing);

  function rowActions(row: CategoryRow) {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categories"
        description="The central category taxonomy (Mart, Food, Pharma). Each category has one primary app; Mart and Pharma categories can also be shared into the main app header. Every app and seller picks from this list — delete hides a category without breaking existing references."
        actions={
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus className="size-4" /> New category
          </Button>
        }
      />

      <SectionCard title="Main app header" bodyClassName="p-0">
        <p className="border-b border-border px-3 py-2 text-[12px] text-muted-foreground">
          Categories shared into the mobile main app header. Mart and Pharma rows keep their own app
          list and also appear here. Food is not eligible.
        </p>
        <DataShell
          loading={mainLoading}
          error={mainError ?? undefined}
          isEmpty={mainRows.length === 0}
          empty={
            <EmptyState
              title="Nothing shared yet"
              description="Tag a Mart or Pharma category with the main app header label to list it here."
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mainRows.map((row) => (
                <TableRow key={row.id} className="h-12">
                  <TableCell className="text-[13px] font-medium">
                    {row.name}
                    {row.nameTa ? (
                      <span className="block text-[12px] text-muted-foreground">{row.nameTa}</span>
                    ) : null}
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
                  <TableCell className="text-right">{rowActions(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

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
                <TableHead>Header labels</TableHead>
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
                    {row.nameTa ? (
                      <span className="block text-[12px] text-muted-foreground">{row.nameTa}</span>
                    ) : null}
                    <span className="num block text-[11px] text-muted-foreground">{row.id}</span>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{row.app}</TableCell>
                  <TableCell>
                    <HeaderTags labels={row.headerLabels} />
                  </TableCell>
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
                  <TableCell className="text-right">{rowActions(row)}</TableCell>
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
              One primary app and parent/child. Leave parent blank for a top-level category.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <Label>App</Label>
              <Select
                value={formApp}
                onValueChange={(v) => {
                  const next = v as Sector;
                  setFormApp(next);
                  if (next === "FOOD") setFormMainHeader(false);
                }}
              >
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
              <Label>Header labels</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["MAIN_APP_HEADER", "MART", "FOOD", "PHARMA"] as CategoryHeader[]).map((h) => {
                  const isPrimary = h === formApp;
                  const isShared = h === "MAIN_APP_HEADER";
                  const active = isPrimary || (isShared && formMainHeader);
                  const disabled = isPrimary || (isShared && formApp === "FOOD");
                  return (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={active}
                      disabled={disabled}
                      onClick={() => isShared && setFormMainHeader((v) => !v)}
                      className={cn(
                        "focus-ringed rounded-md border px-2.5 py-1 text-[12px] transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        disabled && "cursor-default opacity-70 hover:border-border",
                      )}
                    >
                      {HEADER_LABEL[h]}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                The app label is always present. Main app header shares this category into the
                mobile main header (Mart and Pharma only).
              </p>
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
              <Label htmlFor="category-name-ta">Name (Tamil)</Label>
              <Input
                id="category-name-ta"
                lang="ta"
                value={formNameTa}
                onChange={(e) => setFormNameTa(e.target.value)}
                placeholder="தமிழில் மட்டும்"
              />
              {tamilFieldError(formNameTa, 120) ? (
                <p className="text-[11px] text-destructive">{tamilFieldError(formNameTa, 120)}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-description-ta">Description (Tamil)</Label>
              <Input
                id="category-description-ta"
                lang="ta"
                value={formDescriptionTa}
                onChange={(e) => setFormDescriptionTa(e.target.value)}
                placeholder="தமிழில் மட்டும்"
              />
              {tamilFieldError(formDescriptionTa, 2000) ? (
                <p className="text-[11px] text-destructive">
                  {tamilFieldError(formDescriptionTa, 2000)}
                </p>
              ) : null}
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
