import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Toggle, Sheet, RadioRow, PrimaryButton, TextField } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";

export const Route = createFileRoute("/restaurant-status")({
  head: () => ({ meta: [{ title: "Restaurant status — Restaurant Partner" }, { name: "description", content: "Go online or offline and manage delivery settings." }, { property: "og:title", content: "Restaurant status" }, { property: "og:description", content: "Go online or offline and manage delivery settings." }] }),
  component: Status,
});

const offReasons = ["Kitchen is full", "Staff shortage", "Closing early today", "Technical issue", "Other"];

function Status() {
  const online = useApp((s) => s.online);
  const rush = useApp((s) => s.rush);
  const r = useApp((s) => s.restaurant);
  const d = useApp((s) => s.delivery);
  const timings = useApp((s) => s.timings);
  const [off, setOff] = useState(false);
  const [reason, setReason] = useState(offReasons[0]);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ minOrder: String(d.minOrder), packagingCharge: String(d.packagingCharge), radiusKm: String(d.radiusKm) });
  const today = timings[(new Date().getDay() + 6) % 7];
  return (
    <MobileFrame>
      <PageHeader title="Restaurant status" sub="" />
      <div className="space-y-3 p-4 pb-10">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-bold">{r.name}</p><p className="text-[11px] text-muted-foreground">{r.area}</p>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span><b className="text-sm">Delivery status</b><br /><span className={`text-xs ${online ? "text-success" : "text-brand"}`}>{online ? "Online — receiving orders" : "Offline — not receiving orders"}</span></span>
            <Toggle label="Delivery status" checked={online} onChange={(v) => (v ? (actions.setOnline(true), toast.success("You're online")) : setOff(true))} />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span><b className="text-sm">Self delivery</b><br /><span className="text-xs text-muted-foreground">Deliver orders with your own riders</span></span>
            <Toggle label="Self delivery" checked={d.selfDelivery} onChange={(v) => actions.setDelivery({ selfDelivery: v })} />
          </div>
          <Link to="/rush-hour" className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm"><b>Rush mode</b><span className="flex items-center gap-1 text-xs">{rush.on ? `ON till ${rush.until}` : "OFF"}<ChevronRight className="h-4 w-4" /></span></Link>
          <Link to="/outlet-timings" className="mt-3 block border-t border-border pt-3 text-xs"><span className="text-muted-foreground">Next scheduled timings</span><br /><b>{today.open ? today.slots.map((s) => `${s.from} - ${s.to}`).join(", ") : "Closed today"}</b></Link>
        </div>
        {!online && <p className="flex gap-2 rounded-xl bg-brand-soft p-3 text-xs text-brand"><Info className="h-4 w-4 shrink-0" />You are currently offline. Customers cannot place orders.</p>}
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <div className="flex justify-between"><b>Delivery settings</b><button onClick={() => setEdit(true)} className="text-xs font-semibold text-info">Edit</button></div>
          <div className="mt-2 space-y-1 text-xs text-muted-foreground"><p>Minimum order: ₹{d.minOrder}</p><p>Packaging charge: ₹{d.packagingCharge}</p><p>Delivery radius: {d.radiusKm} km</p></div>
        </div>
        <Link to="/settings" className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm">App settings<ChevronRight className="h-4 w-4" /></Link>
      </div>
      <Sheet open={off} onClose={() => setOff(false)} title="Why are you going offline?" footer={<div className="flex gap-2"><PrimaryButton variant="outline" className="flex-1" onClick={() => setOff(false)}>Back</PrimaryButton><PrimaryButton className="flex-1" onClick={() => { actions.setOnline(false); setOff(false); toast("You're offline"); }}>Go offline</PrimaryButton></div>}>
        {offReasons.map((x) => <RadioRow key={x} label={x} checked={reason === x} onClick={() => setReason(x)} />)}
      </Sheet>
      <Sheet open={edit} onClose={() => setEdit(false)} title="Delivery settings" footer={<PrimaryButton className="w-full" onClick={() => { actions.setDelivery({ minOrder: +form.minOrder, packagingCharge: +form.packagingCharge, radiusKm: +form.radiusKm }); setEdit(false); toast.success("Delivery settings saved"); }}>Save</PrimaryButton>}>
        <TextField label="Minimum order (₹)" type="number" value={form.minOrder} onChange={(v) => setForm({ ...form, minOrder: v })} />
        <TextField label="Packaging charge (₹)" type="number" value={form.packagingCharge} onChange={(v) => setForm({ ...form, packagingCharge: v })} />
        <TextField label="Delivery radius (km)" type="number" value={form.radiusKm} onChange={(v) => setForm({ ...form, radiusKm: v })} />
      </Sheet>
    </MobileFrame>
  );
}
