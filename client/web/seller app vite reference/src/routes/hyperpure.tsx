import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Minus, Plus, ShoppingCart, Menu as MenuIcon } from "lucide-react";
import { toast } from "sonner";
import { OrdersShell } from "@/components/app/shells";
import { Sheet, PrimaryButton, inr, EmptyState } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";
import { api } from "@/services/api";

export const Route = createFileRoute("/hyperpure")({
  head: () => ({ meta: [{ title: "Hyperpure — Restaurant Partner" }, { name: "description", content: "Order kitchen supplies." }, { property: "og:title", content: "Hyperpure" }, { property: "og:description", content: "Order kitchen supplies." }] }),
  component: Hyperpure,
});

function Hyperpure() {
  const cart = useApp((s) => s.cart);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const products = api.help.hyperpureProducts;
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = products.reduce((a, p) => a + (cart[p.id] ?? 0) * p.price, 0);
  const header = (
    <header className="sticky top-0 z-30 bg-card px-4 pb-3 pt-3">
      <div className="flex items-center gap-2">
        <div className="flex-1"><p className="text-[15px] font-bold">Hyperpure</p><p className="text-[11px] text-muted-foreground">Fresh supplies, delivered next morning</p></div>
        <button onClick={() => setOpen(true)} className="relative p-1.5" aria-label="Cart"><ShoppingCart className="h-5 w-5" />{count > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand px-1 text-[9px] font-bold text-primary-foreground">{count}</span>}</button>
        <Link to="/explore" className="p-1.5" aria-label="Explore more"><MenuIcon className="h-5 w-5" /></Link>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border px-3 py-2"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full bg-transparent text-sm outline-none" /></div>
    </header>
  );
  return (
    <OrdersShell header={header}>
      <div className="grid grid-cols-2 gap-3 p-4">
        {products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="mb-2 flex aspect-square items-center justify-center rounded-xl bg-muted text-3xl">🛒</div>
            <p className="text-sm font-semibold leading-tight">{p.name}</p>
            <p className="text-[11px] text-muted-foreground">{p.unit}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold">{inr(p.price)}</span>
              {cart[p.id] ? (
                <span className="flex items-center gap-2 rounded-lg border border-success px-1.5 py-0.5 text-success">
                  <button aria-label="Decrease" onClick={() => actions.addToCart(p.id, -1)}><Minus className="h-3 w-3" /></button>
                  <b className="text-xs">{cart[p.id]}</b>
                  <button aria-label="Increase" onClick={() => actions.addToCart(p.id, 1)}><Plus className="h-3 w-3" /></button>
                </span>
              ) : (
                <button onClick={() => actions.addToCart(p.id, 1)} className="rounded-lg border border-success px-3 py-0.5 text-xs font-bold text-success">ADD</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Your cart" footer={count ? <PrimaryButton className="w-full" onClick={() => { actions.clearCart(); setOpen(false); toast.success("Order placed! Delivery tomorrow by 8 AM"); }}>Place order • {inr(total)}</PrimaryButton> : undefined}>
        {!count && <EmptyState text="Your cart is empty" />}
        {products.filter((p) => cart[p.id]).map((p) => (
          <div key={p.id} className="flex justify-between border-b border-border py-2.5 text-sm"><span>{cart[p.id]} x {p.name}</span><span>{inr(cart[p.id] * p.price)}</span></div>
        ))}
      </Sheet>
    </OrdersShell>
  );
}
