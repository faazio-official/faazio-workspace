"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, RotateCcw, Tags, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { FilterChip } from "@/components/patterns/FilterChip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  listDeletedCategories,
  purgeCategory,
  restoreCategory,
  setCategoryActive,
  updateCategory,
} from "@/lib/api";
import { ApiError } from "@/lib/api/http";
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
import { AttributeManagerSheet } from "./attribute-manager";

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
  /** Mandatory Tamil name (0107) — every child is a customer-facing drill-in label. */
  nameTa: string;
  gstRateCategoryId: string;
}

let subRowSeq = 0;
function newSubRow(name = "", gstRateCategoryId = ""): SubRow {
  subRowSeq += 1;
  return { key: `sub-${subRowSeq}`, name, nameTa: "", gstRateCategoryId };
}

/** Required Tamil copy: blank is blocked here (tamilFieldError only checks script + length). */
function requiredTamilError(value: string, maxLength: number, label: string): string | null {
  if (!value.trim()) return `${label} is required.`;
  return tamilFieldError(value, maxLength, label);
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

  // Trash (0136): soft-deleted rows, restorable for 7 days. `showTrash` swaps the tree table for
  // the Deleted list; row selection there drives the bulk "delete forever".
  const [showTrash, setShowTrash] = useState(false);
  const [trashed, setTrashed] = useState<CategoryRow[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmPurge, setConfirmPurge] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  // Facet tags live on a leaf sub-category and are managed in their own sheet (Category Tree vs.
  // Facets split) so the category form itself stays about navigation + GST.
  const [tagging, setTagging] = useState<CategoryRow | null>(null);
  // Why the row is being deleted — kept with the trashed row for the next operator.
  const [deleteReason, setDeleteReason] = useState("");
  // Where a delete moves the listings that live in the deleted subtree. Mandatory as soon as the
  // subtree owns any listing, and always at the same tree level as the category being deleted.
  const [deleteTarget, setDeleteTarget] = useState("");

  const { items: gstRates, loading: gstLoading, error: gstError } = useGSTRateCategories();

  const [formApp, setFormApp] = useState<CategoryApp>("MART");
  const [formName, setFormName] = useState("");
  // Optional Tamil name (0107). Tamil letters only; blank = not translated.
  const [formNameTa, setFormNameTa] = useState("");
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
      app === "MAIN_APP_HEADER"
        ? // Main app header pools Mart + Pharma products, so its GST pick-list combines both sectors' active slabs.
          gstRates.filter((g) => g.isActive && (g.sector === "MART" || g.sector === "PHARMA"))
        : gstRates.filter((g) => g.isActive && g.sector === app),
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

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    setTrashError(null);
    try {
      const items = await listDeletedCategories(tab);
      setTrashed(items);
      // Drop selections whose row was purged or restored elsewhere.
      setSelected((prev) => {
        const live = new Set(items.map((r) => r.id));
        const next = new Set([...prev].filter((id) => live.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch (err) {
      setTrashError(err instanceof Error ? err.message : "Could not load deleted categories.");
    } finally {
      setTrashLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMain();
  }, [loadMain]);

  useEffect(() => {
    if (showTrash) void loadTrash();
  }, [showTrash, loadTrash]);

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
          nameTa: r.nameTa ?? "",
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
    if (nameTaError) {
      toast.error("Check the Tamil name", { description: nameTaError });
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
    const missingTaName = formSubs.find((s) => requiredTamilError(s.nameTa, 120, "Tamil name"));
    if (missingTaName) {
      toast.error("Every sub-category needs a Tamil name.", {
        description: requiredTamilError(missingTaName.nameTa, 120, "Tamil name") ?? undefined,
      });
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
      nameTa: s.nameTa.trim(),
      gstRateCategoryId: s.gstRateCategoryId,
      sortOrder: index,
      isActive: true,
    }));
    const input: CategoryInput = {
      app: formApp,
      name: formName.trim(),
      ...(formNameTa.trim() ? { nameTa: formNameTa.trim() } : {}),
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
    const impact = deleteImpact(deleting);
    if (impact.products > 0 && !deleteTarget) {
      toast.error("Pick a category to move the listings to");
      return;
    }
    setBusy(true);
    try {
      const result = await deleteCategory(
        deleting.id,
        deleteTarget || undefined,
        deleteReason.trim() || undefined,
      );
      toast.success(`Moved ${deleting.name} to Deleted`, {
        description:
          result.movedProducts > 0
            ? `${result.movedProducts} listing${result.movedProducts === 1 ? "" : "s"} moved to ${result.targetName ?? "the chosen category"}. Restorable for 7 days.`
            : "Restorable for 7 days, then removed permanently.",
      });
      setDeleting(null);
      setDeleteTarget("");
      setDeleteReason("");
      void load();
      void loadMain();
      if (showTrash) void loadTrash();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "move_required") {
        toast.error("Move the listings first", {
          description: "Pick another category to receive them, then delete.",
        });
      } else if (code === "invalid_move_target") {
        toast.error("That category can't receive them", {
          description: "Pick a live category at the same level in this app.",
        });
      } else {
        toast.error("Could not delete the category", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  /** Flip the plain Active/Inactive flag — a hide, never a delete. */
  async function toggleActive(row: CategoryRow) {
    const next = !row.isActive;
    try {
      const saved = await setCategoryActive(row.id, next);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...saved } : r)));
      setMainRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...saved } : r)));
      toast.success(next ? `${row.name} activated` : `${row.name} deactivated`);
    } catch (err) {
      toast.error("Could not update the category", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function restoreRow(row: CategoryRow) {
    try {
      await restoreCategory(row.id);
      setTrashed((prev) => prev.filter((r) => r.id !== row.id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      toast.success(`${row.name} restored`, {
        description: "It is deactivated — activate it when it should appear in the apps.",
      });
      void load();
      void loadMain();
    } catch (err) {
      if (err instanceof ApiError && err.code === "trash_expired") {
        setTrashed((prev) => prev.filter((r) => r.id !== row.id));
      }
      toast.error("Could not restore the category", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  /** Permanently delete every selected trashed subtree (bulk "delete forever"). */
  async function purgeSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => purgeCategory(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      const removed = ids.length - failed;
      setConfirmPurge(false);
      setSelected(new Set());
      void loadTrash();
      if (failed === 0) {
        toast.success(`Deleted ${removed} categor${removed === 1 ? "y" : "ies"} permanently`);
      } else {
        toast.error("Some categories could not be deleted", {
          description: `${removed} removed, ${failed} still referenced by a listing, store or menu — delete those references first.`,
        });
      }
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

  /** Every node under `rootId`, inclusive — the same subtree the gateway hides on delete. */
  const subtreeOf = useCallback(
    (rootId: string): CategoryRow[] => {
      const byParent = new Map<string, CategoryRow[]>();
      for (const r of rows) {
        if (!r.parentId) continue;
        const bucket = byParent.get(r.parentId);
        if (bucket) bucket.push(r);
        else byParent.set(r.parentId, [r]);
      }
      const out: CategoryRow[] = [];
      const walk = (id: string) => {
        const self = rows.find((r) => r.id === id);
        if (self) out.push(self);
        for (const child of byParent.get(id) ?? []) walk(child.id);
      };
      walk(rootId);
      return out;
    },
    [rows],
  );

  /**
   * How much a delete would touch. Listings are counted over the whole subtree because hiding a
   * parent hides its children too, so their listings must move with it.
   */
  const deleteImpact = useCallback(
    (row: CategoryRow) => {
      const sub = subtreeOf(row.id);
      const products = sub.reduce((sum, r) => sum + (r.productCount ?? 0), 0);
      return { products, categories: sub.length };
    },
    [subtreeOf],
  );

  /**
   * Valid move targets: live categories of the same app at the same tree level (top-level→top-level,
   * child→child), never the node being deleted or anything inside its subtree. Cross-level targets
   * are excluded here so the picker can't offer something the gateway would reject.
   */
  const moveTargets = useCallback(
    (row: CategoryRow): CategoryRow[] => {
      const excluded = new Set(subtreeOf(row.id).map((r) => r.id));
      const isTop = row.parentId === null;
      return rows
        .filter(
          (r) =>
            r.id !== row.id &&
            !excluded.has(r.id) &&
            r.isActive &&
            r.app === row.app &&
            (r.parentId === null) === isTop,
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [rows, subtreeOf],
  );

  function askDelete(row: CategoryRow) {
    setDeleting(row);
    setDeleteTarget("");
    setDeleteReason("");
  }

  function rowActions(row: CategoryRow) {
    return (
      <div className="flex justify-end gap-2">
        {row.parentId ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTagging(row)}>
            <Tags className="size-3.5" /> Tags
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
          <Pencil className="size-3.5" /> Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => askDelete(row)}
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
        description="The central category taxonomy. Every category has one primary pool — Mart, Food, Pharma, or the main app header (a header-only pool such as Electronics that drills into Android / iPhone). Each category and sub-category carries a mandatory GST rate. Sellers and apps pick from this list; deactivate hides a category in place, delete moves it to Deleted for 7 days so a mistake can be undone."
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
                    <Switch
                      checked={row.isActive}
                      onCheckedChange={() => void toggleActive(row)}
                      aria-label={`${row.isActive ? "Deactivate" : "Activate"} ${row.name}`}
                    />
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

      <SectionCard title={showTrash ? "Deleted categories" : "Category tree"} bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
          {TABS.map((t) => (
            <FilterChip
              key={t}
              label={TAB_LABEL[t]}
              active={tab === t}
              onClick={() => {
                setTab(t);
                setSelected(new Set());
              }}
            />
          ))}
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <FilterChip
            label="Deleted"
            active={showTrash}
            onClick={() => {
              setShowTrash((v) => !v);
              setSelected(new Set());
            }}
          />
          <span className="ml-auto text-[11px] text-muted-foreground">
            {showTrash
              ? "Deleted categories are restorable for 7 days, then removed permanently."
              : "Deleting a category moves it and its sub-categories to Deleted for 7 days."}
          </span>
        </div>

        {showTrash ? (
          <>
            {selected.size > 0 ? (
              <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <span className="text-[12px] text-muted-foreground">
                  {selected.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setConfirmPurge(true)}
                  >
                    <Trash2 className="size-3.5" /> Delete forever
                  </Button>
                </div>
              </div>
            ) : null}
            <DataShell
              loading={trashLoading}
              error={trashError ?? undefined}
              isEmpty={trashed.length === 0}
              empty={
                <EmptyState
                  title="Nothing deleted"
                  description="Deleted categories appear here for 7 days so a mistake can be undone."
                />
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Select all deleted categories"
                        checked={
                          trashed.length > 0 && trashed.every((r) => selected.has(r.id))
                            ? true
                            : trashed.some((r) => selected.has(r.id))
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(v) =>
                          setSelected(v ? new Set(trashed.map((r) => r.id)) : new Set())
                        }
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Deleted</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trashed.map((row) => (
                    <TableRow key={row.id} className="h-12">
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${row.name}`}
                          checked={selected.has(row.id)}
                          onCheckedChange={(v) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(row.id);
                              else next.delete(row.id);
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-[13px] font-medium">
                        {row.name}
                        <span className="num block text-[11px] text-muted-foreground">{row.id}</span>
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">{row.app}</TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">
                        {parentName(row.parentId)}
                      </TableCell>
                      <TableCell className="num text-[12px] text-muted-foreground">
                        <StatusPill status="DELETED" />
                        <span className="block">
                          {row.deletedAt ? formatDateTime(row.deletedAt) : "—"}
                        </span>
                        {row.purgeAt ? (
                          <span className="block text-[11px]">
                            purge {formatDateTime(row.purgeAt)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-[12px] text-muted-foreground">
                        {row.deleteReason || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => void restoreRow(row)}
                        >
                          <RotateCcw className="size-3.5" /> Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataShell>
          </>
        ) : (
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
                      <Switch
                        checked={row.isActive}
                        onCheckedChange={() => void toggleActive(row)}
                        aria-label={`${row.isActive ? "Deactivate" : "Activate"} ${row.name}`}
                      />
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
        )}
      </SectionCard>

      <Sheet
        open={sheetOpen}
        onOpenChange={(next) => {
          if (!next) closeSheet();
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.name}` : "New category"}</SheetTitle>
            <SheetDescription>
              One primary pool, one GST rate, and optional sub-categories (each with its own GST, plus a
              mandatory Tamil name). New categories are top-level — add children inline below.
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
                  {formApp === "MAIN_APP_HEADER" ? (
                    <p className="text-[11px] text-muted-foreground">
                      Main app header combines Mart + Pharma GST slabs.
                    </p>
                  ) : null}
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
                    Each one appears inside this category&apos;s drill-in. Name, Tamil name and GST
                    rate are all mandatory.
                    {formApp === "MAIN_APP_HEADER"
                      ? " Main app header combines Mart + Pharma GST slabs."
                      : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={addSub}>
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
              {formSubs.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No sub-categories yet.</p>
              ) : (
                <div className="space-y-3">
                  {formSubs.map((sub) => {
                    const nameTaError = tamilFieldError(sub.nameTa, 120);
                    return (
                      <div key={sub.key} className="space-y-2 rounded-lg border border-border p-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1 space-y-1.5">
                            <Label htmlFor={`${sub.key}-name`}>Name</Label>
                            <Input
                              id={`${sub.key}-name`}
                              value={sub.name}
                              onChange={(e) => updateSub(sub.key, { name: e.target.value })}
                              placeholder="Sub-category name (e.g. Android)"
                            />
                          </div>
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
                        <div className="space-y-1.5">
                          <Label htmlFor={`${sub.key}-name-ta`}>Name (Tamil)</Label>
                          <Input
                            id={`${sub.key}-name-ta`}
                            lang="ta"
                            value={sub.nameTa}
                            onChange={(e) => updateSub(sub.key, { nameTa: e.target.value })}
                            placeholder="தமிழில் மட்டும்"
                          />
                          {nameTaError ? (
                            <p className="text-[11px] text-destructive">{nameTaError}</p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={formApp === "FOOD" ? undefined : `${sub.key}-gst`}>
                            GST rate
                          </Label>
                          {formApp === "FOOD" ? (
                            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px]">
                              <span className="num font-medium">{FOOD_GST_PCT}%</span> (fixed)
                            </div>
                          ) : (
                            <Select
                              value={sub.gstRateCategoryId}
                              onValueChange={(v) => updateSub(sub.key, { gstRateCategoryId: v })}
                            >
                              <SelectTrigger id={`${sub.key}-gst`}>
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
                        </div>
                      </div>
                    );
                  })}
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

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(next) => {
          if (!next) {
            setDeleting(null);
            setDeleteTarget("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {deleting?.name} to Deleted?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  The category and everything under it
                  {deleteImpact(deleting).categories > 1
                    ? ` (${deleteImpact(deleting).categories} categories)`
                    : ""}{" "}
                  leave the apps immediately and sit in Deleted for 7 days, then are removed
                  permanently.
                  {deleteImpact(deleting).products > 0
                    ? ` ${deleteImpact(deleting).products} listing${deleteImpact(deleting).products === 1 ? "" : "s"} must move to another ${deleting.parentId === null ? "category" : "sub-category"} first.`
                    : " No listings are attached, so nothing needs to move."}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleting && deleteImpact(deleting).products > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="delete-move-target">
                Move {deleteImpact(deleting).products} listing
                {deleteImpact(deleting).products === 1 ? "" : "s"} to
              </Label>
              <select
                id="delete-move-target"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={deleteTarget}
                onChange={(e) => setDeleteTarget(e.target.value)}
              >
                <option value="">
                  {moveTargets(deleting).length === 0
                    ? `No other ${deleting.parentId === null ? "category" : "sub-category"} is available`
                    : `Select a ${deleting.parentId === null ? "category" : "sub-category"}`}
                </option>
                {moveTargets(deleting).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Only {deleting.parentId === null ? "top-level categories" : "sub-categories of the same parent level"} in {deleting.app} can receive them, so listings never change level.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="delete-reason">Reason (optional)</Label>
            <Input
              id="delete-reason"
              value={deleteReason}
              maxLength={500}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Why is this being deleted?"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || (deleting !== null && deleteImpact(deleting).products > 0 && !deleteTarget)}
              onClick={() => void confirmDelete()}
            >
              Move to Deleted
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmPurge} onOpenChange={setConfirmPurge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size} categor{selected.size === 1 ? "y" : "ies"} forever?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected categories and everything under them. A category
              still referenced by a listing, store or menu is kept and reported — it cannot be purged
              until those references are gone. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void purgeSelected()}>
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AttributeManagerSheet category={tagging} onClose={() => setTagging(null)} />
    </div>
  );
}

export default CategoriesPage;