import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar, Download, ChevronRight, FileText, Megaphone, RotateCcw, Receipt, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { HubShell } from "@/components/app/shells";
import { PillTabs, Card, Sheet, inr, RadioRow } from "@/components/app/kit";
import { api } from "@/services/api";
import type { PayoutCycle } from "@/mocks/finance";

export const Route = createFileRoute("/finance")({
  validateSearch: (s: Record<string, unknown>): { tab?: "invoices" | "payouts" } => (s.tab === "invoices" ? { tab: "invoices" } : {}),
  head: () => ({ meta: [{ title: "Finance — Restaurant Partner" }, { name: "description", content: "Payouts, invoices and taxes." }, { property: "og:title", content: "Finance" }, { property: "og:description", content: "Payouts, invoices and taxes." }] }),
  component: Finance,
});

const icons = { "online-ordering": FileText, ads: Megaphone, recovery: RotateCcw, tds: Receipt } as const;

function Finance() {
  const t0 = Route.useSearch().tab ?? "payouts";
  const [tab, setTab] = useState<"payouts" | "invoices">(t0);
  const f = api.finance;
  const [detail, setDetail] = useState<PayoutCycle | "current" | null>(null);
  const [cycle, setCycle] = useState(f.pastCycles[0].id);
  const [pick, setPick] = useState(false);
  const cyc = f.pastCycles.find((c) => c.id === cycle)!;

  return (
    <HubShell showData={false} sticky={<div className="mt-3"><PillTabs tabs={[{ key: "payouts", label: "Payouts" }, { key: "invoices", label: "Invoices & Taxes" }]} value={tab} onChange={setTab} /></div>}>
      <div className="space-y-3 px-4 pt-3">
        {tab === "payouts" ? (
          <>
            <p className="text-sm font-bold">Current cycle</p>
            <Card>
              <p className="text-[11px] text-muted-foreground">{f.currentCycle.label}</p>
              <p className="text-2xl font-bold">{inr(f.currentCycle.amount)}</p>
              <p className="text-[11px] text-muted-foreground">{f.currentCycle.orders} orders</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-muted-foreground">Payout for</p><b>{f.currentCycle.payoutFor}</b></div>
                <div><p className="text-muted-foreground">Payout date</p><b>{f.currentCycle.payoutDate}</b></div>
              </div>
              <button onClick={() => setDetail("current")} className="mt-3 w-full text-center text-xs font-semibold text-info">View details →</button>
            </Card>
            <p className="pt-2 text-sm font-bold">Past cycles</p>
            <div className="flex gap-2">
              <button onClick={() => setPick(true)} className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs"><Calendar className="h-4 w-4" />{cyc.range}<ChevronDown className="ml-auto h-4 w-4" /></button>
              <button onClick={() => toast.success(`Report for ${cyc.range} sent to your email`)} className="flex items-center gap-1 rounded-xl bg-foreground px-3 text-xs font-semibold text-background"><Download className="h-3.5 w-3.5" />Get report</button>
            </div>
            {f.pastCycles.map((c) => (
              <Card key={c.id}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Net payout</p><p className="text-base font-bold">{inr(c.netPayout)}</p><p className="text-[10px] text-muted-foreground">{c.orders} orders</p></div>
                  <div><p className="text-muted-foreground">Status</p><span className="rounded bg-success-soft px-1.5 text-[10px] font-bold text-success">{c.status}</span></div>
                  <div><p className="text-muted-foreground">Payout for</p><b>{c.payoutFor}</b></div>
                  <div><p className="text-muted-foreground">Payout date</p><b>{c.payoutDate}</b></div>
                </div>
                <button onClick={() => setDetail(c)} className="mt-3 w-full text-center text-xs font-semibold text-info">View details →</button>
              </Card>
            ))}
          </>
        ) : (
          <>
            <p className="text-sm font-bold">Download invoices</p>
            {f.invoiceGroups.filter((g) => g.section === "invoices").map((g) => <InvoiceRow key={g.type} g={g} />)}
            <p className="pt-2 text-sm font-bold">Download tax receipts</p>
            {f.invoiceGroups.filter((g) => g.section === "tax").map((g) => <InvoiceRow key={g.type} g={g} />)}
          </>
        )}
      </div>
      <Sheet open={!!detail} onClose={() => setDetail(null)} title="Payout details">
        {detail === "current" ? (
          <div className="pb-4 text-sm"><p className="text-muted-foreground">Estimated payout for {f.currentCycle.payoutFor}</p><p className="my-2 text-2xl font-bold">{inr(f.currentCycle.amount)}</p><p className="text-xs text-muted-foreground">Final amount will be calculated after the cycle closes.</p></div>
        ) : detail ? (
          <div className="pb-4">
            {detail.breakdown.map((b) => <div key={b.label} className="flex justify-between border-b border-border py-2.5 text-sm"><span>{b.label}</span><span>{b.amount < 0 ? "-" : ""}{inr(Math.abs(b.amount))}</span></div>)}
            <div className="flex justify-between pt-3 font-bold"><span>Net payout</span><span>{inr(detail.netPayout)}</span></div>
            <p className="mt-2 text-xs text-muted-foreground">Paid on {detail.payoutDate} • UTR: AXIS{detail.id.toUpperCase()}88231</p>
          </div>
        ) : null}
      </Sheet>
      <Sheet open={pick} onClose={() => setPick(false)} title="Select cycle">
        {f.pastCycles.map((c) => <RadioRow key={c.id} label={c.range} checked={cycle === c.id} onClick={() => { setCycle(c.id); setPick(false); }} />)}
      </Sheet>
    </HubShell>
  );
}

function InvoiceRow({ g }: { g: (typeof api.finance.invoiceGroups)[number] }) {
  const Icon = icons[g.type];
  return (
    <Link to="/invoices/$type" params={{ type: g.type }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-info text-primary-foreground"><Icon className="h-6 w-6" /></span>
      <span className="flex-1"><b className="text-sm">{g.title}</b><br /><span className="text-[11px] text-muted-foreground">{g.sub}</span></span>
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}
