"use client";
// Seller menu builder. A restaurant owner builds a dish under a leaf sub-category of the superadmin
// taxonomy (a parent category is a section header, never selectable), uploads a photo instead of
// pasting a URL, and chooses an explicit Publish vs Save-as-Draft intent. The venue and dish ids are
// never typed: the shop comes from the active scope and the gateway derives the dish id.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { HubHeader } from "@/components/sellers/shells";
import {
  EmptyState,
  PageHeader,
  PillTabs,
  Sheet,
  TextField,
  Toggle,
  VegMark,
} from "@/components/sellers/kit";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { resolveImage } from "@/lib/media/productImages";
import { tamilFieldError } from "@/lib/tamil";
import {
  approveAddon,
  createAddon,
  delistAddon,
  deleteMenu,
  linkAddonToDish,
  listAddons,
  listMenuAddons,
  setMenuStatus,
  unlinkAddonFromDish,
  upsertMenu,
  type CategoryRow,
  type MenuAttributeGroup,
  type MenuDto,
} from "@/lib/api";
import {
  useCategoryTree,
  useMenus,
  usePortalLoading,
  useSellerScope,
  useSubcategoryAttributes,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import type { AddonRecord, MenuAddonRecord, MenuItemRecord, ProductStatus } from "@/data/types";

const STATUSES: (ProductStatus | "ALL")[] = ["ALL", "DRAFT", "PENDING_REVIEW", "ACTIVE", "DELISTED"];

const STATUS_PILL: Record<ProductStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-warning-soft text-warning",
  ACTIVE: "bg-success-soft text-success",
  CHANGES_REQUESTED: "bg-warning-soft text-warning",
  REJECTED: "bg-brand-soft text-brand",
  DELISTED: "bg-muted text-muted-foreground",
};

const DIETARY: { value: "VEG" | "NON_VEG" | "EGG"; label: string }[] = [
  { value: "VEG", label: "Veg" },
  { value: "NON_VEG", label: "Non-veg" },
  { value: "EGG", label: "Egg" },
];

const CUISINE_SUGGESTIONS = [
  "South Indian",
  "North Indian",
  "Chettinad",
  "Biryani",
  "Chinese",
  "Tandoori",
  "Continental",
  "Desserts",
  "Beverages",
];

interface FormState {
  name: string;
  description: string;
  sectionId: string;
  subCategoryId: string;
  cuisine: string;
  dietaryType: "VEG" | "NON_VEG" | "EGG";
  price: string;
  mrp: string;
  nameTa: string;
  descriptionTa: string;
  imageKey: string;
  imagePreview: string;
  imageFile: File | null;
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    sectionId: "",
    subCategoryId: "",
    cuisine: "",
    dietaryType: "VEG",
    price: "",
    mrp: "",
    nameTa: "",
    descriptionTa: "",
    imageKey: "",
    imagePreview: "",
    imageFile: null,
  };
}

function toForm(m: MenuItemRecord): FormState {
  return {
    name: m.name,
    description: m.description ?? "",
    sectionId: m.sectionId ?? "",
    subCategoryId: m.subCategoryId ?? "",
    cuisine: m.cuisine ?? "",
    dietaryType: m.dietaryType ?? (m.isVeg === false ? "NON_VEG" : "VEG"),
    price: String(m.pricePaisa / 100),
    mrp: m.mrpPaisa != null ? String(m.mrpPaisa / 100) : "",
    nameTa: m.nameTa ?? "",
    descriptionTa: m.descriptionTa ?? "",
    imageKey: m.imageKey ?? "",
    imagePreview: m.imageKey ? (resolveImage(m.imageKey) ?? "") : "",
    imageFile: null,
  };
}

/** Section headers (parent categories) and their leaf sub-categories, from the FOOD taxonomy tree. */
function useFoodTaxonomy() {
  const rows = useCategoryTree("FOOD");
  return useMemo(() => {
    const sections = rows.filter((r) => !r.parentId && r.isActive);
    const bySection = new Map<string, CategoryRow[]>();
    for (const section of sections) {
      bySection.set(
        section.id,
        rows.filter((r) => r.parentId === section.id && r.isActive),
      );
    }
    return { sections, bySection };
  }, [rows]);
}

/**
 * Lightweight auto-tagger: match the dish name against each option's label + keywords, scoped to the
 * chosen sub-category's groups. This is the "auto-detected — tap to adjust" 80% time-saver; every
 * match stays editable and nothing blocks saving.
 */
function detectAttributeOptions(name: string, groups: MenuAttributeGroup[]): string[] {
  const hay = name.toLowerCase();
  if (hay.trim().length < 3) return [];
  const out: string[] = [];
  const pickedGroups = new Set<string>();
  for (const group of groups) {
    for (const option of group.options) {
      const needles = [option.label, ...(option.keywords ?? [])]
        .map((s) => s.toLowerCase().trim())
        .filter((s) => s.length >= 3);
      if (!needles.some((n) => hay.includes(n))) continue;
      if (group.inputType === "single_select" && pickedGroups.has(group.id)) continue;
      out.push(option.id);
      if (group.inputType === "single_select") pickedGroups.add(group.id);
    }
  }
  return out;
}

/** One facet group rendered as multi/single-select pill chips with an optional in-list search. */
function AttributeGroupPicker({
  group,
  selected,
  suggested,
  onToggle,
}: {
  group: MenuAttributeGroup;
  selected: string[];
  suggested: Set<string>;
  onToggle: (group: MenuAttributeGroup, optionId: string) => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const options = needle
    ? group.options.filter((o) => o.label.toLowerCase().includes(needle))
    : group.options;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-semibold">{group.displayName}</p>
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {group.inputType === "single_select" ? "Pick one" : "Any"} · optional
        </span>
      </div>
      {group.options.length > 8 ? (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${group.displayName.toLowerCase()}…`}
          className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] outline-none focus:border-info"
        />
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(group, o.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:border-foreground/40",
              )}
            >
              {o.iconUrl ? (
                <img src={o.iconUrl} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
              ) : null}
              {o.label}
              {suggested.has(o.id) && on ? (
                <span aria-hidden className="text-[8px] font-bold text-current/70">
                  auto
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SellerMenus() {
  const { sellerId, storeId, activeStore } = useSellerScope();
  const isFood = activeStore?.sector === "FOOD";
  const loading = usePortalLoading();
  const { sections, bySection } = useFoodTaxonomy();

  const [tab, setTab] = useState<"dishes" | "addons">("dishes");
  const [status, setStatus] = useState<ProductStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItemRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [tamilOpen, setTamilOpen] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [addons, setAddons] = useState<AddonRecord[]>([]);
  const [links, setLinks] = useState<MenuAddonRecord[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [newAddon, setNewAddon] = useState({ name: "", group: "Extras", price: "", isVeg: true });
  const [creatingAddon, setCreatingAddon] = useState(false);

  const menus = useMenus({ sellerId, venueId: storeId || undefined, status }).filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.subCategoryName ?? "").toLowerCase().includes(q) ||
      (m.sectionName ?? "").toLowerCase().includes(q)
    );
  });

  const refreshAddons = useCallback(async () => {
    if (!storeId) {
      setAddons([]);
      setLinks([]);
      return;
    }
    setAddonsLoading(true);
    try {
      const [nextAddons, nextLinks] = await Promise.all([
        listAddons({ venueId: storeId }),
        listMenuAddons(storeId),
      ]);
      setAddons(nextAddons);
      setLinks(nextLinks);
    } catch {
      setAddons([]);
      setLinks([]);
    } finally {
      setAddonsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void refreshAddons();
  }, [refreshAddons]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setSelectedAddons([]);
    setTamilOpen(false);
    setAddonsOpen(false);
    setOpen(true);
  }

  function openEdit(m: MenuItemRecord) {
    setEditing(m);
    setForm(toForm(m));
    setSelectedAddons(
      links.filter((l) => l.venueId === m.venueId && l.dishId === m.dishId).map((l) => l.addonId),
    );
    setTamilOpen(Boolean(m.nameTa || m.descriptionTa));
    setAddonsOpen(false);
    setOpen(true);
  }

  async function ingestPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file (JPG, PNG or WebP).");
      return;
    }
    setUploading(true);
    try {
      // Preview immediately from the local blob; the real upload happens on save so an abandoned
      // form never leaves an orphaned asset behind.
      setForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
    } finally {
      setUploading(false);
    }
  }

  async function save(intent: "ACTIVE" | "DRAFT") {
    if (!isFood) return;
    if (!storeId) {
      toast.error("Pick a shop before adding a dish.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Dish name is required.");
      return;
    }
    if (!form.subCategoryId) {
      toast.error("Pick a sub-category — a parent category is a section header, not a dish target.");
      return;
    }
    const pricePaisa = parseRupeesToPaisa(form.price);
    if (!form.price.trim() || pricePaisa < 0) {
      toast.error("Enter a price of ₹0 or more.");
      return;
    }
    const mrpRaw = form.mrp.trim();
    const mrpPaisa = mrpRaw === "" ? undefined : parseRupeesToPaisa(mrpRaw);
    if (mrpPaisa != null && mrpPaisa < pricePaisa) {
      toast.error("MRP must be greater than or equal to the selling price.");
      return;
    }
    const nameTaError = tamilFieldError(form.nameTa, 200, "Tamil dish name");
    if (nameTaError) {
      toast.error(nameTaError);
      return;
    }
    const descTaError = tamilFieldError(form.descriptionTa, 2000, "Tamil description");
    if (descTaError) {
      toast.error(descTaError);
      return;
    }

    const dto: MenuDto = {
      venueId: storeId,
      ...(editing ? { dishId: editing.dishId } : {}),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      sectionId: form.sectionId || undefined,
      subCategoryId: form.subCategoryId,
      dietaryType: form.dietaryType,
      price: pricePaisa / 100,
      mrp: mrpPaisa != null ? mrpPaisa / 100 : undefined,
      isVeg: form.dietaryType === "VEG",
      cuisine: form.cuisine.trim() || undefined,
      ...(form.nameTa.trim() ? { nameTa: form.nameTa.trim() } : {}),
      ...(form.descriptionTa.trim() ? { descriptionTa: form.descriptionTa.trim() } : {}),
      ...(form.imageKey ? { imageKey: form.imageKey } : {}),
      ...(form.imageFile ? { imageFile: form.imageFile } : {}),
      sellerId,
    };

    setBusy(true);
    try {
      const saved = await upsertMenu(dto);
      // The gateway creates every dish as DRAFT; an explicit Publish follows immediately.
      if (intent === "ACTIVE" && saved.status !== "ACTIVE") {
        await setMenuStatus(storeId, saved.dishId, "ACTIVE");
      }
      // Persist the drawer's add-on checklist (only meaningful once the dish has an id).
      if (saved.dishId) {
        const before = links
          .filter((l) => l.venueId === storeId && l.dishId === saved.dishId)
          .map((l) => l.addonId);
        const toLink = selectedAddons.filter((id) => !before.includes(id));
        const toUnlink = before.filter((id) => !selectedAddons.includes(id));
        await Promise.all([
          ...toLink.map((id) => linkAddonToDish(storeId, saved.dishId, id)),
          ...toUnlink.map((id) => unlinkAddonFromDish(storeId, saved.dishId, id)),
        ]);
        if (toLink.length || toUnlink.length) await refreshAddons();
      }
      toast.success(
        editing
          ? `${saved.name} updated`
          : intent === "ACTIVE"
            ? `${saved.name} published`
            : `${saved.name} saved as draft`,
      );
      setOpen(false);
    } catch (err) {
      toast.error("Could not save the dish", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function createNewAddon() {
    if (!storeId) return;
    const pricePaisa = parseRupeesToPaisa(newAddon.price);
    if (!newAddon.name.trim() || pricePaisa <= 0) {
      toast.error("Give the add-on a name and a price above ₹0.");
      return;
    }
    setCreatingAddon(true);
    try {
      const created = await createAddon({
        venueId: storeId,
        name: newAddon.name.trim(),
        groupName: newAddon.group.trim() || "Extras",
        pricePaisa,
        isVeg: newAddon.isVeg,
      });
      // Align with dish publishing: a freshly created add-on goes live immediately for the owner.
      try {
        await approveAddon(created.addonId);
      } catch {
        /* the add-on stays DRAFT; the owner can publish it from the Add-ons tab */
      }
      setNewAddon({ name: "", group: newAddon.group, price: "", isVeg: true });
      setSelectedAddons((prev) => [...prev, created.addonId]);
      await refreshAddons();
      toast.success(`${created.name} created`);
    } catch {
      toast.error("Could not create the add-on");
    } finally {
      setCreatingAddon(false);
    }
  }

  async function toggleAvailability(m: MenuItemRecord, next: boolean) {
    try {
      await setMenuStatus(m.venueId, m.dishId, next ? "ACTIVE" : "DELISTED");
      toast.success(next ? `${m.name} is available` : `${m.name} marked unavailable today`);
    } catch {
      toast.error("Could not change availability");
    }
  }

  async function toggleAddonLive(a: AddonRecord, next: boolean) {
    try {
      if (next) await approveAddon(a.addonId);
      else await delistAddon(a.addonId);
      await refreshAddons();
    } catch {
      toast.error("Could not change the add-on");
    }
  }

  async function removeDish(m: MenuItemRecord) {
    try {
      await deleteMenu(m.venueId, m.dishId);
      toast.success(`${m.name} removed`);
      setOpen(false);
    } catch {
      toast.error("Could not remove the dish");
    }
  }

  const subCategoriesFor = (sectionId: string) => bySection.get(sectionId) ?? [];
  const discountPct = (() => {
    const p = parseRupeesToPaisa(form.price);
    const m = form.mrp.trim() ? parseRupeesToPaisa(form.mrp) : 0;
    if (!m || m <= p) return 0;
    return Math.round(((m - p) / m) * 100);
  })();

  // Group the (filtered) dishes by section → sub-category, the way the customer app shows them.
  const grouped = useMemo(() => {
    const out = new Map<string, { label: string; subs: Map<string, { label: string; items: MenuItemRecord[] }> }>();
    for (const m of menus) {
      const sectionKey = m.sectionId ?? m.sectionName ?? "uncategorised";
      const sectionLabel = m.sectionName || sections.find((s) => s.id === m.sectionId)?.name || "Uncategorised";
      const subKey = m.subCategoryId ?? m.subCategoryName ?? "uncategorised";
      const subLabel =
        m.subCategoryName ||
        [...bySection.values()].flat().find((c) => c.id === m.subCategoryId)?.name ||
        "Uncategorised";
      if (!out.has(sectionKey)) out.set(sectionKey, { label: sectionLabel, subs: new Map() });
      const section = out.get(sectionKey)!;
      if (!section.subs.has(subKey)) section.subs.set(subKey, { label: subLabel, items: [] });
      section.subs.get(subKey)!.items.push(m);
    }
    return [...out.values()];
  }, [menus, sections, bySection]);

  const addonGroups = useMemo(() => {
    const out = new Map<string, AddonRecord[]>();
    for (const a of addons) {
      const key = a.groupName?.trim() || "Extras";
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(a);
    }
    return [...out.entries()];
  }, [addons]);

  if (activeStore && !isFood) {
    return (
      <>
        <PageHeader title="Menu" sub="Catalog" />
        <div className="space-y-3 px-4 pt-3 pb-8">
          <EmptyState
            icon={<BookOpen className="h-12 w-12" strokeWidth={1.2} />}
            text="Menus are only available for Food shops. Mart and Pharmacy shops manage listings from Products and Inventory."
          />
          <div className="flex gap-2">
            <Link
              href="/seller/products"
              className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-center text-xs font-semibold text-background"
            >
              Products
            </Link>
            <Link
              href="/seller/stores"
              className="flex-1 rounded-xl bg-info-soft px-4 py-2.5 text-center text-xs font-semibold text-info"
            >
              Your stores
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HubHeader
        actions={
          <button
            onClick={tab === "dishes" ? openCreate : () => setTab("addons")}
            className="flex items-center gap-1 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background"
          >
            <Plus className="h-3.5 w-3.5" />
            {tab === "dishes" ? "Add dish" : "Add-ons"}
          </button>
        }
      />

      <div className="space-y-3 px-4 pt-3 pb-6">
        <PillTabs
          tabs={[
            { key: "dishes", label: "Dishes", count: menus.length },
            { key: "addons", label: "Add-ons & Customizations", count: addons.length },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === "dishes" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search dish, section or sub-category"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
              <button
                aria-label="Filters"
                onClick={() => setFiltersOpen(true)}
                className={cn(
                  "rounded-xl border p-2",
                  status !== "ALL"
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card",
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>

            {loading && menus.length === 0 ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : menus.length === 0 ? (
              <EmptyState text="No dishes yet — add a dish under a sub-category, or change the status filter" />
            ) : (
              <div className="space-y-4">
                {grouped.map((section) => (
                  <section key={section.label} className="space-y-2">
                    <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {section.label}
                    </p>
                    {[...section.subs.entries()].map(([subKey, sub]) => (
                      <div key={subKey} className="space-y-2">
                        <p className="px-1 text-xs font-semibold text-muted-foreground">{sub.label}</p>
                        {sub.items.map((m) => (
                          <div
                            key={`${m.venueId}:${m.dishId}`}
                            className="rounded-2xl border border-border bg-card p-3 shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              {m.imageKey && resolveImage(m.imageKey) ? (
                                <img
                                  src={resolveImage(m.imageKey) ?? ""}
                                  alt=""
                                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                                />
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <VegMark veg={m.dietaryType === "VEG" || (m.dietaryType == null && m.isVeg !== false)} />
                                  <p className="truncate text-sm font-semibold">{m.name}</p>
                                </div>
                                {m.nameTa ? (
                                  <p lang="ta" className="truncate text-[11px] text-muted-foreground">
                                    {m.nameTa}
                                  </p>
                                ) : null}
                                <div className="mt-1 flex items-center gap-2 text-xs">
                                  <b>{formatINR(m.pricePaisa)}</b>
                                  {m.mrpPaisa != null && m.mrpPaisa > m.pricePaisa ? (
                                    <span className="text-[10px] text-muted-foreground line-through">
                                      {formatINR(m.mrpPaisa)}
                                    </span>
                                  ) : null}
                                  <span
                                    className={cn(
                                      "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                                      STATUS_PILL[m.status],
                                    )}
                                  >
                                    {m.status.replace(/_/g, " ")}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
                              <div className="flex items-center gap-2">
                                <Toggle
                                  label={`${m.name} available`}
                                  checked={m.status === "ACTIVE"}
                                  onChange={(v) => void toggleAvailability(m, v)}
                                />
                                <span className="text-[11px] text-muted-foreground">
                                  {m.status === "ACTIVE" ? "Available" : "Unavailable today"}
                                </span>
                              </div>
                              <button
                                onClick={() => openEdit(m)}
                                className="text-xs font-semibold text-info"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Add-ons</p>
                <p className="text-[11px] text-muted-foreground">
                  Extras customers add to a dish. Create one here or inside a dish drawer.
                </p>
              </div>
            </div>
            {addonsLoading && addons.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-muted-foreground">Loading add-ons…</p>
            ) : addons.length === 0 ? (
              <EmptyState text="No add-ons yet — create one to offer extras like extra cheese or a drink" />
            ) : (
              addonGroups.map(([group, rows]) => (
                <section key={group} className="rounded-xl border border-border">
                  <p className="border-b border-border px-3 py-2 text-xs font-bold">{group}</p>
                  {rows.map((a) => (
                    <div
                      key={a.addonId}
                      className="flex items-center gap-2 border-b border-border px-3 py-2.5 last:border-0"
                    >
                      <VegMark veg={a.isVeg} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatINR(a.pricePaisa)} ·{" "}
                          <span className={cn("rounded px-1 py-0.5 text-[9px] font-bold uppercase", STATUS_PILL[a.status])}>
                            {a.status.replace(/_/g, " ")}
                          </span>
                        </p>
                      </div>
                      <Toggle
                        label={`${a.name} available`}
                        checked={a.status === "ACTIVE"}
                        onChange={(v) => void toggleAddonLive(a, v)}
                      />
                    </div>
                  ))}
                </section>
              ))
            )}
          </div>
        )}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit dish" : "Add dish"}
        footer={
          <div className="flex items-center gap-2">
            {editing && (
              <button
                aria-label="Delete dish"
                onClick={() => void removeDish(editing)}
                className="rounded-xl border border-border bg-card p-3 text-brand"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => void save("DRAFT")}
              className="flex-1 rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              disabled={busy}
              onClick={() => void save("ACTIVE")}
              className="flex-[1.4] rounded-xl bg-foreground px-3 py-3 text-sm font-semibold text-background disabled:opacity-50"
            >
              {busy ? "Saving…" : "Publish Dish"}
            </button>
          </div>
        }
      >
        <div className="pb-2">
          {/* Photo dropzone */}
          <div className="py-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Dish photo</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void ingestPhoto(e.dataTransfer.files);
                }}
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border text-muted-foreground hover:border-info hover:text-info"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : form.imagePreview ? (
                  <img src={form.imagePreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
              </button>
              <div className="text-[11px] text-muted-foreground">
                <p>Drop a photo or tap to choose.</p>
                <p>JPG, PNG or WebP. Uploaded when you save.</p>
                {form.imagePreview ? (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, imageFile: null, imagePreview: "", imageKey: "" }))
                    }
                    className="mt-1 font-semibold text-brand"
                  >
                    Remove photo
                  </button>
                ) : null}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void ingestPhoto(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <TextField
            label="Dish name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Mutton Biryani"
          />

          <TextField
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Slow-cooked mutton with seeraga samba rice"
          />

          {/* Section → sub-category (leaf only) */}
          <label className="block py-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Menu section</span>
            <select
              value={form.sectionId}
              onChange={(e) =>
                setForm({ ...form, sectionId: e.target.value, subCategoryId: "" })
              }
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-info"
            >
              <option value="">Select a section…</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-muted-foreground">
              A section is a header only — the dish is placed in a sub-category below it.
            </span>
          </label>

          <label className="block py-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Sub-category</span>
            <select
              value={form.subCategoryId}
              disabled={!form.sectionId}
              onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-info disabled:opacity-50"
            >
              <option value="">{form.sectionId ? "Select a sub-category…" : "Pick a section first"}</option>
              {subCategoriesFor(form.sectionId).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {form.sectionId && subCategoriesFor(form.sectionId).length === 0 ? (
              <span className="mt-1 block text-[10px] text-brand">
                This section has no sub-categories yet — ask the superadmin to add one.
              </span>
            ) : null}
          </label>

          {/* Cuisine (searchable suggestions) */}
          <label className="block py-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Cuisine</span>
            <input
              list="menu-cuisine-options"
              value={form.cuisine}
              onChange={(e) => setForm({ ...form, cuisine: e.target.value })}
              placeholder="e.g. Chettinad"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[16px] outline-none focus:border-info md:text-sm"
            />
            <datalist id="menu-cuisine-options">
              {CUISINE_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          {/* Dietary type */}
          <div className="py-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Dietary type</span>
            <div className="flex gap-2">
              {DIETARY.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setForm({ ...form, dietaryType: d.value })}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                    form.dietaryType === d.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <TextField
                label="Price (₹)"
                type="number"
                value={form.price}
                onChange={(v) => setForm({ ...form, price: v })}
                placeholder="240"
              />
            </div>
            <div className="flex-1">
              <TextField
                label="MRP (₹, optional)"
                type="number"
                value={form.mrp}
                onChange={(v) => setForm({ ...form, mrp: v })}
                placeholder="No offer"
              />
            </div>
          </div>
          {discountPct > 0 ? (
            <p className="text-[11px] font-semibold text-success">{discountPct}% off shown to customers</p>
          ) : null}

          {/* Tamil copy — collapsible, relaxed validation */}
          <button
            type="button"
            onClick={() => setTamilOpen((v) => !v)}
            className="mt-2 flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left"
          >
            <span className="text-sm font-medium">Tamil translation (optional)</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", tamilOpen && "rotate-180")} />
          </button>
          {tamilOpen ? (
            <div className="pt-1">
              <TextField
                label="Tamil name"
                value={form.nameTa}
                lang="ta"
                placeholder="தமிழில் பெயர்"
                onChange={(v) => setForm({ ...form, nameTa: v })}
              />
              <TextField
                label="Tamil description"
                value={form.descriptionTa}
                lang="ta"
                placeholder="தமிழில் விவரம்"
                onChange={(v) => setForm({ ...form, descriptionTa: v })}
              />
              <p className="text-[10px] text-muted-foreground">
                Tamil letters, digits and light punctuation. Leave blank to show the English copy.
              </p>
            </div>
          ) : null}

          {/* Inline add-ons */}
          <button
            type="button"
            onClick={() => setAddonsOpen((v) => !v)}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left"
          >
            <span className="text-sm font-medium">
              Add-ons (optional){selectedAddons.length ? ` · ${selectedAddons.length} selected` : ""}
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", addonsOpen && "rotate-180")} />
          </button>
          {addonsOpen ? (
            <div className="space-y-2 pt-2">
              {addons.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No add-ons yet — create one below.
                </p>
              ) : (
                addonGroups.map(([group, rows]) => (
                  <div key={group}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </p>
                    {rows.map((a) => {
                      const checked = selectedAddons.includes(a.addonId);
                      return (
                        <button
                          key={a.addonId}
                          type="button"
                          onClick={() =>
                            setSelectedAddons((prev) =>
                              checked ? prev.filter((x) => x !== a.addonId) : [...prev, a.addonId],
                            )
                          }
                          className="flex w-full items-center gap-2 border-b border-border py-2 text-left last:border-0"
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                              checked ? "border-foreground bg-foreground text-background" : "border-border",
                            )}
                          >
                            {checked ? "✓" : ""}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs">{a.name}</span>
                          <span className="text-[10px] text-muted-foreground">{formatINR(a.pricePaisa)}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}

              <div className="rounded-xl border border-border p-2.5">
                <p className="mb-1 text-[11px] font-semibold">Create a new add-on</p>
                <div className="flex gap-2">
                  <input
                    value={newAddon.name}
                    onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                    placeholder="Extra Cheese"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none focus:border-info"
                  />
                  <input
                    value={newAddon.price}
                    onChange={(e) => setNewAddon({ ...newAddon, price: e.target.value })}
                    placeholder="₹"
                    type="number"
                    className="w-16 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none focus:border-info"
                  />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={newAddon.group}
                    onChange={(e) => setNewAddon({ ...newAddon, group: e.target.value })}
                    placeholder="Group (Extras)"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs outline-none focus:border-info"
                  />
                  <button
                    type="button"
                    disabled={creatingAddon}
                    onClick={() => void createNewAddon()}
                    className="rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background disabled:opacity-50"
                  >
                    {creatingAddon ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Sheet>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Status">
        {STATUSES.map((option) => (
          <button
            key={option}
            onClick={() => {
              setStatus(option);
              setFiltersOpen(false);
            }}
            className="flex w-full items-center justify-between border-b border-border py-3 text-left text-sm last:border-0"
          >
            {option.replace(/_/g, " ")}
            {status === option && <X className="h-4 w-4" />}
          </button>
        ))}
      </Sheet>
    </>
  );
}

export default SellerMenus;
