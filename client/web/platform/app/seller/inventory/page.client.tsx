"use client";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { OrdersTopBar } from "@/components/sellers/shells";
import { Sheet, EmptyState, PillTabs, RadioRow, Toggle, VegMark } from "@/components/sellers/kit";
import { setMenuStatus, updateStock } from "@/lib/api";
import { useMenus, useSellerScope, useStock } from "@/lib/api/hooks";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Back-in-stock qty + ETA the seller console writes when a product is turned on. */
const RESTOCK_QTY = 10;
const RESTOCK_ETA = 30;

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

function SellerInventory() {
  const { sellerId, storeId } = useSellerScope();
  const rows = useStock(sellerId, storeId);
  const menus = useMenus({ sellerId });
  const [tab, setTab] = useState<"items" | "addons">("items");
  const [q, setQ] = useState("");
  const [onlyOut, setOnlyOut] = useState(false);
  const [oos, setOos] = useState<OosItem>(null);
  const [jump, setJump] = useState(false);
  const ql = q.toLowerCase();

  const lowCount = rows.filter((r) => r.quantity <= r.lowStockThreshold).length;
  const visible = (name: string) => name.toLowerCase().includes(ql);

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
          <span>Want to edit your catalog or dishes?</span>
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
              placeholder="Search menu"
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
              { key: "addons", label: "Menu dishes", count: menus.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {lowCount > 0 && (
        <p className="mx-4 mt-3 rounded-xl bg-warning-soft px-4 py-2 text-[11px] font-semibold text-warning">
          {lowCount} listing{lowCount > 1 ? "s" : ""} at or below the low-stock threshold
        </p>
      )}

      {tab === "items" ? (
        <div className="px-4">
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
                    <VegMark veg={r.product.isVeg} />
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
      ) : (
        <div className="px-4">
          {menus.map((m) => (
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
                  setMenuStatus(m.venueId, m.dishId, v ? "ACTIVE" : "DELISTED");
                  toast.success(`${m.name} ${v ? "listed" : "delisted"}`);
                }}
              />
            </div>
          ))}
          {menus.length === 0 && <EmptyState text="No dishes in your menu yet" />}
        </div>
      )}

      {tab === "items" && (
        <button
          onClick={() => setJump(true)}
          className="fixed bottom-24 right-[max(1rem,calc(50%-199px))] z-30 flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-md"
        >
          <BookOpen className="h-3.5 w-3.5" />Menu
        </button>
      )}

      <Sheet open={jump} onClose={() => setJump(false)} title="Menu">
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
    </>
  );
}

export default SellerInventory;