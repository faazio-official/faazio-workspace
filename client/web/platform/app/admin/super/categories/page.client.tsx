"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  CATEGORY_APPS,
  createCategory,
  deleteCategory,
  listCategories,
  listCategoriesByHeader,
  updateCategory,
} from "@/lib/api";
import type {
  CategoryApp,
  CategoryHeader,
  CategoryInput,
  CategoryRow,
  GSTRateCategory,
  SubCategoryInput,
} from "@/lib/api";
import { useGSTRateCategories } from "@/lib/api/hooks";
import { tamilFieldError } from "@/lib/tamil";
import { cn } from "@/lib/utils";

const FOOD_GST_PCT = 5;

const TABS = ["ALL", ...CATEGORY_APPS] as const;
type Tab = (typeof TABS)[number];

const APP_LABEL: Record<CategoryApp, string> = {
  MART: "Mart",
  FOOD: "Food",
  PHARMA: "Pharma",
  MAIN_APP_HEADER: "Main app header",
};

const TAB_LABEL: Record<Tab, string> = { ALL: "All", ...APP_LABEL };

const HEADER_LABEL: Record<CategoryHeader, string> = {
  MAIN_APP_HEADER: "Main app header",
  MART: "Mart",
  FOOD: "Food",
  PHARMA: "Pharma",
};

function isCategoryApp(value: string): value is CategoryApp {
  return (CATEGORY_APPS as string[]).includes(value);
}

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

/** GST cell: the percentage plus the slab name, so a rate is never shown without its basis. */
function GstCell({ row }: { row: CategoryRow }) {
  if (row.gstRatePct === undefined) {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }
  return (
    <span className="text-[12px]">
      <span className="num font-medium">{row.gstRatePct}%</span>
      {row.gstRateCategoryName ? (
        <span className="block text-[11px] text-muted-foreground">{row.gstRateCategoryName}</span>
      ) : null}
    </span>
  );
}

/** One inline sub-category row being edited in the sheet. */
interface SubRow {
  /** Stable local key (not the server id). */
  key: string;
  id?: string;
  name: string;
  gstRateCategoryId: string;
}

let subRowSeq = 0;
function newSubRow(name = "", gstRateCategoryId = ""): SubRow {
  subRowSeq += 1;
  return { key: `sub-${subRowSeq}`, name, gstRateCategoryId };
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

  const { items: gstRates, loading: gstLoading, error: gstError } = useGSTRateCategories();

  const [formApp, setFormApp] = useState<CategoryApp>("MART");
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
  // Mandatory GST pick (0118). FOOD is pinned to 5% and the picker is disabled.
  const [formGstId, setFormGstId] = useState("");
  // Inline sub-categories, each with its own mandatory GST pick (Option B).
  const [formSubs, setFormSubs] = useState<SubRow[]>([]);

  const gstById = useMemo(() => {
    const map = new Map<string, GSTRateCategory>();
    for (const g of gstRates) map.set(g.id, g);
    return map;
  }, [gstRates]);

  const gstForApp = useCallback(
    (app: CategoryApp) =>
      gstRates.filter(
        (g) => g.isActive && (g.sector === app || (app === "MAIN_APP_HEADER" && g.sector === "MART")),
      ),
    [gstRates],
  );

  const foodSlab = useMemo(
    () => gstRates.find((g) => g.isActive && g.sector === "FOOD" && g.gstRatePct === FOOD_GST_PCT),
    [gstRates],
  );

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

  /** Keep the GST pick valid for the chosen app (a slab from another sector is never submittable). */
  const gstFor = useCallback(
    (app: CategoryApp, current: string) => {
      const options = gstForApp(app);
      if (options.some((g) => g.id === current)) return current;
      if (app === "FOOD") return foodSlab?.id ?? "";
      return options[0]?.id ?? "";
    },
    [gstForApp, foodSlab],
  );

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
    setFormGstId("");
    setFormSubs([]);
  }

  function openCreate() {
    resetForm();
    setCreating(true);
    setEditing(null);
  }

  function openEdit(row: CategoryRow) {
    const app: CategoryApp = isCategoryApp(row.app) ? row.app : "MART";
    setFormApp(app);
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
        row.app !== "MAIN_APP_HEADER" &&
        (row.headerLabels?.includes("MAIN_APP_HEADER") ?? row.showOnHomeRail),
    );
    setFormGstId(row.gstRateCategoryId ?? "");
    setFormSubs(
      rows
        .filter((r) => r.parentId === row.id)
        .map((r) => ({
          key: `edit-${r.id}`,
          id: r.id,
          name: r.name,
          gstRateCategoryId: r.gstRateCategoryId ?? "",
        })),
    );
    setEditing(row);
    setCreating(false);
  }

  function closeSheet() {
    setCreating(false);
    setEditing(null);
  }

  function changeApp(next: CategoryApp) {
    setFormApp(next);
    if (next === "FOOD") setFormMainHeader(false);
    if (next === "MAIN_APP_HEADER") setFormMainHeader(false);
    setFormGstId((current) => gstFor(next, current));
    // Every child follows the parent's pool so a header-only parent cannot carry a Mart child.
    setFormSubs((subs) => subs.map((s) => ({ ...s, gstRateCategoryId: gstFor(next, s.gstRateCategoryId) })));
  }

  function addSub() {
    setFormSubs((subs) => [...subs, newSubRow("", gstFor(formApp, ""))]);
  }

  function updateSub(key: string, patch: Partial<SubRow>) {
    setFormSubs((subs) => subs.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function removeSub(key: string) {
    setFormSubs((subs) => subs.filter((s) => s.key !== key));
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
    if (formApp !== "FOOD" && !formGstId) {
      toast.error("Pick a GST rate for this category.");
      return;
    }
    if (formSubs.some((s) => !s.name.trim())) {
      toast.error("Every sub-category needs a name.");
      return;
    }
    if (formApp !== "FOOD" && formSubs.some((s) => !s.gstRateCategoryId)) {
      toast.error("Every sub-category needs a GST rate.");
      return;
    }
    // The primary app label is always present; MAIN_APP_HEADER is the shared main app header list.
    // A header-only row is its own primary label, so it never carries an extra shared label.
    const headerLabels: CategoryHeader[] =
      formApp === "MAIN_APP_HEADER"
        ? ["MAIN_APP_HEADER"]
        : formMainHeader
          ? [formApp, "MAIN_APP_HEADER"]
          : [formApp];
    const subCategories: SubCategoryInput[] = formSubs.map((s, index) => ({
      ...(s.id ? { id: s.id } : {}),
      app: formApp,
      name: s.name.trim(),
      gstRateCategoryId: s.gstRateCategoryId,
      sortOrder: index,
      isActive: true,
    }));
    const input: CategoryInput = {
      app: formApp,
      name: formName.trim(),
      ...(formNameTa.trim() ? { nameTa: formNameTa.trim() } : {}),
      ...(formDescriptionTa.trim() ? { descriptionTa: formDescriptionTa.trim() } : {}),
      parentId: formParentId.trim() ? formParentId.trim() : null,
      sortOrder: Number.isFinite(Number(formSortOrder)) ? Number(formSortOrder) : 0,
      isActive: formActive,
      headerLabels,
      showOnHomeRail: formApp === "MAIN_APP_HEADER" || formMainHeader,
      ...(formApp !== "FOOD" ? { gstRateCategoryId: formGstId } : {}),
      subCategories,
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
        description="The central category taxonomy. Every category has one primary pool — Mart, Food, Pharma, or the main app header (a header-only pool such as Electronics that drills into Android / iPhone). Each category and sub-category carries a mandatory GST rate. Sellers and apps pick from this list; delete hides a category without breaking existing references."
        actions={
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus className="size-4" /> New category
          </Button>
        }
      />

      {gstError ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
          GST rates could not be loaded ({gstError}). Saving a category will be blocked until they load.
        </p>
      ) : null}

      <SectionCard title="Main app header" bodyClassName="p-0">
        <p className="border-b border-border px-3 py-2 text-[12px] text-muted-foreground">
          Top-level main app header chips, including header-only categories (app = Main app header)
          and Mart / Pharma categories shared into the header. Food is not eligible. Each chip opens
          its own sub-category drill-in.
        </p>
        <DataShell
          loading={mainLoading}
          error={mainError ?? undefined}
          isEmpty={mainRows.length === 0}
          empty={
            <EmptyState
              title="Nothing in the main header yet"
              description="Create a Main app header category, or share a Mart / Pharma category into the header."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>App</TableHead>
                <TableHead>GST</TableHead>
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
                  <TableCell>
                    <GstCell row={row} />
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
              description="Create a top-level category, then add its sub-categories."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>App</TableHead>
                <TableHead>GST</TableHead>
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
                    <GstCell row={row} />
                  </TableCell>
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
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.name}` : "New category"}</SheetTitle>
            <SheetDescription>
              One primary pool, one GST rate, and optional sub-categories (each with its own GST).
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <Label>App</Label>
              <Select value={formApp} onValueChange={(v) => changeApp(v as CategoryApp)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_APPS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {APP_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Main app header is its own pool — a header-only category appears in the app header and
                drills into the sub-categories below.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Header labels</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["MAIN_APP_HEADER", "MART", "FOOD", "PHARMA"] as CategoryHeader[]).map((h) => {
                  const isPrimary = h === formApp;
                  const isShared = h === "MAIN_APP_HEADER";
                  const active =
                    isPrimary ||
                    (isShared && formMainHeader) ||
                    (formApp === "MAIN_APP_HEADER" && isShared);
                  const disabled =
                    isPrimary ||
                    !isShared ||
                    formApp === "FOOD" ||
                    formApp === "MAIN_APP_HEADER";
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
                The app label is always present. Main app header shares a Mart or Pharma category into
                the mobile header; a header-only category is in the header by definition.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>GST rate</Label>
              {formApp === "FOOD" ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px]">
                  <span className="num font-medium">{FOOD_GST_PCT}%</span> — every food category is
                  5% (fixed).
                </div>
              ) : (
                <>
                  <Select
                    value={formGstId}
                    onValueChange={setFormGstId}
                    disabled={gstLoading || gstRates.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={gstLoading ? "Loading GST rates…" : "Pick a GST rate"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {gstForApp(formApp).map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name} — {g.gstRatePct}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="num text-[11px] text-muted-foreground">
                    {formGstId && gstById.get(formGstId)
                      ? `GST ${gstById.get(formGstId)?.gstRatePct}%`
                      : "Mandatory — pick the slab that applies."}
                  </p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Electronics"
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
                placeholder="blank = top level (e.g. cat_electronics)"
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

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Sub-categories</p>
                  <p className="text-[11px] text-muted-foreground">
                    Each one appears inside this category&apos;s drill-in and needs its own GST rate.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={addSub}>
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
              {formSubs.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No sub-categories yet.</p>
              ) : (
                <div className="space-y-2">
                  {formSubs.map((sub) => (
                    <div key={sub.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Input
                        value={sub.name}
                        onChange={(e) => updateSub(sub.key, { name: e.target.value })}
                        placeholder="Sub-category name (e.g. Android)"
                        aria-label="Sub-category name"
                      />
                      {formApp === "FOOD" ? (
                        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px]">
                          <span className="num font-medium">{FOOD_GST_PCT}%</span> (fixed)
                        </div>
                      ) : (
                        <Select
                          value={sub.gstRateCategoryId}
                          onValueChange={(v) => updateSub(sub.key, { gstRateCategoryId: v })}
                        >
                          <SelectTrigger aria-label="Sub-category GST rate">
                            <SelectValue placeholder="GST rate" />
                          </SelectTrigger>
                          <SelectContent>
                            {gstForApp(formApp).map((g) => (
                              <SelectItem key={g.id} value={g.id}>
                                {g.name} — {g.gstRatePct}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => removeSub(sub.key)}
                        aria-label={`Remove ${sub.name || "sub-category"}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
