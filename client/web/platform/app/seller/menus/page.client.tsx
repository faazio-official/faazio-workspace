"use client";
import { useState } from "react";
import { Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { HubHeader } from "@/components/sellers/shells";
import { Sheet, TextField, Toggle, VegMark, EmptyState } from "@/components/sellers/kit";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { deleteMenu, setMenuStatus, upsertMenu, type MenuDto } from "@/lib/api";
import { useMenus, useMockLoading, useSellerScope } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import type { MenuItemRecord, ProductStatus } from "@/data/types";

const STATUSES: (ProductStatus | "ALL")[] = ["ALL", "DRAFT", "PENDING_REVIEW", "ACTIVE", "DELISTED"];

const STATUS_PILL: Record<ProductStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-warning-soft text-warning",
  ACTIVE: "bg-success-soft text-success",
  REJECTED: "bg-brand-soft text-brand",
  DELISTED: "bg-muted text-muted-foreground",
};

interface FormState {
  venueId: string;
  dishId: string;
  name: string;
  price: string;
  mrp: string;
  isVeg: boolean;
  cuisine: string;
  image: string;
}

function emptyForm(): FormState {
  return {
    venueId: "",
    dishId: "",
    name: "",
    price: "",
    mrp: "",
    isVeg: true,
    cuisine: "",
    image: "",
  };
}

function toForm(m: MenuItemRecord): FormState {
  return {
    venueId: m.venueId,
    dishId: m.dishId,
    name: m.name,
    price: String(m.pricePaisa / 100),
    mrp: m.mrpPaisa != null ? String(m.mrpPaisa / 100) : "",
    isVeg: m.isVeg ?? true,
    cuisine: m.cuisine ?? "",
    image: m.image ?? "",
  };
}

function SellerMenus() {
  const { sellerId, storeId, activeStore } = useSellerScope();
  const isFood = activeStore?.sector === "FOOD";
  const loading = useMockLoading();
  const [status, setStatus] = useState<ProductStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItemRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const menus = useMenus({ sellerId, venueId: storeId || undefined, status }).filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.dishId.toLowerCase().includes(q);
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(m: MenuItemRecord) {
    setEditing(m);
    setForm(toForm(m));
    setOpen(true);
  }

  function save() {
    const pricePaisa = parseRupeesToPaisa(form.price);
    const itemLabel = isFood ? "Dish" : "Item";
    if (!form.venueId.trim() || !form.dishId.trim() || !form.name.trim() || pricePaisa < 0) {
      toast.error(`Venue, ${itemLabel.toLowerCase()} id, name and a non-negative price are required`);
      return;
    }
    const mrpRaw = form.mrp.trim();
    const mrpPaisa = mrpRaw === "" ? undefined : parseRupeesToPaisa(mrpRaw);
    if (mrpPaisa != null && mrpPaisa < pricePaisa) {
      toast.error("MRP must be greater than or equal to the selling price");
      return;
    }
    const dto: MenuDto = {
      venueId: form.venueId.trim(),
      dishId: form.dishId.trim(),
      name: form.name.trim(),
      pricePaisa,
      ...(mrpPaisa != null ? { mrpPaisa } : {}),
      isVeg: form.isVeg,
      cuisine: form.cuisine.trim(),
      image: form.image.trim(),
      sellerId,
    };
    upsertMenu(dto);
    toast.success(editing ? `${itemLabel} ${dto.dishId} updated` : `${itemLabel} ${dto.dishId} created`);
    setOpen(false);
  }

  const applyStatus = (m: MenuItemRecord, to: ProductStatus, message: string) => {
    setMenuStatus(m.venueId, m.dishId, to);
    toast.success(message);
  };

  return (
    <>
      <HubHeader
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-1 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background"
          >
            <Plus className="h-3.5 w-3.5" />
            {isFood ? "Add dish" : "Add item"}
          </button>
        }
      />

      <div className="space-y-3 px-4 pt-3 pb-6">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isFood ? "Search dish name or id" : "Search item name or id"}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            aria-label="Filters"
            onClick={() => setFiltersOpen(true)}
            className={cn(
              "rounded-xl border p-2",
              status !== "ALL" ? "border-foreground bg-foreground text-background" : "border-border bg-card",
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
          <EmptyState text={isFood ? "No dishes yet — add a dish or change the status filter" : "No items yet — add an item or change the status filter"} />
        ) : (
          <div className="space-y-3">
            {menus.map((m) => (
              <div key={`${m.venueId}:${m.dishId}`} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {isFood && <VegMark veg={m.isVeg !== false} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {m.cuisine ?? (isFood ? "No cuisine" : "Item code")} · {m.dishId}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <b>{formatINR(m.pricePaisa)}</b>
                      {m.mrpPaisa != null && m.mrpPaisa > m.pricePaisa && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          {formatINR(m.mrpPaisa)}
                        </span>
                      )}
                      <span
                        className={cn(
                          "ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                          STATUS_PILL[m.status],
                        )}
                      >
                        {m.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                  <div className="flex gap-3 text-xs font-semibold">
                    {m.status === "DRAFT" || m.status === "DELISTED" ? (
                      <button
                        className="text-info"
                        onClick={() => applyStatus(m, "PENDING_REVIEW", `${m.name} submitted for review`)}
                      >
                        Submit
                      </button>
                    ) : null}
                    {m.status === "ACTIVE" || m.status === "PENDING_REVIEW" ? (
                      <button
                        className="text-warning"
                        onClick={() => applyStatus(m, "DELISTED", `${m.name} delisted`)}
                      >
                        Delist
                      </button>
                    ) : null}
                  </div>
                  <button onClick={() => openEdit(m)} className="text-xs font-semibold text-info">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? (isFood ? "Edit dish" : "Edit item") : isFood ? "Add dish" : "Add item"}
        footer={
          <div className="flex items-center gap-2">
            {editing && (
              <button
                aria-label={isFood ? "Delete dish" : "Delete item"}
                onClick={() => {
                  deleteMenu(editing.venueId, editing.dishId);
                  toast.success(`${editing.name} removed`);
                  setOpen(false);
                }}
                className="rounded-xl border border-border bg-card p-3 text-brand"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="flex-[2] rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
            >
              {editing ? "Save changes" : isFood ? "Create dish" : "Create item"}
            </button>
          </div>
        }
      >
        <div className="pb-2">
          <TextField
            label="Venue id"
            value={form.venueId}
            disabled={editing !== null}
            onChange={(v) => setForm({ ...form, venueId: v })}
          />
          <TextField
            label={isFood ? "Dish id" : "Item id"}
            value={form.dishId}
            disabled={editing !== null}
            onChange={(v) => setForm({ ...form, dishId: v })}
          />
          <TextField
            label={isFood ? "Dish name" : "Item name"}
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <TextField
            label="Price (₹)"
            type="number"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
          />
          <TextField
            label="MRP (₹, optional)"
            type="number"
            value={form.mrp}
            placeholder="Leave blank for no offer"
            onChange={(v) => setForm({ ...form, mrp: v })}
          />
          <TextField
            label={isFood ? "Cuisine" : "Category"}
            value={form.cuisine}
            onChange={(v) => setForm({ ...form, cuisine: v })}
          />
          <TextField label="Image URL" value={form.image} onChange={(v) => setForm({ ...form, image: v })} />
          {isFood && (
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-medium">Vegetarian</span>
              <Toggle
                label="Vegetarian"
                checked={form.isVeg}
                onChange={(v) => setForm({ ...form, isVeg: v })}
              />
            </div>
          )}
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