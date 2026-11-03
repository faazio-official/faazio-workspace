import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Upload, Calendar, Download, ChevronRight, MoreVertical, Info } from "lucide-react";
import { toast } from "sonner";
import { HubShell } from "@/components/app/shells";
import { PillTabs, Card, Sheet, inr } from "@/components/app/kit";
import { PromoBanner } from "@/components/app/promo";
import { LineSpark, Bars } from "@/components/app/charts";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";

export const Route = createFileRoute("/hub")({
  head: () => ({ meta: [{ title: "Business Hub — Restaurant Partner" }, { name: "description", content: "Sales, funnel, service quality and kitchen insights." }, { property: "og:title", content: "Business Hub" }, { property: "og:description", content: "Sales, funnel, service quality and kitchen insights." }] }),
  component: Hub,
});

type Tab = "feed" | "sales" | "funnel" | "quality" | "kitchen";
const ranges = ["Yesterday", "Last 7 days", "Last 30 days", "This month"];

function Hub() {
  const [tab, setTab] = useState<Tab>("feed");
  const [range, setRange] = useState(ranges[0]);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const orders = useApp((s) => s.orders);
  const h = api.hub;
  const todaySales = orders.filter((o) => o.status === "completed").reduce((a, o) => a + o.total, 0);

  const DateBar = (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
      <span><b>{range} • 31 Oct 26</b><br /><span className="text-[10px] text-muted-foreground">{h.salesSummary.compared}</span></span>
      <span className="flex gap-2">
        <button aria-label="Change dates" onClick={() => setRangeOpen(true)} className="rounded-lg border border-border p-1.5"><Calendar className="h-4 w-4" /></button>
        <button aria-label="Download report" onClick={() => toast.success("Report will be emailed to you")} className="rounded-lg border border-border p-1.5"><Download className="h-4 w-4" /></button>
      </span>
    </div>
  );

  return (
    <HubShell sticky={<div className="mt-3"><PillTabs tabs={[{ key: "feed", label: "My Feed" }, { key: "sales", label: "Sales" }, { key: "funnel", label: "Funnel" }, { key: "quality", label: "Service quality" }, { key: "kitchen", label: "Kitchen" }]} value={tab} onChange={setTab} /></div>}>
      <div className="space-y-3 px-4 pt-3">
        {tab === "feed" && (
          <>
            <PromoBanner />
            <Card>
              <div className="flex items-start justify-between">
                <div><p className="flex items-center gap-1 text-sm font-bold">Onboarding benefits <Info className="h-3 w-3" /></p><p className="text-[10px] font-semibold text-brand">{uploaded ? "UNLOCKED" : "LOCKED"}</p></div>
                <Lock className="h-5 w-5" />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm">✨ ₹1,500 worth of ads</p>
              <p className="mt-2 rounded-lg bg-muted p-2 text-[11px]">☐ Upload 10 menu images to unlock benefits {uploaded && "✓"}</p>
              <label className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-semibold text-background">
                <Upload className="h-4 w-4" />Upload image
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) { setUploaded(true); toast.success(`${e.target.files.length} image(s) uploaded for review`); } }} />
              </label>
            </Card>
            <Card>
              <p className="text-sm font-bold">Today so far</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-muted-foreground">Total sales</p><p className="text-lg font-bold">{inr(todaySales)}</p></div>
                <div><p className="text-muted-foreground">Total orders <span className="ml-1 rounded bg-success-soft px-1 text-[9px] font-bold text-success">● Live</span></p><p className="text-lg font-bold">{orders.length}</p></div>
              </div>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">Orders will be coming your way soon</p>
            </Card>
          </>
        )}
        {tab === "sales" && (
          <>
            {DateBar}
            <Card>
              <div className="flex justify-between"><div><p className="text-sm font-bold">Sales</p><p className="text-[10px] text-muted-foreground">Last updated: few seconds ago</p></div><MoreVertical className="h-4 w-4" /></div>
              {[{ l: "Net sales", v: inr(h.salesSummary.netSales), d: h.salesSummary.netSalesDelta }, { l: "Orders delivered", v: String(h.salesSummary.ordersDelivered), d: h.salesSummary.ordersDelta }, { l: "Avg. order value", v: inr(h.salesSummary.aov), d: h.salesSummary.aovDelta }].map((m) => (
                <div key={m.l} className="mt-3 flex items-center gap-3">
                  <div className="w-24 shrink-0"><p className="text-[10px] text-muted-foreground">{m.l}</p><p className="text-sm font-bold">{m.v} <span className="text-[10px] font-medium text-brand">{m.d}</span></p></div>
                  <LineSpark data={h.salesSummary.hourly} height={34} />
                </div>
              ))}
              <p className="mt-2 text-center text-[10px] text-muted-foreground">— Yesterday  - - Same day last week</p>
            </Card>
            <Card>
              <div className="flex justify-between"><p className="text-sm font-bold">Sales & orders</p><MoreVertical className="h-4 w-4" /></div>
              <div className="mt-2 flex gap-6 text-xs"><div><p className="text-muted-foreground">Net sales</p><b>{inr(h.salesSummary.netSales)}</b></div><div><p className="text-muted-foreground">Orders delivered</p><b>{h.salesSummary.ordersDelivered}</b></div></div>
              <Bars data={h.salesSummary.hourly} />
            </Card>
            <Card>
              <p className="text-sm font-bold">Average order value</p>
              <p className="text-lg font-bold">{inr(h.salesSummary.aov)} <span className="text-xs text-success">{h.salesSummary.aovDelta}</span></p>
              <LineSpark data={h.salesSummary.hourly} />
            </Card>
            <Card>
              <div className="flex justify-between"><div><p className="text-sm font-bold">Orders by mealtime</p><p className="text-[10px] text-muted-foreground">Last updated: few seconds ago</p></div><MoreVertical className="h-4 w-4" /></div>
              {h.mealtimes.map((m) => (
                <div key={m.name} className="flex items-center justify-between border-b border-border py-2 text-xs last:border-0">
                  <span>• <b>{m.name}</b><br /><span className="ml-2 text-[10px] text-muted-foreground">{m.time}</span></span>
                  <span><b>{m.orders}</b> <span className="text-[10px] text-muted-foreground">{m.delta}</span></span>
                </div>
              ))}
            </Card>
            <HelpBox />
          </>
        )}
        {tab === "funnel" && (
          <>
            {DateBar}
            <Card>
              <p className="text-sm font-bold">Customer funnel</p>
              {h.funnel.map((f, i) => (
                <div key={f.label} className="mt-3">
                  <div className="flex justify-between text-xs"><span>{f.label}</span><b>{f.value} <span className="font-medium text-brand">{f.delta}</span></b></div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-info" style={{ width: `${Math.max(4, 100 / (i * 3 + 1))}%` }} /></div>
                </div>
              ))}
            </Card>
            <HelpBox />
          </>
        )}
        {tab === "quality" && (
          <>
            {DateBar}
            {h.serviceQuality.map((s) => (
              <Card key={s.label} className="flex items-center justify-between">
                <span className="text-sm">{s.label}</span><span className={s.good ? "font-bold text-success" : "font-bold text-brand"}>{s.value}</span>
              </Card>
            ))}
            <Link to="/feedback" search={{ tab: "complaints" }} className="block text-center text-xs font-semibold text-info">View complaints →</Link>
          </>
        )}
        {tab === "kitchen" && (
          <>
            {DateBar}
            {h.kitchenMetrics.map((s) => <Card key={s.label} className="flex justify-between"><span className="text-sm">{s.label}</span><b>{s.value}</b></Card>)}
            <Link to="/rush-hour" className="block rounded-xl bg-info-soft p-3 text-xs text-info">Kitchen getting busy? <b>Turn on rush hour →</b></Link>
          </>
        )}
      </div>
      <Sheet open={rangeOpen} onClose={() => setRangeOpen(false)} title="Select date range">
        {ranges.map((x) => <button key={x} onClick={() => { setRange(x); setRangeOpen(false); }} className="block w-full border-b border-border py-3 text-left text-sm last:border-0">{x}</button>)}
      </Sheet>
    </HubShell>
  );
}

function HelpBox() {
  const links: Record<string, string> = { "Manage outlets": "/outlet-info", "Offers and ads": "/growth", Payouts: "/finance", "See all options": "/help-centre" };
  return (
    <div className="pb-4">
      <p className="px-1 pb-2 pt-3 text-sm font-bold">How can we help you?</p>
      <div className="rounded-2xl border border-border bg-card">
        {api.hub.helpTopics.map((t) => (
          <Link key={t} to={links[t]} className="flex items-center justify-between border-b border-border px-4 py-3 text-xs last:border-0">{t}<ChevronRight className="h-4 w-4" /></Link>
        ))}
      </div>
      <p className="mt-6 text-2xl font-black italic text-muted-foreground/40">zomato</p>
    </div>
  );
}
