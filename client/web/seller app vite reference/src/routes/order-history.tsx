import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Calendar, ChevronRight, Bell, Menu as MenuIcon, ArrowLeft } from "lucide-react";
import { MobileFrame, OutletHeader } from "@/components/app/shells";
import { Sheet, EmptyState, inr } from "@/components/app/kit";
import { useApp } from "@/store/app-store";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/order-history")({
  head: () => ({ meta: [{ title: "Order history — Restaurant Partner" }, { name: "description", content: "Search past orders." }, { property: "og:title", content: "Order history" }, { property: "og:description", content: "Search past orders." }] }),
  component: History,
});

const ranges = ["Last 5 days", "Last 7 days", "Last 30 days"];

function History() {
  const router = useRouter();
  const orders = useApp((s) => s.orders);
  const r = useApp((s) => s.restaurant);
  const [q, setQ] = useState("");
  const [range, setRange] = useState(ranges[0]);
  const [open, setOpen] = useState(false);
  const list = orders.filter((o) => o.id.includes(q) || o.shortId.includes(q));
  return (
    <MobileFrame>
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-card px-4 py-3">
        <button aria-label="Back" onClick={() => router.history.back()}><ArrowLeft className="h-5 w-5" /></button>
        <OutletHeader showData />
        <Link to="/notifications" className="p-1" aria-label="Notifications"><Bell className="h-5 w-5" /></Link>
        <Link to="/explore" className="p-1" aria-label="Explore more"><MenuIcon className="h-5 w-5" /></Link>
      </header>
      <div className="space-y-3 px-4 pb-10 pt-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value.replace(/\D/g, ""))} placeholder="Search by order ID" className="w-full bg-transparent text-sm outline-none" /></div>
        <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between text-xs"><span><b>{range}</b><br /><span className="text-muted-foreground">{list.length} orders</span></span><Calendar className="h-4 w-4" /></button>
        {list.length === 0 && <EmptyState text="No orders found" />}
        {list.map((o) => (
          <Link key={o.id} to="/order/$id" params={{ id: o.id }} className="block rounded-2xl border border-border bg-card p-4">
            <div className="flex gap-1">
              <span className="rounded bg-success px-1.5 text-[9px] font-bold uppercase text-primary-foreground">{o.status === "completed" ? "Delivered" : o.status}</span>
              {o.customerOrders > 3 && <span className="rounded bg-info-soft px-1.5 text-[9px] font-bold uppercase text-info">Repeat</span>}
            </div>
            <div className="mt-2 flex justify-between text-sm"><b>ID: {o.id}</b><span className="text-[11px] text-muted-foreground">{o.placedAt}</span></div>
            <p className="text-[11px] text-muted-foreground">{r.name}, {r.area}</p>
            {o.rider && <p className="mt-2 text-[11px] text-muted-foreground">Delivered by {o.rider}</p>}
            <div className="mt-2 flex justify-between border-t border-dashed border-border pt-2 text-xs">
              <span>{o.items.map((i) => `${i.qty} x ${i.name}`).join(", ")}</span><span className="flex items-center font-semibold">{inr(o.total)}<ChevronRight className="h-3.5 w-3.5" /></span>
            </div>
          </Link>
        ))}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Select date range">
        {ranges.map((x) => <button key={x} onClick={() => { setRange(x); setOpen(false); }} className="block w-full border-b border-border py-3 text-left text-sm last:border-0">{x}</button>)}
      </Sheet>
    </MobileFrame>
  );
}
