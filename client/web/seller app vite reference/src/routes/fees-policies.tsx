import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Store, ChevronDown } from "lucide-react";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Sheet, RadioRow } from "@/components/app/kit";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";

export const Route = createFileRoute("/fees-policies")({
  head: () => ({ meta: [{ title: "Fees and policies — Restaurant Partner" }, { name: "description", content: "Service fee, compensation and rejection policies." }, { property: "og:title", content: "Fees and policies" }, { property: "og:description", content: "Service fee, compensation and rejection policies." }] }),
  component: Fees,
});

const langs = ["English", "हिन्दी", "தமிழ்", "മലയാളം"];

function Fees() {
  const r = useApp((s) => s.restaurant);
  const f = api.finance.feeInfo;
  const [lang, setLang] = useState(langs[0]);
  const [open, setOpen] = useState(false);
  return (
    <MobileFrame>
      <PageHeader title="Fees and policies" />
      <div className="flex gap-2 px-4 pt-3">
        <button onClick={() => setOpen(true)} className="flex flex-1 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs"><Globe className="h-4 w-4" />{lang}<ChevronDown className="ml-auto h-3 w-3" /></button>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border px-3 py-2 text-[10px]"><Store className="h-4 w-4 shrink-0" /><span className="truncate"><b>{r.name}</b><br />{r.city}</span></div>
      </div>
      <div className="space-y-3 p-4 pb-10">
        <div className="rounded-2xl border border-border bg-card p-4 text-xs">
          <p className="mb-2 text-sm font-bold">Service fee</p>
          <div className="flex justify-between py-1"><span className="text-muted-foreground">Restaurant ID</span><b>{f.restaurantId}</b></div>
          <div className="flex justify-between py-1"><span className="text-muted-foreground">Base service fees (% of gross sales)</span><b>{f.baseServiceFee}</b></div>
          <div className="flex justify-between py-1"><span className="text-muted-foreground">Payment gateway charges</span><b>{f.paymentGateway}</b></div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-xs">
          <p className="mb-2 text-sm font-bold">Compensation Policy</p>
          {f.compensation.map((c) => <div key={c.cond} className="py-2"><p className="text-muted-foreground">{c.cond}</p><span className="mt-1 inline-block rounded-md bg-muted px-2 py-1 font-semibold">{c.value}</span></div>)}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-xs">
          <p className="mb-2 text-sm font-bold">Rejection charges</p>
          {f.rejection.map((c) => <div key={c.cond} className="py-2"><p className="text-muted-foreground">{c.cond}</p><p className="mt-1 rounded-md bg-muted px-2 py-1 font-semibold">{c.value}</p></div>)}
        </div>
        <a href="https://www.zomato.com/policies/terms-of-service" target="_blank" rel="noreferrer" className="block text-xs font-semibold text-info">Read our terms and conditions →</a>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Select language">
        {langs.map((l) => <RadioRow key={l} label={l} checked={lang === l} onClick={() => { setLang(l); setOpen(false); }} />)}
      </Sheet>
    </MobileFrame>
  );
}
