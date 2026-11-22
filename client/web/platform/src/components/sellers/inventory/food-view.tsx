"use client";
// Food shop inventory = dish availability, not unit counts. A kitchen marks a dish listed or
// delisted for the shift and manages the add-ons attached to it; it never decrements "42 plates".
// Retail stock (qty + ETA) lives in retail-view.tsx so the two flows share no state or payloads.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { OrdersTopBar } from "@/components/sellers/shells";
import { EmptyState, PillTabs, Sheet, TextField, Toggle, VegMark } from "@/components/sellers/kit";
import {
  createAddon,
  delistAddon,
  linkAddonToDish,
  listAddons,
  listMenuAddons,
  setMenuStatus,
  submitAddonForReview,
  unlinkAddonFromDish,
} from "@/lib/api";
import { useMenus } from "@/lib/api/hooks";
import { formatINR } from "@/lib/format";
import { tamilFieldError } from "@/lib/tamil";
import { cn } from "@/lib/utils";
import type { AddonRecord, MenuAddonRecord, MenuItemRecord, ProductStatus } from "@/data/types";

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
  const [nameTa, setNameTa] = useState("");
  const [groupTa, setGroupTa] = useState("");
  const [price, setPrice] = useState("");
  const [isVeg, setIsVeg] = useState(true);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setGroup("");
    setNameTa("");
    setGroupTa("");
    setPrice("");
    setIsVeg(true);
  };

  const submit = async () => {
    const pricePaisa = rupeesToPaisa(price);
    if (!venueId || !name.trim() || pricePaisa <= 0) {
      toast.error("Add a name and a price greater than ₹0");
      return;
    }
    const nameTaError = tamilFieldError(nameTa, 200, "Tamil name");
    if (nameTaError) {
      toast.error(nameTaError);
      return;
    }
    const groupTaError = tamilFieldError(groupTa, 120, "Tamil group");
    if (groupTaError) {
      toast.error(groupTaError);
      return;
    }
    setBusy(true);
    try {
      await createAddon({
        venueId,
        name: name.trim(),
        groupName: group.trim(),
        ...(nameTa.trim() ? { nameTa: nameTa.trim() } : {}),
        ...(groupTa.trim() ? { groupNameTa: groupTa.trim() } : {}),
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
      <TextField
        label="Tamil name (optional)"
        value={nameTa}
        onChange={setNameTa}
        lang="ta"
        placeholder="தமிழில் பெயர்"
      />
      <TextField label="Group (optional)" value={group} onChange={setGroup} placeholder="Toppings" />
      <TextField
        label="Tamil group (optional)"
        value={groupTa}
        onChange={setGroupTa}
        lang="ta"
        placeholder="தமிழில் குழு"
      />
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

export function FoodInventoryView({ sellerId, storeId }: { sellerId: string; storeId: string }) {
  const menus = useMenus({ sellerId, venueId: storeId || undefined });
  const [tab, setTab] = useState<"menu" | "addons">("menu");
  const [q, setQ] = useState("");
  const [onlyDelisted, setOnlyDelisted] = useState(false);
  const [addons, setAddons] = useState<AddonRecord[]>([]);
  const [links, setLinks] = useState<MenuAddonRecord[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkDish, setLinkDish] = useState<MenuItemRecord | null>(null);
  const [busyAddon, setBusyAddon] = useState<string | null>(null);
  const ql = q.toLowerCase();

  const visibleMenus = menus.filter(
    (m) =>
      (!q || m.name.toLowerCase().includes(ql)) &&
      (!onlyDelisted || m.status !== "ACTIVE"),
  );

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

  return (
    <>
      <OrdersTopBar />
      <div className="bg-info-gradient px-4 pb-2 pt-3">
        <div className="flex items-center justify-between rounded-xl bg-info-soft px-3 py-2.5 text-xs">
          <span>Want to edit your dishes or prices?</span>
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
              placeholder="Search dishes"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            aria-label="Show delisted only"
            onClick={() => setOnlyDelisted((v) => !v)}
            className={cn(
              "rounded-xl border p-2",
              onlyDelisted ? "border-foreground bg-foreground text-background" : "border-border bg-card",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3">
          <PillTabs
            tabs={[
              { key: "menu", label: "Menu dishes", count: menus.length },
              { key: "addons", label: "Add-ons", count: addons.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {tab === "menu" ? (
        <div className="px-4 pb-16">
          {visibleMenus.map((m) => (
            <div key={`${m.venueId}:${m.dishId}`} className="flex items-center gap-3 border-b border-border py-3">
              <VegMark veg={m.isVeg !== false} />
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
                  void setMenuStatus(m.venueId, m.dishId, v ? "ACTIVE" : "DELISTED");
                  toast.success(`${m.name} ${v ? "listed" : "delisted"}`);
                }}
              />
            </div>
          ))}
          {visibleMenus.length === 0 && (
            <EmptyState text={menus.length === 0 ? "No dishes in your menu yet" : "No dishes match your search"} />
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
                    <VegMark veg={m.isVeg !== false} />
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
