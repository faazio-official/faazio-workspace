import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Loader2, FileX } from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, EmptyState } from "@/components/app/kit";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import type { InvoiceType } from "@/mocks/finance";

export const Route = createFileRoute("/invoices/$type")({
  head: () => ({ meta: [{ title: "Invoices — Restaurant Partner" }, { name: "description", content: "Download monthly invoices." }, { property: "og:title", content: "Invoices" }, { property: "og:description", content: "Download monthly invoices." }] }),
  component: Invoices,
});

function Invoices() {
  const { type } = Route.useParams();
  const r = useApp((s) => s.restaurant);
  const inv = api.finance.invoices[type as InvoiceType] ?? api.finance.invoices.ads;
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t); }, [type]);
  return (
    <MobileFrame>
      <PageHeader title={r.name} sub={`ID: ${r.id} • ${r.city}`} />
      {loading ? (
        <div className="flex justify-center py-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : inv.items.length === 0 ? (
        <EmptyState icon={<FileX className="h-12 w-12" strokeWidth={1.2} />} text={type === "tds" ? "Your TDS will appear here once available" : "Your invoices will appear here once available"} />
      ) : (
        <div className="p-4">
          <p className="text-base font-bold">{inv.title}</p>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">{inv.fy}</p>
          {inv.items.map((i) => (
            <div key={i.ref} className="mt-3 flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <span><b className="text-sm">{i.month}</b><br /><span className="text-[10px] text-muted-foreground">{i.ref}</span></span>
              <button aria-label="Download" onClick={() => toast.success(`${i.month} invoice downloaded`)} className="rounded-full border border-border p-2"><Download className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </MobileFrame>
  );
}
