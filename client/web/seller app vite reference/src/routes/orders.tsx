import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { X, ClipboardList, Receipt, Clock, Zap } from "lucide-react";
import { toast } from "sonner";
import { OrdersShell, OrdersTopBar, OrdersHeaderIcons } from "@/components/app/shells";
import { PromoBanner } from "@/components/app/promo";
import { PillTabs, EmptyState, Sheet, inr } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";
import { api } from "@/services/api";
import type { Order, OrderStatus } from "@/mocks/orders";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Orders — Restaurant Partner" }, { name: "description", content: "Live orders for your outlet." }, { property: "og:title", content: "Orders — Restaurant Partner" }, { property: "og:description", content: "Live orders for your outlet." }] }),
  component: OrdersPage,
});

const next: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  preparing: { to: "ready", label: "Order ready" },
  ready: { to: "out", label: "Handed over" },
  out: { to: "completed", label: "Mark delivered" },
  scheduled: { to: "preparing", label: "Start preparing" },
};

export function OrderCard({ o }: { o: Order }) {
  const n = next[o.status];
  const qty = o.items.reduce((a, i) => a + i.qty, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {o.priority && <div className="flex items-center gap-1 bg-info-soft px-4 py-1.5 text-[11px] font-bold text-info"><Zap className="h-3 w-3" />PRIORITY</div>}
      <Link to="/order/$id" params={{ id: o.id }} className="block p-4">
        <span className="rounded bg-success px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">Delivery</span>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <p className="text-base font-bold">#{o.shortId}</p>
            <p className="text-[11px] text-muted-foreground">{o.customer} • {o.customerOrders === 1 ? "New customer" : `${o.customerOrders}th order`}</p>
          </div>
          <span className="text-[11px] text-muted-foreground">{o.placedAt}</span>
        </div>
        <div className="mt-3 space-y-2 border-t border-dashed border-border pt-3 text-xs">
          <div className="flex justify-between"><span className="flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5" />Details</span><span>{qty} items</span></div>
          <div className="flex justify-between"><span className="flex items-center gap-2"><Receipt className="h-3.5 w-3.5" />Total bill</span><span className="font-semibold">{inr(o.total)} {o.paid && <span className="ml-1 rounded bg-success-soft px-1 text-[9px] text-success">PAID</span>}</span></div>
        </div>
        {o.instructions && <p className="mt-2 rounded-lg bg-warning-soft px-2 py-1 text-[11px]">“{o.instructions}”</p>}
        {o.rider && <p className="mt-2 text-[11px] text-muted-foreground">Delivery partner: <b className="text-foreground">{o.rider}</b></p>}
      </Link>
      {n && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/50 px-4 py-2.5">
          <span className="flex flex-1 items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{o.prepMins} mins prep</span>
          <button
            onClick={() => {
              actions.moveOrder(o.id, n.to);
              toast.success(`#${o.shortId} moved to ${api.orderTabs.find((t) => t.key === n.to)?.label}`);
            }}
            className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
          >
            {n.label}
          </button>
        </div>
      )}
    </div>
  );
}

function OrdersPage() {
  const orders = useApp((s) => s.orders);
  const online = useApp((s) => s.online);
  const silent = useApp((s) => s.silentBanner);
  const [tab, setTab] = useState<OrderStatus>("preparing");
  const [search, setSearch] = useState(false);
  const [scan, setScan] = useState(false);
  const [q, setQ] = useState("");
  const list = orders.filter((o) => o.status === tab);
  const tabs = api.orderTabs.map((t) => ({ ...t, count: orders.filter((o) => o.status === t.key).length || undefined }));
  const found = orders.filter((o) => q && (o.shortId.includes(q) || o.id.includes(q) || o.customer.toLowerCase().includes(q.toLowerCase())));

  return (
    <OrdersShell header={<OrdersTopBar extra={<OrdersHeaderIcons onSearch={() => setSearch(true)} onScan={() => setScan(true)} />} />}>
      {silent && (
        <div className="flex items-center justify-between bg-warning-soft px-4 py-2 text-[11px]">
          <span>Ring in silent mode is disabled. <Link to="/communications" className="font-semibold underline">Troubleshoot</Link></span>
          <button aria-label="Dismiss" onClick={actions.hideSilentBanner}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      <div className="space-y-3 px-4 pt-3">
        <PromoBanner />
        {!online && (
          <Link to="/restaurant-status" className="block rounded-xl bg-brand-soft px-4 py-2.5 text-xs font-semibold text-brand">You are offline and not receiving new orders. Tap to go online →</Link>
        )}
        <PillTabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === "completed" && <Link to="/order-history" className="block rounded-xl bg-info-soft px-4 py-2.5 text-xs text-info">Want to see orders older than today? <b>View order history</b></Link>}
        {list.length === 0 ? (
          <EmptyState text={`No orders are currently ${tab === "completed" ? "completed" : "in " + tabs.find((t) => t.key === tab)?.label.toLowerCase()}`} />
        ) : (
          <div className="space-y-3">{list.map((o) => <OrderCard key={o.id} o={o} />)}</div>
        )}
      </div>

      <Sheet open={search} onClose={() => { setSearch(false); setQ(""); }} title="Search orders">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order ID or customer name" className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-info" />
        <div className="mt-3 space-y-2 pb-4">
          {found.map((o) => (
            <Link key={o.id} to="/order/$id" params={{ id: o.id }} className="flex justify-between rounded-xl border border-border p-3 text-sm">
              <span>#{o.shortId} • {o.customer}</span><span className="text-xs text-muted-foreground">{api.orderTabs.find((t) => t.key === o.status)?.label}</span>
            </Link>
          ))}
          {q && !found.length && <p className="py-6 text-center text-xs text-muted-foreground">No matching orders</p>}
        </div>
      </Sheet>
      <Sheet open={scan} onClose={() => setScan(false)} title="Scan rider QR">
        <div className="mx-auto my-4 flex aspect-square w-56 items-center justify-center rounded-2xl border-2 border-dashed border-info text-xs text-muted-foreground">Point camera at delivery partner's QR</div>
        <button onClick={() => { setScan(false); toast.success("Rider verified for #8599"); }} className="mb-3 w-full rounded-xl bg-foreground py-3 text-sm font-semibold text-background">Simulate scan</button>
      </Sheet>
    </OrdersShell>
  );
}
