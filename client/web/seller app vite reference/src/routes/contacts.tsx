import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Sheet, TextField, PrimaryButton } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Important contacts — Restaurant Partner" }, { name: "description", content: "Order reminder and restaurant page numbers." }, { property: "og:title", content: "Important contacts" }, { property: "og:description", content: "Order reminder and restaurant page numbers." }] }),
  component: Contacts,
});

type Key = "orderReminder" | "restaurantPage";

function Contacts() {
  const c = useApp((s) => s.contacts);
  const [adding, setAdding] = useState<Key | null>(null);
  const [phone, setPhone] = useState("");
  const block = (key: Key, title: string, sub: string, Icon: typeof Bell, cta?: string) => (
    <div className="border-b border-border py-4">
      <p className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4" />{title}</p>
      <p className="ml-6 text-[11px] text-muted-foreground">{sub}</p>
      {cta && <button onClick={() => { setAdding(key); setPhone(""); }} className="ml-6 mt-2 text-xs font-semibold text-info">+ {cta}</button>}
      {c[key].map((p, i) => (
        <div key={p} className="ml-6 mt-2 flex items-center justify-between">
          <span><span className="block text-[10px] text-muted-foreground">{key === "orderReminder" ? `Order reminder number #${i + 1}` : "Restaurant page number"}</span><span className="text-sm">{p}</span></span>
          {c[key].length > 1 && <button aria-label="Remove" onClick={() => actions.removeContact(key, p)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>}
        </div>
      ))}
      {!cta && <button onClick={() => { setAdding(key); setPhone(""); }} className="ml-6 mt-2 text-xs font-semibold text-info">+ Add number</button>}
    </div>
  );
  return (
    <MobileFrame>
      <PageHeader title="Important contacts" />
      <div className="px-4">
        {block("orderReminder", "Order reminder numbers", "We will call these numbers if you miss accepting an order", Bell, "Add order reminder number")}
        {block("restaurantPage", "Restaurant page number", "Number to be displayed to customers on your restaurant page", Phone)}
        <Link to="/staff" className="block py-4 text-xs font-semibold text-info">Manage contact details for your staff</Link>
      </div>
      <Sheet open={!!adding} onClose={() => setAdding(null)} title="Add number" footer={<PrimaryButton className="w-full" disabled={!/^\d{10}$/.test(phone)} onClick={() => { actions.addContact(adding!, "+91 " + phone); setAdding(null); toast.success("Number added"); }}>Save</PrimaryButton>}>
        <TextField label="10-digit mobile number" type="tel" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))} />
      </Sheet>
    </MobileFrame>
  );
}
