"use client";
// Retail (Mart / Pharmacy) inventory = unit quantity and replenishment. A shop counts stock, marks
// a SKU out of stock with an ETA, and restocks it. There is no veg mark, cuisine, or add-on linking
// here — those belong to the Food view so the two sectors share no state or payloads.
import Link from "next/link";
import { useState } from "react";
import { BookOpen, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { OrdersTopBar } from "@/components/sellers/shells";
import { EmptyState, RadioRow, Sheet, Toggle } from "@/components/sellers/kit";
import { updateStock } from "@/lib/api";
import { useStock } from "@/lib/api/hooks";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Sector } from "@/data/types";

/**
 * Fallbacks used only when the active shop has no restock defaults on the wire (an older gateway, or
 * a shop created before 0123). The real values come from `directory.stores.restock_qty` /
 * `restock_eta_minutes`, because a mart restocking a sack and a pharmacy restocking a strip do not
 * share a unit count.
 */
const FALLBACK_RESTOCK_QTY = 10;
const FALLBACK_RESTOCK_ETA = 30;

type OosItem = { productId: string; name: string } | null;
type LotItem = { productId: string; name: string; batchNo: string; expiryDate: string } | null;

/** True when the lot is past its expiry date (the server also treats it as unavailable). */
function isExpired(expiryDate?: string): boolean {
  if (!expiryDate) return false;
  return expiryDate < new Date().toISOString().slice(0, 10);
}

function stockLabel(quantity: number, etaMinutes: number): string {
  if (quantity <= 0) return "Out of stock";
  return `${quantity} in stock • ETA ${etaMinutes} min`;
}

function StockPill({ quantity, lowStockThreshold }: { quantity: number; lowStockThreshold: number }) {
  const state = quantity <= 0 ? "out" : quantity <= lowStockThreshold ? "low" : "in";
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
        state === "out"
          ? "bg-brand-soft text-brand"
          : state === "low"
            ? "bg-warning-soft text-warning"
            : "bg-success-soft text-success",
      )}
    >
      {state === "out" ? "Out of stock" : state === "low" ? "Low stock" : "In stock"}
    </span>
  );
}

function OosSheet({
  item,
  restockEta,
  onClose,
}: {
  item: OosItem;
  restockEta: number;
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
    if (key === "custom")
      return Math.max(
        0,
        Math.round((new Date(`${date}T${time || "00:00"}`).getTime() - Date.now()) / 60000),
      );
    return restockEta;
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

/** Batch + expiry editor for one SKU (0123). A pharmacy/pharma row records the lot it is selling. */
function LotSheet({
  item,
  onSave,
  onClose,
}: {
  item: LotItem;
  onSave: (productId: string, batchNo: string, expiryDate: string) => void;
  onClose: () => void;
}) {
  const [batch, setBatch] = useState(item?.batchNo ?? "");
  const [expiry, setExpiry] = useState(item?.expiryDate ?? "");
  return (
    <Sheet
      open={item !== null}
      onClose={onClose}
      title="Batch & expiry"
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
              onSave(item.productId, batch.trim(), expiry);
              onClose();
            }}
            className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
          >
            Save
          </button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        {item?.name} — leave both blank for a SKU that carries no lot or expiry.
      </p>
      <label className="mb-1 block text-[11px] font-semibold" htmlFor="lot-batch">
        Batch / lot number
      </label>
      <input
        id="lot-batch"
        value={batch}
        maxLength={40}
        onChange={(e) => setBatch(e.target.value)}
        placeholder="e.g. B-2291"
        className="mb-3 w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      <label className="mb-1 block text-[11px] font-semibold" htmlFor="lot-expiry">
        Expiry date
      </label>
      <input
        id="lot-expiry"
        type="date"
        value={expiry}
        onChange={(e) => setExpiry(e.target.value)}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      {expiry && isExpired(expiry) && (
        <p className="mt-2 text-[11px] font-semibold text-brand">
          This date is in the past — the SKU stops being sellable.
        </p>
      )}
    </Sheet>
  );
}

export function RetailStockInventoryView({
  sellerId,
  storeId,
  sector,
  restockQty,
  restockEtaMinutes,
}: {
  sellerId: string;
  storeId: string;
  sector: Sector;
  /** Per-shop restock defaults (0123); falls back to 10 units / 30 min when the shop has none. */
  restockQty?: number | undefined;
  restockEtaMinutes?: number | undefined;
}) {
  const rows = useStock(sellerId, storeId);
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [oos, setOos] = useState<OosItem>(null);
  const [lot, setLot] = useState<LotItem>(null);
  const [jump, setJump] = useState(false);
  const ql = q.toLowerCase();
  const restockQtyValue = restockQty && restockQty > 0 ? restockQty : FALLBACK_RESTOCK_QTY;
  const restockEtaValue =
    typeof restockEtaMinutes === "number" && restockEtaMinutes >= 0
      ? restockEtaMinutes
      : FALLBACK_RESTOCK_ETA;

  const lowCount = rows.filter((r) => r.quantity <= r.lowStockThreshold).length;

  const categories = Array.from(
    new Map(
      rows
        .filter((r) => (onlyLow ? r.quantity <= r.lowStockThreshold : true))
        .map((r) => [r.product.category, r.product.category]),
    ).keys(),
  )
    .filter(
      (c) =>
        !q ||
        c.toLowerCase().includes(ql) ||
        rows.some((r) => r.product.category === c && r.product.name.toLowerCase().includes(ql)),
    )
    .sort();

  const grouped = categories
    .map((category) => ({
      category,
      items: rows.filter(
        (r) =>
          r.product.category === category &&
          (!q || r.product.name.toLowerCase().includes(ql)) &&
          (!onlyLow || r.quantity <= r.lowStockThreshold),
      ),
      out: rows.filter((r) => r.product.category === category && r.quantity <= 0).length,
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <OrdersTopBar />
      <div className="bg-info-gradient px-4 pb-2 pt-3">
        <div className="flex items-center justify-between rounded-xl bg-info-soft px-3 py-2.5 text-xs">
          <span>Want to edit your catalog or items?</span>
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
              placeholder="Search stock"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            aria-label="Show low stock only"
            onClick={() => setOnlyLow((v) => !v)}
            className={cn(
              "rounded-xl border p-2",
              onlyLow ? "border-foreground bg-foreground text-background" : "border-border bg-card",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {sector === "PHARMA"
            ? "Pharmacy stock — mark a regulated SKU out of stock until your next supply arrives."
            : "Retail stock — set the unit count customers can order right now."}
        </p>
      </div>

      {lowCount > 0 && (
        <p className="mx-4 mt-3 rounded-xl bg-warning-soft px-4 py-2 text-[11px] font-semibold text-warning">
          {lowCount} listing{lowCount > 1 ? "s" : ""} at or below the low-stock threshold
        </p>
      )}

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
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-lg">
                    {r.product.imageUrl ? (
                      <img
                        src={r.product.imageUrl}
                        alt={r.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      r.product.emoji
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="min-w-0 truncate text-sm">{r.product.name}</p>
                      <StockPill
                        quantity={isExpired(r.expiryDate) ? 0 : r.quantity}
                        lowStockThreshold={r.lowStockThreshold}
                      />
                      {sector === "PHARMA" && r.product.isPrescription && (
                        <span className="shrink-0 rounded bg-info-soft px-1.5 py-0.5 text-[9px] font-bold uppercase text-info">
                          Rx
                        </span>
                      )}
                    </div>
                    <p className={cn("text-[10px]", r.quantity <= 0 ? "text-brand" : "text-muted-foreground")}>
                      {stockLabel(r.quantity, r.etaMinutes)} · {formatINR(r.product.pricePaisa)}
                    </p>
                    {(r.batchNo || r.expiryDate) && (
                      <p
                        className={cn(
                          "text-[10px]",
                          isExpired(r.expiryDate) ? "font-semibold text-brand" : "text-muted-foreground",
                        )}
                      >
                        {r.batchNo ? `Batch ${r.batchNo}` : "No batch"}
                        {r.expiryDate ? ` · Exp ${r.expiryDate}` : ""}
                        {isExpired(r.expiryDate) ? " · expired" : ""}
                      </p>
                    )}
                  </div>
                  <button
                    aria-label={`Batch and expiry for ${r.product.name}`}
                    onClick={() =>
                      setLot({
                        productId: r.productId,
                        name: r.product.name,
                        batchNo: r.batchNo ?? "",
                        expiryDate: r.expiryDate ?? "",
                      })
                    }
                    className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Lot
                  </button>
                  <Toggle
                    label={r.product.name}
                    checked={r.quantity > 0 && !isExpired(r.expiryDate)}
                    onChange={(v) => {
                      if (v) {
                        updateStock(r.productId, restockQtyValue, restockEtaValue);
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
        {grouped.length === 0 && (
          <EmptyState text={rows.length === 0 ? "No stock rows yet — add a product first" : "No items match your search"} />
        )}
      </div>

      {grouped.length > 1 && (
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
              document
                .getElementById(`inv-${g.category}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex w-full justify-between border-b border-border py-3 text-sm last:border-0"
          >
            <span>{g.category}</span>
            <span className="text-muted-foreground">{g.items.length}</span>
          </button>
        ))}
      </Sheet>

      <OosSheet item={oos} restockEta={restockEtaValue} onClose={() => setOos(null)} />
      <LotSheet
        item={lot}
        onClose={() => setLot(null)}
        onSave={(productId, batchNo, expiryDate) => {
          const row = rows.find((r) => r.productId === productId);
          updateStock(productId, row?.quantity ?? 0, row?.etaMinutes ?? restockEtaValue, {
            batchNo,
            expiryDate,
          });
          toast.success("Batch details saved");
        }}
      />
    </>
  );
}
