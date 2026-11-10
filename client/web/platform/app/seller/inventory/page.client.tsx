"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Plus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { OrdersTopBar } from "@/components/sellers/shells";
import { Sheet, EmptyState, PillTabs, RadioRow, TextField, Toggle, VegMark } from "@/components/sellers/kit";
import {
  createAddon,
  delistAddon,
  linkAddonToDish,
  listAddons,
  listMenuAddons,
  setMenuStatus,
  submitAddonForReview,
  unlinkAddonFromDish,
  updateStock,
} from "@/lib/api";
import { useMenus, useSellerScope, useStock } from "@/lib/api/hooks";
import type { AddonRecord, MenuAddonRecord, MenuItemRecord, ProductStatus } from "@/data/types";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Back-in-stock qty + ETA the seller console writes when a product is turned on. */
const RESTOCK_QTY = 10;
const RESTOCK_ETA = 30;

const ADDON_PILL: Record<ProductStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-warning-soft text-warning",
  ACTIVE: "bg-success-soft text-success",
  REJECTED: "bg-brand-soft text-brand",
  DELISTED: "bg-muted text-muted-foreground",
};

function statusLabel(status: ProductStatus): string {
  return status.replace(/_/g, " ");
}

function rupeesToPaisa(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

function stockLabel(quantity: number, etaMinutes: number): string {
  if (quantity <= 0) return "Out of stock";
  return `${quantity} in stock • ETA ${etaMinutes} min`;
}

type OosItem = { productId: string; name: string } | null;

function OosSheet({
  item,
  onClose,
}: {
  item: OosItem;
  onClose: () => void;
}) {
  const [opt, setOpt] = useState("2h");
  const [date, setDate] = useState(new Date(Date.now() + 864e5).toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const options = [
    { key: "2h", label: "2 hours", sub: "Back in stock in 2 hours" },
    { key: "4h", label: "4 hours", sub: "Back in stock in 4 hours" },
    { key: "next", label: "Next business day", sub: "Back in stock tomorrow" },
    { key: "custom", label: "Custom date & time", sub: "Pick a moment" },
    { key: "manual", label: "I will turn it back in stock myself", sub: "No automatic restore" },
  ];
  const etaFor = (key: string): number => {
    if (key === "2h") return 120;
    if (key === "4h") return 240;
    if (key === "next") return 600;
    if (key === "custom") return Math.max(0, Math.round((new Date(`${date}T${time || "00:00"}`).getTime() - Date.now()) / 60000));
    return RESTOCK_ETA;
  };
  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      title="Mark item out of stock"
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
          >
            Back
          </button>
          <button
            onClick={() => {
              if (!item) return;
              updateStock(item.productId, 0, etaFor(opt));
              toast.success(`${item.name} marked out of stock`);
              onClose();
            }}
            className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
          >
            Confirm
          </button>
        </div>
      }
    >
      <p className="mb-1 text-xs text-muted-foreground">
        {item?.name} — when should it be back in stock?
      </p>
      {options.map((o) => (
        <div key={o.key}>
          <RadioRow
            label={o.label}
            sub={o.sub}
            checked={opt === o.key}
            onClick={() => setOpt(o.key)}
          />
          {o.key === "custom" && opt === "custom" && (
            <div className="flex gap-2 pb-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 rounded-lg border border-border px-2 py-2 text-sm"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-28 rounded-lg border border-border px-2 py-2 text-sm"
              />
            </div>
          )}
        </div>
      ))}
    </Sheet>
  );
}

function CreateAddonSheet({
  open,
  venueId,
  onClose,
  onCreated,
}: {
  open: boolean;
  venueId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [price, setPrice] = useState("");
  const [isVeg, setIsVeg] = useState(true);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setGroup("");
    setPrice("");
    setIsVeg(true);
  };

  const submit = async () => {
    const pricePaisa = rupeesToPaisa(price);
    if (!venueId || !name.trim() || pricePaisa <= 0) {
      toast.error("Add a name and a price greater than ₹0");
      return;
    }
    setBusy(true);
    try {
      await createAddon({
        venueId,
        name: name.trim(),
        groupName: group.trim(),
        pricePaisa,
        isVeg,
      });
      toast.success("Add-on saved as draft", {
        description: "Submit it for review when you're ready for it to go live.",
      });
      reset();
      onCreated();
      onClose();
    } catch {
      toast.error("Could not create the add-on");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Create add-on"
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => void submit()}
            className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save draft"}
          </button>
        </div>
      }
    >
      <TextField label="Name" value={name} onChange={setName} placeholder="Extra Cheese" />
      <TextField label="Group (optional)" value={group} onChange={setGroup} placeholder="Toppings" />
      <TextField label="Price (₹)" value={price} onChange={setPrice} placeholder="20" type="number" />
      <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Vegetarian</p>
          <p className="text-[10px] text-muted-foreground">Show the green veg mark on this add-on</p>
        </div>
        <Toggle label="Vegetarian add-on" checked={isVeg} onChange={setIsVeg} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        New add-ons start as DRAFT. Submit for review to show them to customers once approved.
      </p>
    </Sheet>
  );
}

function LinkAddonSheet({
  open,
  dish,
  addons,
  links,
  onClose,
  onSaved,
}: {
  open: boolean;
  dish: MenuItemRecord | null;
  addons: AddonRecord[];
  links: MenuAddonRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !dish) return;
    setSelected(
      links.filter((l) => l.venueId === dish.venueId && l.dishId === dish.dishId).map((l) => l.addonId),
    );
  }, [open, dish, links]);

  if (!dish) return null;
  const available = addons.filter((a) => a.status !== "DELISTED");

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    const linkedBefore = links
      .filter((l) => l.venueId === dish.venueId && l.dishId === dish.dishId)
      .map((l) => l.addonId);
    const toLink = selected.filter((id) => !linkedBefore.includes(id));
    const toUnlink = linkedBefore.filter((id) => !selected.includes(id));
    setBusy(true);
    try {
      await Promise.all([
        ...toLink.map((id) => linkAddonToDish(dish.venueId, dish.dishId, id)),
        ...toUnlink.map((id) => unlinkAddonFromDish(dish.venueId, dish.dishId, id)),
      ]);
      toast.success("Add-ons updated for this dish");
      onSaved();
      onClose();
    } catch {
      toast.error("Could not update this dish's add-ons");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Add-ons for ${dish.name}`}
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save links"}
          </button>
        </div>
      }
    >
      {available.length === 0 ? (
        <EmptyState text="Create an add-on first, then link it to this dish" />
      ) : (
        available.map((a) => {
          const checked = selected.includes(a.addonId);
          return (
            <button
              key={a.addonId}
              type="button"
              onClick={() => toggle(a.addonId)}
              className="flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-0"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold",
                  checked ? "border-foreground bg-foreground text-background" : "border-border",
                )}
              >
                {checked ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{a.name}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {a.groupName || "Add-on"} • {formatINR(a.pricePaisa)}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                  ADDON_PILL[a.status],
                )}
              >
                {statusLabel(a.status)}
              </span>
            </button>
          );
        })
      )}
    </Sheet>
  );
}

function SellerInventory() {
  const { sellerId, storeId, activeStore } = useSellerScope();
  const isFood = activeStore?.sector === "FOOD";
  const rows = useStock(sellerId, storeId);
  const menus = useMenus({ sellerId, venueId: storeId || undefined });
  const [tab, setTab] = useState<"items" | "menu" | "addons">("items");
  const [q, setQ] = useState("");
  const [onlyOut, setOnlyOut] = useState(false);
  const [oos, setOos] = useState<OosItem>(null);
  const [jump, setJump] = useState(false);
  const [addons, setAddons] = useState<AddonRecord[]>([]);
  const [links, setLinks] = useState<MenuAddonRecord[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkDish, setLinkDish] = useState<MenuItemRecord | null>(null);
  const [busyAddon, setBusyAddon] = useState<string | null>(null);
  const ql = q.toLowerCase();

  const lowCount = rows.filter((r) => r.quantity <= r.lowStockThreshold).length;
  const visible = (name: string) => name.toLowerCase().includes(ql);

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

  const submitForReview = async (addon: AddonRecord) => {
    setBusyAddon(addon.addonId);
    try {
      await submitAddonForReview(addon.addonId);
      toast.success("Add-on submitted for review", {
        description: "An admin will approve it before it shows to customers.",
      });
      await refreshAddons();
    } catch {
      toast.error("Could not submit the add-on");
    } finally {
      setBusyAddon(null);
    }
  };

  const delist = async (addon: AddonRecord) => {
    setBusyAddon(addon.addonId);
    try {
      await delistAddon(addon.addonId);
      toast.success(`${addon.name} delisted`);
      await refreshAddons();
    } catch {
      toast.error("Could not delist the add-on");
    } finally {
      setBusyAddon(null);
    }
  };

  const toggleLink = async (venueId: string, dishId: string, addonId: string, enabled: boolean) => {
    setBusyAddon(addonId);
    try {
      if (enabled) await unlinkAddonFromDish(venueId, dishId, addonId);
      else await linkAddonToDish(venueId, dishId, addonId);
      await refreshAddons();
    } catch {
      toast.error("Could not update the link");
    } finally {
      setBusyAddon(null);
    }
  };

  const categories = Array.from(
    new Map(
      rows
        .filter((r) => (onlyOut ? r.quantity <= r.lowStockThreshold : true))
        .map((r) => [r.product.category, r.product.category]),
    ).keys(),
  )
    .filter((c) => !q || c.toLowerCase().includes(ql) || rows.some((r) => r.product.category === c && visible(r.product.name)))
    .sort();

  const grouped = categories
    .map((category) => ({
      category,
      items: rows.filter(
        (r) => r.product.category === category && (!q || visible(r.product.name)) && (!onlyOut || r.quantity <= r.lowStockThreshold),
      ),
      out: rows.filter((r) => r.product.category === category && r.quantity <= 0).length,
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <OrdersTopBar />
      <div className="bg-info-gradient px-4 pb-2 pt-3">
        <div className="flex items-center justify-between rounded-xl bg-info-soft px-3 py-2.5 text-xs">
          <span>Want to edit your catalog or {isFood ? "dishes" : "items"}?</span>
          <Link href="/seller/products" className="rounded-lg bg-card px-3 py-1 font-semibold text-info">
            Edit now
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search catalog"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            aria-label="Show low stock only"
            onClick={() => setOnlyOut((v) => !v)}
            className={cn(
              "rounded-xl border p-2",
              onlyOut ? "border-foreground bg-foreground text-background" : "border-border bg-card",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3">
          <PillTabs
            tabs={[
              { key: "items", label: "All items", count: rows.length },
              { key: "menu", label: isFood ? "Menu dishes" : "Menu items", count: menus.length },
              { key: "addons", label: "Add-ons", count: addons.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {lowCount > 0 && tab === "items" && (
        <p className="mx-4 mt-3 rounded-xl bg-warning-soft px-4 py-2 text-[11px] font-semibold text-warning">
          {lowCount} listing{lowCount > 1 ? "s" : ""} at or below the low-stock threshold
        </p>
      )}

      {tab === "items" ? (
        <div className="px-4 pb-16">
          {grouped.map((g) => (
            <section key={g.category} id={`inv-${g.category}`} className="border-b border-border py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">
                    {g.category} <span className="ml-1 rounded bg-muted px-1.5 text-[10px]">{g.items.length}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {g.out > 0 ? `${g.out} of ${g.items.length} items are out of stock` : "All items in stock"}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                {g.items.map((r) => (
                  <div key={r.productId} className="flex items-center gap-3 py-2.5">
                    {isFood && <VegMark veg={r.product.isVeg} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.product.name}</p>
                      <p className={cn("text-[10px]", r.quantity <= 0 ? "text-brand" : "text-muted-foreground")}>
                        {stockLabel(r.quantity, r.etaMinutes)} · {formatINR(r.product.pricePaisa)}
                      </p>
                    </div>
                    <Toggle
                      label={r.product.name}
                      checked={r.quantity > 0}
                      onChange={(v) => {
                        if (v) {
                          updateStock(r.productId, RESTOCK_QTY, RESTOCK_ETA);
                          toast.success(`${r.product.name} is back in stock`);
                        } else {
                          setOos({ productId: r.productId, name: r.product.name });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
          {grouped.length === 0 && <EmptyState text="No items match your search" />}
        </div>
      ) : tab === "menu" ? (
        <div className="px-4 pb-16">
          {menus.map((m) => (
            <div key={`${m.venueId}:${m.dishId}`} className="flex items-center gap-3 border-b border-border py-3">
              {isFood && <VegMark veg={m.isVeg !== false} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {m.cuisine ?? m.venueId} • {formatINR(m.pricePaisa)}
                </p>
              </div>
              <Toggle
                label={m.name}
                checked={m.status === "ACTIVE"}
                onChange={(v) => {
                  setMenuStatus(m.venueId, m.dishId, v ? "ACTIVE" : "DELISTED");
                  toast.success(`${m.name} ${v ? "listed" : "delisted"}`);
                }}
              />
            </div>
          ))}
          {menus.length === 0 && (
            <EmptyState text={isFood ? "No dishes in your menu yet" : "No items in your menu yet"} />
          )}
        </div>
      ) : (
        <div className="px-4 pb-24">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-bold">Add-ons</p>
              <p className="text-[10px] text-muted-foreground">
                Extras customers can add to a dish. Approved add-ons appear on the menu.
              </p>
            </div>
            <button
              disabled={!storeId}
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Create
            </button>
          </div>

          {addons.length > 0 && (
            <section className="mb-2 rounded-xl border border-border">
              <p className="border-b border-border px-3 py-2 text-xs font-bold">Your add-ons</p>
              {addons.map((a) => (
                <div key={a.addonId} className="flex items-start gap-2 border-b border-border px-3 py-2.5 last:border-0">
                  <VegMark veg={a.isVeg} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {a.groupName || "Add-on"} • {formatINR(a.pricePaisa)}
                    </p>
                    {a.status === "DRAFT" && a.reviewReason ? (
                      <p className="mt-1 rounded bg-brand-soft px-2 py-1 text-[11px] text-brand">{a.reviewReason}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className={cn("rounded px-1.5 py-0.5 font-bold uppercase", ADDON_PILL[a.status])}>
                        {statusLabel(a.status)}
                      </span>
                      {(a.status === "DRAFT" || a.status === "DELISTED") && (
                        <button
                          disabled={busyAddon === a.addonId}
                          onClick={() => void submitForReview(a)}
                          className="font-semibold text-info disabled:opacity-50"
                        >
                          Submit for review
                        </button>
                      )}
                      {a.status !== "DELISTED" && (
                        <button
                          disabled={busyAddon === a.addonId}
                          onClick={() => void delist(a)}
                          className="font-semibold text-muted-foreground disabled:opacity-50"
                        >
                          Delist
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          <p className="pb-1 pt-2 text-xs font-bold">Add-ons per dish</p>
          {menus.length === 0 ? (
            <EmptyState text="Add a menu dish first, then link add-ons to it" />
          ) : (
            menus.map((m) => {
              const dishLinks = links.filter((l) => l.venueId === m.venueId && l.dishId === m.dishId);
              return (
                <div key={`${m.venueId}:${m.dishId}`} className="border-b border-border py-3">
                  <div className="flex items-center gap-2">
                    {isFood && <VegMark veg={m.isVeg !== false} />}
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{m.name}</p>
                    <button
                      onClick={() => setLinkDish(m)}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold"
                    >
                      <Plus className="h-3 w-3" /> Add add-on
                    </button>
                  </div>
                  {dishLinks.length === 0 ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">No add-ons linked yet</p>
                  ) : (
                    <div className="mt-1.5 space-y-1.5">
                      {dishLinks.map((l) => (
                        <div key={l.addonId} className="flex items-center gap-2 rounded-xl bg-muted/50 px-2 py-1.5">
                          <VegMark veg={l.isVeg} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs">
                              {l.name} · {formatINR(l.pricePaisa)}
                            </p>
                            <span className={cn("rounded px-1 py-0.5 text-[9px] font-bold uppercase", ADDON_PILL[l.status])}>
                              {statusLabel(l.status)}
                            </span>
                          </div>
                          <Toggle
                            label={`${l.name} enabled on ${m.name}`}
                            checked={l.enabled}
                            onChange={() => void toggleLink(l.venueId, l.dishId, l.addonId, l.enabled)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {addonsLoading && <p className="pt-3 text-center text-[11px] text-muted-foreground">Loading add-ons…</p>}
        </div>
      )}

      {tab === "items" && (
        <button
          onClick={() => setJump(true)}
          className="fixed bottom-[calc(var(--seller-nav-gap)+var(--seller-nav-h)+1.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-md md:right-6"
        >
          <BookOpen className="h-3.5 w-3.5" />Jump
        </button>
      )}

      <Sheet open={jump} onClose={() => setJump(false)} title="Jump to category">
        {grouped.map((g) => (
          <button
            key={g.category}
            onClick={() => {
              setJump(false);
              document.getElementById(`inv-${g.category}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex w-full justify-between border-b border-border py-3 text-sm last:border-0"
          >
            <span>{g.category}</span>
            <span className="text-muted-foreground">{g.items.length}</span>
          </button>
        ))}
      </Sheet>

      <OosSheet item={oos} onClose={() => setOos(null)} />
      <CreateAddonSheet
        open={createOpen}
        venueId={storeId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void refreshAddons()}
      />
      <LinkAddonSheet
        open={linkDish !== null}
        dish={linkDish}
        addons={addons}
        links={links}
        onClose={() => setLinkDish(null)}
        onSaved={() => void refreshAddons()}
      />
    </>
  );
}

export default SellerInventory;
