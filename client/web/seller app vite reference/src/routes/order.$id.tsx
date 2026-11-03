import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Card, Sheet, RadioRow, PrimaryButton, inr, EmptyState } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";
import { api } from "@/services/api";

export const Route = createFileRoute("/order/$id")({
  head: () => ({ meta: [{ title: "Order details — Restaurant Partner" }, { name: "description", content: "Order details." }, { property: "og:title", content: "Order details" }, { property: "og:description", content: "Order details." }] }),
  component: OrderDetail,
});

const reasons = ["Items out of stock", "Kitchen is full", "Restaurant closing soon", "Customer requested", "Other"];

function OrderDetail() {
  const { id } = Route.useParams();
  const o = useApp((s) => s.orders.find((x) => x.id === id));
  const navigate = useNavigate();
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  if (!o) return <MobileFrame><PageHeader title="Order" /><EmptyState text="This order is no longer available" /><div className="px-4"><Link to="/orders" className="block text-center text-sm font-semibold text-info">Back to orders</Link></div></MobileFrame>;
  const sub = o.items.reduce((a, i) => a + i.qty * i.price, 0);
  return (
    <MobileFrame>
      <PageHeader title={`Order #${o.shortId}`} sub={api.orderTabs.find((t) => t.key === o.status)?.label} right={<button aria-label="Print KOT" onClick={() => toast.success("KOT sent to printer")}><Printer className="h-5 w-5" /></button>} />
      <div className="space-y-3 p-4 pb-28">
        <Card>
          <p className="text-xs text-muted-foreground">ID: {o.id} • {o.placedAt}</p>
          <div className="mt-3 flex items-center justify-between">
            <div><p className="font-bold">{o.customer}</p><p className="text-xs text-muted-foreground">{o.customerOrders === 1 ? "New customer" : `${o.customerOrders} orders with you`}</p></div>
            <div className="flex gap-2">
              <a href="tel:+910000000000" aria-label="Call" className="rounded-full border border-border p-2"><Phone className="h-4 w-4" /></a>
              <button aria-label="Chat" onClick={() => toast("Chat with customer opened")} className="rounded-full border border-border p-2"><MessageCircle className="h-4 w-4" /></button>
            </div>
          </div>
        </Card>
        <Card>
          <p className="mb-2 text-sm font-bold">Items</p>
          {o.items.map((i) => (
            <div key={i.name} className="flex justify-between py-1.5 text-sm"><span>{i.qty} x {i.name}</span><span>{inr(i.qty * i.price)}</span></div>
          ))}
          <div className="mt-2 space-y-1 border-t border-dashed border-border pt-2 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Item total</span><span>{inr(sub)}</span></div>
            <div className="flex justify-between"><span>Taxes & charges</span><span>{inr(Math.max(0, o.total - sub))}</span></div>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-bold"><span>Total bill</span><span>{inr(o.total)}</span></div>
          {o.instructions && <p className="mt-3 rounded-lg bg-warning-soft p-2 text-xs">Instructions: {o.instructions}</p>}
        </Card>
        {o.rider && <Card><p className="text-xs text-muted-foreground">Delivery partner</p><p className="font-semibold">{o.rider}</p></Card>}
      </div>
      {o.status !== "completed" && (
        <div className="fixed bottom-0 left-1/2 flex w-full max-w-[430px] -translate-x-1/2 gap-2 border-t border-border bg-card p-3">
          {(o.status === "preparing" || o.status === "scheduled") && <PrimaryButton variant="outline" className="flex-1" onClick={() => setReject(true)}>Reject</PrimaryButton>}
          <PrimaryButton className="flex-1" onClick={() => {
            const map = { preparing: "ready", ready: "out", out: "completed", scheduled: "preparing" } as const;
            actions.moveOrder(o.id, map[o.status as keyof typeof map]);
            toast.success("Order updated");
          }}>
            {o.status === "preparing" ? "Order ready" : o.status === "ready" ? "Handed over" : o.status === "out" ? "Mark delivered" : "Start preparing"}
          </PrimaryButton>
        </div>
      )}
      <Sheet open={reject} onClose={() => setReject(false)} title="Reason for rejection" footer={<div className="flex gap-2"><PrimaryButton variant="outline" className="flex-1" onClick={() => setReject(false)}>Back</PrimaryButton><PrimaryButton className="flex-1" onClick={() => { actions.rejectOrder(o.id); toast("Order rejected"); navigate({ to: "/orders" }); }}>Reject order</PrimaryButton></div>}>
        {reasons.map((r) => <RadioRow key={r} label={r} checked={reason === r} onClick={() => setReason(r)} />)}
      </Sheet>
    </MobileFrame>
  );
}
