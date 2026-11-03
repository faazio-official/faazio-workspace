import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Lightbulb, Search, X, SlidersHorizontal, Plus, Pencil, Eye, BookOpen, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { UnderlineTabs, Toggle, VegMark, Sheet, RadioRow, PrimaryButton, TextField, inr, EmptyState } from "@/components/app/kit";
import { OutOfStockSheet } from "@/components/app/stock-sheet";
import { useApp, actions, stockLabel } from "@/store/app-store";
import { api } from "@/services/api";
import type { MenuItem } from "@/mocks/menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu")({
  head: () => ({ meta: [{ title: "Edit menu — Restaurant Partner" }, { name: "description", content: "Edit items, add-ons, prices and stock." }, { property: "og:title", content: "Edit menu" }, { property: "og:description", content: "Edit items, add-ons, prices and stock." }] }),
  component: MenuPage,
});

function matches(i: MenuItem, f: string) {
  switch (f) {
    case "On hold": return i.stock.type === "hold";
    case "Out of stock": return i.stock.type === "out";
    case "In stock": return i.stock.type === "in";
    case "Veg": return i.veg;
    case "Non-veg": return !i.veg;
    case "Egg": return false;
    case "Missing images": return !i.image;
    case "Missing description": return !i.description;
    default: return true;
  }
}

function MenuPage() {
  const navigate = useNavigate();
  const cats = useApp((s) => s.categories);
  const addons = useApp((s) => s.addons);
  const r = useApp((s) => s.restaurant);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"items" | "addons">("items");
  const [q, setQ] = useState("");
  const [chips] = useState(["On hold", "Out of stock", "In stock"]);
  const [active, setActive] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [jump, setJump] = useState(false);
  const [oos, setOos] = useState<{ id: string; name: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [addonOpen, setAddonOpen] = useState(false);
  const [addon, setAddon] = useState({ name: "", group: "Toppings", price: "" });
  const [tips, setTips] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t); }, []);

  return (
    <MobileFrame>
      <header className="sticky top-0 z-30 bg-card">
        <div className="flex items-center gap-3 px-4 pt-3">
          <button aria-label="Back" onClick={() => navigate({ to: "/hub" })}><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex-1"><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Edit menu for</p><Link to="/outlet-info" className="flex items-center gap-1 text-[15px] font-bold">{r.name}<ChevronDown className="h-4 w-4" /></Link></div>
          <button aria-label="Tips" onClick={() => setTips(true)}><Lightbulb className="h-5 w-5" /></button>
        </div>
        <div className="mt-2"><UnderlineTabs tabs={[{ key: "items", label: "All items" }, { key: "addons", label: "Add ons" }]} value={tab} onChange={setTab} /></div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center px-10 py-32 text-center text-xs text-muted-foreground"><Loader2 className="mb-3 h-6 w-6 animate-spin" />Count all items, including add-ons and freebies, before pickup</div>
      ) : tab === "items" ? (
        <div className="pb-28">
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search menu" className="w-full bg-transparent text-sm outline-none" /></div>
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
              {chips.map((c) => (
                <button key={c} onClick={() => setActive(active === c ? null : c)} className={cn("flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium", active === c ? "border-foreground bg-foreground text-background" : "border-border bg-card")}>
                  {c}{active === c && <X className="h-3 w-3" />}
                </button>
              ))}
              <button aria-label="All filters" onClick={() => { setPending(active); setFilterOpen(true); }} className="shrink-0 rounded-full border border-border bg-card p-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          {cats.map((c) => {
            const items = c.items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()) && (!active || matches(i, active)));
            if (!items.length && (q || active)) return null;
            return (
              <section key={c.id} id={`menu-${c.id}`} className="border-t-8 border-muted px-4 py-3">
                <p className="font-bold">{c.name}</p>
                <div className="mt-2 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                  <div><p className="text-sm font-semibold">{c.subName} ({c.items.length})</p><p className="text-[10px] text-muted-foreground">{c.items.filter((i) => i.stock.type !== "in").length} out of stock</p></div>
                  <Toggle label={c.name} checked={c.enabled} onChange={(v) => actions.setCategoryEnabled(c.id, v)} />
                </div>
                {items.map((i) => (
                  <div key={i.id} className="border-b border-dashed border-border py-3 last:border-0">
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5"><VegMark veg={i.veg} />{i.stock.type === "hold" && <span className="rounded bg-brand px-1 text-[8px] font-bold uppercase text-primary-foreground">Item on hold</span>}</div>
                        <p className="mt-1 text-sm font-semibold">{i.name}</p>
                        <p className="text-sm">{inr(i.price)}</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">{i.image ? <img src={i.image} alt={i.name} className="h-full w-full rounded-lg object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}</div>
                        <Link to="/menu-item/$id" params={{ id: i.id }} className="-mt-2 rounded-md border border-border bg-card px-2 text-[10px] font-bold text-success">ADD +</Link>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={cn("text-[10px]", i.stock.type === "in" ? "text-muted-foreground" : "text-brand")}>{stockLabel(i.stock)}</span>
                      <Toggle label={i.name} checked={i.stock.type === "in"} onChange={(v) => {
                        if (i.stock.type === "hold") return toast.error("Item on hold. Contact support to enable it.");
                        if (v) actions.setItemStock(i.id, { type: "in" }); else setOos({ id: i.id, name: i.name });
                      }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs font-semibold">
                      <Link to="/menu-item/$id" params={{ id: i.id }} search={{ view: true }} className="flex items-center gap-1 text-muted-foreground"><Eye className="h-3.5 w-3.5" />View details</Link>
                      <Link to="/menu-item/$id" params={{ id: i.id }} className="flex items-center gap-1"><Pencil className="h-3.5 w-3.5" />Edit</Link>
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
          {(q || active) && !cats.some((c) => c.items.some((i) => i.name.toLowerCase().includes(q.toLowerCase()) && (!active || matches(i, active)))) && <EmptyState text="No items match these filters" />}
        </div>
      ) : (
        <div className="px-4 py-3 pb-28">
          {addons.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-border py-3">
              <VegMark veg={a.veg} /><div className="flex-1"><p className="text-sm font-semibold">{a.name}</p><p className="text-[11px] text-muted-foreground">{a.group} • {inr(a.price)}</p></div>
              <Toggle label={a.name} checked={a.inStock} onChange={(v) => actions.setAddonStock(a.id, v)} />
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="fixed bottom-4 left-1/2 z-30 flex w-full max-w-[430px] -translate-x-1/2 justify-end gap-2 px-4">
          <button onClick={() => setJump(true)} className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold shadow-md"><BookOpen className="h-3.5 w-3.5" />Menu</button>
          <button onClick={() => (tab === "items" ? setAddOpen(true) : setAddonOpen(true))} className="flex items-center gap-1 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background shadow-md"><Plus className="h-3.5 w-3.5" />Add</button>
        </div>
      )}

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters" footer={<PrimaryButton className="w-full" onClick={() => { setActive(pending); setFilterOpen(false); }}>Apply</PrimaryButton>}>
        <RadioRow label="All items" checked={!pending} onClick={() => setPending(null)} />
        {api.menuFilters.map((f) => <RadioRow key={f} label={f} checked={pending === f} onClick={() => setPending(f)} />)}
      </Sheet>
      <Sheet open={jump} onClose={() => setJump(false)} title="Menu">
        {cats.map((c) => <button key={c.id} onClick={() => { setJump(false); document.getElementById(`menu-${c.id}`)?.scrollIntoView({ behavior: "smooth" }); }} className="flex w-full justify-between border-b border-border py-3 text-sm last:border-0"><span>{c.name}</span><span className="text-muted-foreground">{c.items.length}</span></button>)}
      </Sheet>
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add to menu">
        <Link to="/menu-item/$id" params={{ id: "new" }} className="block border-b border-border py-3 text-sm font-semibold">+ Add new item</Link>
        <p className="pt-3 text-xs font-semibold text-muted-foreground">Add new category</p>
        <div className="flex gap-2 py-2 pb-4">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Desserts" className="flex-1 rounded-xl border border-border px-3 py-2 text-sm" />
          <PrimaryButton disabled={!newCat.trim()} onClick={() => { actions.addCategory(newCat.trim()); toast.success("Category added"); setNewCat(""); setAddOpen(false); }}>Add</PrimaryButton>
        </div>
      </Sheet>
      <Sheet open={addonOpen} onClose={() => setAddonOpen(false)} title="Add add-on" footer={<PrimaryButton className="w-full" disabled={!addon.name || !addon.price} onClick={() => { actions.addAddon({ id: "a" + Date.now(), name: addon.name, group: addon.group, price: +addon.price, veg: true, inStock: true }); setAddon({ name: "", group: "Toppings", price: "" }); setAddonOpen(false); toast.success("Add-on created"); }}>Save</PrimaryButton>}>
        <TextField label="Name" value={addon.name} onChange={(v) => setAddon({ ...addon, name: v })} />
        <TextField label="Group" value={addon.group} onChange={(v) => setAddon({ ...addon, group: v })} />
        <TextField label="Price (₹)" type="number" value={addon.price} onChange={(v) => setAddon({ ...addon, price: v })} />
      </Sheet>
      <Sheet open={tips} onClose={() => setTips(false)} title="Menu tips">
        <ul className="list-disc space-y-2 pb-4 pl-5 text-sm"><li>Items with photos get up to 30% more orders.</li><li>Keep descriptions short and mention key ingredients.</li><li>Mark items out of stock instead of rejecting orders.</li></ul>
      </Sheet>
      <OutOfStockSheet item={oos} onClose={() => setOos(null)} />
    </MobileFrame>
  );
}
