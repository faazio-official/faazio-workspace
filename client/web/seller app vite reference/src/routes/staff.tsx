import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { User, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Sheet, TextField, PrimaryButton, RadioRow } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Contact details — Restaurant Partner" }, { name: "description", content: "Owner, managers and staff access." }, { property: "og:title", content: "Contact details" }, { property: "og:description", content: "Owner, managers and staff access." }] }),
  component: Staff,
});

function Staff() {
  const staff = useApp((s) => s.staff);
  const r = useApp((s) => s.restaurant);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", role: "Manager" as "Manager" | "Staff" });
  const owner = staff.find((s) => s.role === "Owner");
  const section = (role: "Manager" | "Staff", label: string) => {
    const list = staff.filter((s) => s.role === role);
    return (
      <div className="border-b border-border py-4">
        <p className="text-sm font-bold">{label}</p>
        {list.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No {label.toLowerCase()} added. <button onClick={() => { setForm({ name: "", phone: "", role }); setOpen(true); }} className="font-semibold text-info">Invite user</button></p>}
        {list.map((s) => (
          <div key={s.id} className="mt-2 flex items-center gap-3"><User className="h-8 w-8 rounded-full bg-muted p-1.5" /><span className="flex-1 text-sm">{s.name}<br /><span className="text-xs text-muted-foreground">{s.phone}</span></span><button aria-label="Remove" onClick={() => { actions.removeStaff(s.id); toast("User removed"); }}><Trash2 className="h-4 w-4" /></button></div>
        ))}
      </div>
    );
  };
  return (
    <MobileFrame>
      <PageHeader title="Contact details" right={<button onClick={() => setPerm(true)} className="text-xs font-semibold text-info">View permissions</button>} />
      <div className="px-4 pb-24">
        <div className="border-b border-border py-4">
          <p className="text-sm font-bold">Owner</p>
          <div className="mt-2 flex items-center gap-3"><User className="h-8 w-8 rounded-full bg-muted p-1.5" /><span className="flex-1 text-sm">{owner?.name}<br /><span className="text-xs text-muted-foreground">{owner?.phone}<br />{r.ownerEmail}</span></span><Pencil className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-2 text-[10px] text-muted-foreground">Logged in on 1 device</p>
        </div>
        {section("Manager", "Manager")}
        {section("Staff", "Staff")}
      </div>
      <div className="fixed bottom-0 left-1/2 flex w-full max-w-[430px] -translate-x-1/2 justify-end p-4"><PrimaryButton variant="info" onClick={() => { setForm({ name: "", phone: "", role: "Manager" }); setOpen(true); }}>Invite user</PrimaryButton></div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Invite user" footer={<PrimaryButton className="w-full" disabled={!form.name || !/^\d{10}$/.test(form.phone)} onClick={() => { actions.addStaff({ id: "s" + Date.now(), name: form.name, phone: "+91 " + form.phone, role: form.role }); setOpen(false); toast.success(`Invite sent to ${form.name}`); }}>Send invite</PrimaryButton>}>
        <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <TextField label="Mobile number" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })} />
        <RadioRow label="Manager" sub="Can manage menu, orders & settings" checked={form.role === "Manager"} onClick={() => setForm({ ...form, role: "Manager" })} />
        <RadioRow label="Staff" sub="Can only manage orders" checked={form.role === "Staff"} onClick={() => setForm({ ...form, role: "Staff" })} />
      </Sheet>
      <Sheet open={perm} onClose={() => setPerm(false)} title="Permissions">
        <div className="space-y-2 pb-4 text-sm"><p><b>Owner:</b> Full access including payouts</p><p><b>Manager:</b> Orders, menu, timings, reviews</p><p><b>Staff:</b> Orders and inventory only</p></div>
      </Sheet>
    </MobileFrame>
  );
}
