import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Star, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Sheet, TextField, PrimaryButton } from "@/components/app/kit";
import { useApp, setState } from "@/store/app-store";

export const Route = createFileRoute("/outlet-info")({
  head: () => ({ meta: [{ title: "Outlet info — Restaurant Partner" }, { name: "description", content: "Restaurant information and address." }, { property: "og:title", content: "Outlet info" }, { property: "og:description", content: "Restaurant information and address." }] }),
  component: OutletInfo,
});

function OutletInfo() {
  const r = useApp((s) => s.restaurant);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: r.name, cuisines: r.cuisines, address: r.address });
  return (
    <MobileFrame>
      <PageHeader title="Outlet info" right={<span className="text-[10px] text-muted-foreground">ID: {r.id}</span>} />
      <div className="relative h-44 overflow-hidden bg-brand-soft">
        <img src={r.coverImage} alt="Outlet cover" className="h-full w-full object-cover" />
        <label className="absolute right-3 top-3 cursor-pointer rounded-lg bg-card px-2 py-1 text-[10px] font-semibold">
          Replace image<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setState((s) => ({ restaurant: { ...s.restaurant, coverImage: URL.createObjectURL(f) } })); toast.success("Cover image updated"); } }} />
        </label>
      </div>
      <div className="-mt-6 space-y-3 px-4 pb-10">
        <div className="relative rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="inline-flex items-center gap-1 rounded bg-success px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{r.rating}<Star className="h-2.5 w-2.5" /></span>
          <span className="ml-2 text-[10px] text-muted-foreground">DELIVERY • {r.ratingCount} ratings</span>
          <div className="mt-3 flex items-center justify-between"><h2 className="font-bold">Restaurant information</h2><button aria-label="Edit" onClick={() => setEdit(true)}><Pencil className="h-4 w-4 text-info" /></button></div>
          <p className="mt-3 text-[10px] uppercase text-muted-foreground">Restaurant name</p><p className="text-sm font-semibold">{r.name}</p>
          <p className="mt-3 text-[10px] uppercase text-muted-foreground">Cuisines</p><p className="text-sm">{r.cuisines}</p>
          <p className="mt-3 text-[10px] uppercase text-muted-foreground">Restaurant address</p>
          <p className="flex gap-1 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{r.address}</p>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(r.address)}`} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-semibold text-info">View on map</a>
        </div>
        {[{ l: "Outlet timings", to: "/outlet-timings" }, { l: "Contact details", to: "/staff" }, { l: "Important contacts", to: "/contacts" }, { l: "View all reviews", to: "/feedback" }].map((x) => (
          <Link key={x.l} to={x.to} search={x.to === "/feedback" ? { tab: "reviews" } : undefined as never} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm">{x.l}<ChevronRight className="h-4 w-4" /></Link>
        ))}
      </div>
      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit restaurant information" footer={<PrimaryButton className="w-full" onClick={() => { setState((s) => ({ restaurant: { ...s.restaurant, ...form } })); setEdit(false); toast.success("Update request submitted"); }}>Save</PrimaryButton>}>
        <TextField label="Restaurant name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <TextField label="Cuisines" value={form.cuisines} onChange={(v) => setForm({ ...form, cuisines: v })} />
        <TextField label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
      </Sheet>
    </MobileFrame>
  );
}
