import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, BookOpen, Menu as MenuIcon, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { OrdersShell } from "@/components/app/shells";
import { PillTabs, Toggle, VegMark, Sheet, EmptyState } from "@/components/app/kit";
import { OutOfStockSheet } from "@/components/app/stock-sheet";
import { useApp, actions, totalItems, stockLabel } from "@/store/app-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Restaurant Partner" }, { name: "description", content: "Turn menu items in or out of stock." }, { property: "og:title", content: "Inventory" }, { property: "og:description", content: "Turn menu items in or out of stock." }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const cats = useApp((s) => s.categories);
  const addons = useApp((s) => s.addons);
  const r = useApp((s) => s.restaurant);
  const [tab, setTab] = useState<"items" | "addons">("items");
  const [q, setQ] = useState("");
  const [oos, setOos] = useState<{ id: string; name: string } | null>(null);
  const [jump, setJump] = useState(false);
  const [onlyOut, setOnlyOut] = useState(false);
  const ql = q.toLowerCase();

  const header = (
    <header className="sticky top-0 z-30 bg-card px-4 pb-3 pt-3">
      <div className="flex items-center gap-2">
        <div className="flex-1"><p className="text-[15px] font-bold">{r.name}</p><p className="text-[11px] text-muted-foreground">{r.area}</p></div>
        <Link to="/outlet-info" className="flex h-7 w-7 items-center justify-center rounded-full bg-info text-[10px] font-bold text-primary-foreground">BJ</Link>
        <Link to="/explore" aria-label="Explore more" className="p-1.5"><MenuIcon className="h-5 w-5" /></Link>
      </div>
      <div className="mt-3"><PillTabs tabs={[{ key: "items", label: "All items", count: totalItems(cats) }, { key: "addons", label: "Add ons" }]} value={tab} onChange={setTab} /></div>
    </header>
  );

  return (
    <OrdersShell header={header}>
      <div className="bg-info-gradient px-4 pb-2 pt-2">
        <div className="flex items-center justify-between rounded-xl bg-info-soft px-3 py-2.5 text-xs">
          <span>Want to edit your menu?</span>
          <Link to="/menu" className="rounded-lg bg-card px-3 py-1 font-semibold text-info">Edit now</Link>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search menu" className="w-full bg-transparent text-sm outline-none" />
          </div>
          <button aria-label="Show out of stock only" onClick={() => setOnlyOut((v) => !v)} className={cn("rounded-xl border p-2", onlyOut ? "border-foreground bg-foreground text-background" : "border-border bg-card")}><SlidersHorizontal className="h-4 w-4" /></button>
        </div>
      </div>

      {tab === "items" ? (
        <div className="px-4">
          {cats.map((c) => {
            const items = c.items.filter((i) => i.name.toLowerCase().includes(ql) && (!onlyOut || i.stock.type !== "in"));
            if (!items.length && (q || onlyOut)) return null;
            const out = c.items.filter((i) => i.stock.type !== "in").length;
            return (
              <section key={c.id} id={`inv-${c.id}`} className="border-b border-border py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{c.name} <span className="ml-1 rounded bg-muted px-1.5 text-[10px]">{c.items.length}</span></p>
                    <p className="text-[11px] text-muted-foreground">{c.subName}</p>
                    <p className="text-[10px] text-muted-foreground">{out} out of {c.items.length} items are out of stock</p>
                  </div>
                  <Toggle label={`${c.name} category`} checked={c.enabled} onChange={(v) => { actions.setCategoryEnabled(c.id, v); toast.success(`${c.name} turned ${v ? "on" : "off"}`); }} />
                </div>
                <div className={cn("mt-2", !c.enabled && "opacity-50")}>
                  {items.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 py-2.5">
                      <VegMark veg={i.veg} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{i.name}</p>
                        <p className={cn("text-[10px]", i.stock.type === "in" ? "text-muted-foreground" : "text-brand")}>{stockLabel(i.stock)}</p>
                      </div>
                      <Toggle
                        label={i.name}
                        checked={i.stock.type === "in"}
                        onChange={(v) => {
                          if (i.stock.type === "hold") return toast.error("This item is on hold. Contact support to enable it.");
                          if (v) { actions.setItemStock(i.id, { type: "in" }); toast.success(`${i.name} is back in stock`); }
                          else setOos({ id: i.id, name: i.name });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          {(q || onlyOut) && !cats.some((c) => c.items.some((i) => i.name.toLowerCase().includes(ql) && (!onlyOut || i.stock.type !== "in"))) && <EmptyState text="No items match your search" />}
        </div>
      ) : (
        <div className="px-4">
          {addons.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-border py-3">
              <VegMark veg={a.veg} />
              <div className="flex-1"><p className="text-sm">{a.name}</p><p className="text-[10px] text-muted-foreground">{a.group} • {a.inStock ? "In stock" : "Out of stock"}</p></div>
              <Toggle label={a.name} checked={a.inStock} onChange={(v) => { actions.setAddonStock(a.id, v); toast.success(`${a.name} ${v ? "in" : "out of"} stock`); }} />
            </div>
          ))}
        </div>
      )}

      {tab === "items" && (
        <button onClick={() => setJump(true)} className="fixed bottom-24 right-[max(1rem,calc(50%-199px))] z-30 flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-md">
          <BookOpen className="h-3.5 w-3.5" />Menu
        </button>
      )}
      <Sheet open={jump} onClose={() => setJump(false)} title="Menu">
        {cats.map((c) => (
          <button key={c.id} onClick={() => { setJump(false); document.getElementById(`inv-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="flex w-full justify-between border-b border-border py-3 text-sm last:border-0">
            <span>{c.name}</span><span className="text-muted-foreground">{c.items.length}</span>
          </button>
        ))}
      </Sheet>
      <OutOfStockSheet item={oos} onClose={() => setOos(null)} />
    </OrdersShell>
  );
}
