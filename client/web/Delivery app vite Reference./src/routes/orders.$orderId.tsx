import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { MapPin, Navigation, Phone, Store, Check, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { BackHeader, RequireAuth } from "@/components/partner/Shell";
import { OrderChips, fmtDateTime, statusLabel } from "@/components/partner/Badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SwipeAction } from "@/components/partner/SwipeAction";
import { TripMap } from "@/components/partner/TripMap";
import { grandTotal, itemTotal, earnings, usePartner } from "@/lib/partner/store";
import { needsPin, stages } from "@/lib/partner/rules";
import { demoTrip } from "@/mocks";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/orders/$orderId")({ head: ({ params }) => ({ meta: [{ title: `#${params.orderId} · ZIP Partner` }, { name: "description", content: "Pickup checks, delivery progress and payment details." }, { property: "og:title", content: `Delivery ${params.orderId} · ZIP Partner` }, { property: "og:description", content: "Pickup checks, delivery progress and payment details." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: () => <RequireAuth><Details /></RequireAuth> });
function Section({ label, children }: { label: string; children: ReactNode }) {
  return <section className="border-b py-5"><h2 className="mb-4 text-xs font-bold text-muted-foreground">{label}</h2>{children}</section>;
}
function Party({ name, address, phone, pickup, orderId }: { name: string; address: string; phone: string; pickup?: boolean; orderId: string }) {
  const Icon = pickup ? Store : MapPin;
  return <div className="flex items-start gap-3"><Icon className="mt-1 h-5 w-5 shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="text-sm font-bold">{name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{address}</p><div className="mt-3 flex gap-2"><Button asChild size="sm" variant="secondary"><a href={`tel:${phone}`} aria-label={`Call ${name}`}><Phone />Call</a></Button><Button asChild size="sm" variant="outline"><Link to="/navigation/$orderId" params={{ orderId }} aria-label={`Navigate to ${name}`}><Navigation />Navigate</Link></Button></div></div></div>;
}
function Details() {
  const { orderId } = Route.useParams();
  const { orders, advance, checkedItems, toggleItem } = usePartner();
  const [verify, setVerify] = useState(false);
  const [pin, setPin] = useState("");
  const [cash, setCash] = useState(false);
  const [error, setError] = useState("");
  const o = orders.find((x) => x.id === orderId);
  if (!o) return <div><BackHeader title="Order"/><div className="p-8 text-center"><p>Order not found</p><Button asChild variant="link"><Link to="/">Back to orders</Link></Button></div></div>;
  const checked = checkedItems[o.id] ?? [];
  const ready = o.items.every((item) => checked.includes(item.name));
  const step = stages.indexOf(o.status);
  const labels = { assigned: "Arrived at store", at_store: "Swipe to confirm pickup", picked_up: "Arrived at drop-off", at_dropoff: "Swipe to deliver", delivered: "Delivered" };
  function progress() {
    if (!o) return;
    if (o.status === "at_dropoff" && needsPin(o)) { setVerify(true); return; }
    if (advance(o.id)) toast.success(o.status === "at_dropoff" ? "Order delivered!" : "Delivery progress updated");
  }
  const row = (label: string, value: number) => <div className="flex justify-between py-1.5 text-xs"><span className="text-muted-foreground">{label}</span><span>₹{value}</span></div>;
  return <div className="min-h-screen pb-28"><BackHeader title={o.id}/>
    <div className="px-5 py-5"><div className="flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Your earnings</p><p className="mt-1 text-4xl font-extrabold">₹{earnings(o)}</p></div><span className="text-xs text-success">₹{o.tip} tip included</span></div><div className="mt-4"><OrderChips order={o}/></div><p className="mt-3 text-center text-[10px] text-muted-foreground">{fmtDateTime(o.createdAt)}</p></div>
    <TripMap />
    <div className="flex items-center justify-between border-b px-5 py-3 text-xs"><span className="flex items-center gap-1"><Navigation className="h-4 w-4 text-primary"/>{demoTrip.pickupKm + demoTrip.dropKm} km</span><span className="flex items-center gap-1"><Clock className="h-4 w-4 text-primary"/>{demoTrip.minutes} min estimate</span></div>
    <div className="px-5"><Section label="DELIVERY PROGRESS"><ol className="flex justify-between gap-1">{stages.map((status, index) => <li key={status} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs", index <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{index < step || o.status === "delivered" ? <Check className="h-3 w-3"/> : index + 1}</span><span className={cn("text-[9px] leading-3", index === step ? "font-bold text-primary" : "text-muted-foreground")}>{statusLabel[status]}</span></li>)}</ol></Section>
      <Section label="PICKUP FROM"><Party {...o.restaurant} orderId={o.id} pickup/></Section><Section label="DELIVER TO"><Party {...o.customer} orderId={o.id}/></Section>
      <Section label={`ITEMS · ${o.items.length}`}><div className="space-y-4">{o.items.map((item) => <label key={item.name} className="flex items-center gap-3 text-sm">{o.status === "assigned" || o.status === "at_store" ? <Checkbox aria-label={`Check ${item.name}`} checked={checked.includes(item.name)} onCheckedChange={() => toggleItem(o.id, item.name)} className="h-5 w-5"/> : <Check className="h-4 w-4 text-success"/>}<span className="flex-1">{item.name}</span><span className="text-xs text-muted-foreground">× {item.qty}</span></label>)}</div></Section>
      <Section label="BILL SUMMARY">{row("Item total", itemTotal(o))}{row("Delivery fee", o.deliveryFee)}{o.packingCharge > 0 && row("Packing charge", o.packingCharge)}{row("Tip for you", o.tip)}<div className="mt-3 flex justify-between border-t pt-3 text-sm font-bold"><span>Order total</span><span>₹{grandTotal(o)}</span></div>{o.payment === "cod" ? <p className="mt-3 text-xs font-medium text-destructive">{o.status === "delivered" ? "Collected" : "Collect"} ₹{grandTotal(o)} in cash</p> : <p className="mt-3 text-xs font-medium text-success">Paid online · No cash to collect</p>}</Section>
    </div>
    {o.status !== "delivered" ? <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t bg-card p-4">{o.status === "assigned" || o.status === "picked_up" ? <Button className="h-12 w-full" onClick={progress}><MapPin />{labels[o.status]}<ArrowRight /></Button> : <SwipeAction key={o.status} label={labels[o.status]} disabled={o.status === "at_store" && !ready} onConfirm={progress}/>}</div> : <div className="mx-5 mt-5 flex items-center justify-center gap-2 py-4 text-sm font-semibold text-success"><Check className="h-5 w-5"/>Delivery completed</div>}
    <Dialog open={verify} onOpenChange={(open) => { setVerify(open); setError(""); }}><DialogContent className="max-w-[min(390px,calc(100%-32px))] rounded-lg"><DialogTitle>Confirm delivery</DialogTitle><DialogDescription>Ask {o.customer.name} for the 4-digit delivery PIN.</DialogDescription><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (advance(o.id, pin, cash)) { setVerify(false); toast.success("Order delivered!"); } else setError(o.payment === "cod" && !cash ? "Confirm cash collection before completing delivery." : "Incorrect PIN. Please check with the customer."); }}><Input aria-label="Delivery PIN" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} className="h-14 text-center text-2xl"/><p className="text-xs text-muted-foreground">Demo customer PIN: {demoTrip.deliveryPin}</p>{o.payment === "cod" && <label className="flex items-center gap-3 text-sm"><Checkbox checked={cash} onCheckedChange={(value) => setCash(value === true)} aria-label="Cash collected"/>Collected ₹{grandTotal(o)} in cash</label>}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<Button type="submit" className="h-12 w-full">Verify & complete</Button></form></DialogContent></Dialog>
  </div>;
}
