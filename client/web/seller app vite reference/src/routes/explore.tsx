import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Info, Clock, Phone, Users, Settings, Bell, Bike, Hourglass, CalendarOff, History, AlertCircle, Star, HelpCircle, GraduationCap,
  PenSquare, FileText, Wallet, Files, Receipt, Search, X,
} from "lucide-react";
import { toast } from "sonner";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, Sheet, RadioRow, PrimaryButton } from "@/components/app/kit";
import { api } from "@/services/api";
import { useApp, actions } from "@/store/app-store";

export const Route = createFileRoute("/explore")({
  head: () => ({ meta: [{ title: "Explore more — Restaurant Partner" }, { name: "description", content: "All outlet tools and settings." }, { property: "og:title", content: "Explore more" }, { property: "og:description", content: "All outlet tools and settings." }] }),
  component: Explore,
});

type Tile = { label: string; icon: typeof Info; to?: string; search?: Record<string, string>; action?: "schedule"; badge?: string };

function Explore() {
  const rush = useApp((s) => s.rush);
  const off = useApp((s) => s.scheduleOff);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [reason, setReason] = useState(api.scheduleOffReasons[0]);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const sections: { title: string; tiles: Tile[] }[] = [
    { title: "Manage outlet", tiles: [
      { label: "Outlet info", icon: Info, to: "/outlet-info" },
      { label: "Outlet timings", icon: Clock, to: "/outlet-timings" },
      { label: "Phone numbers", icon: Phone, to: "/contacts" },
      { label: "Manage staff", icon: Users, to: "/staff" },
    ] },
    { title: "Settings", tiles: [
      { label: "Settings", icon: Settings, to: "/settings" },
      { label: "Manage communication", icon: Bell, to: "/communications" },
      { label: "Delivery settings", icon: Bike, to: "/restaurant-status" },
      { label: "Rush hour", icon: Hourglass, to: "/rush-hour", badge: rush.on ? "ON" : "OFF" },
      { label: off ? "Schedule off (active)" : "Schedule off", icon: CalendarOff, action: "schedule" },
    ] },
    { title: "Orders", tiles: [
      { label: "Order history", icon: History, to: "/order-history" },
      { label: "Complaints", icon: AlertCircle, to: "/feedback", search: { tab: "complaints" } },
      { label: "Reviews", icon: Star, to: "/feedback", search: { tab: "reviews" } },
    ] },
    { title: "Help", tiles: [
      { label: "Help centre", icon: HelpCircle, to: "/help-centre" },
      { label: "Learning centre", icon: GraduationCap, to: "/learning-centre" },
      { label: "Share your feedback", icon: PenSquare, to: "/share-feedback" },
      { label: "Fees & policies", icon: FileText, to: "/fees-policies" },
    ] },
    { title: "Accounting", tiles: [
      { label: "Payout", icon: Wallet, to: "/finance", search: { tab: "payouts" } },
      { label: "Invoices", icon: Files, to: "/finance", search: { tab: "invoices" } },
      { label: "Taxes", icon: Receipt, to: "/invoices/tds" },
    ] },
  ];

  const tileEl = (t: Tile) => {
    const inner = (
      <>
        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <t.icon className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <span className="mt-1.5 text-center text-[10px] leading-tight text-muted-foreground">{t.label}</span>
        {t.badge && <span className={`mt-0.5 rounded px-1 text-[8px] font-bold text-primary-foreground ${t.badge === "ON" ? "bg-success" : "bg-brand"}`}>{t.badge}</span>}
      </>
    );
    return t.action ? (
      <button key={t.label} onClick={() => (off ? setStep(2) : setStep(1))} className="flex flex-col items-center">{inner}</button>
    ) : (
      <Link key={t.label} to={t.to!} search={t.search as never} className="flex flex-col items-center">{inner}</Link>
    );
  };

  const filtered = sections.map((s) => ({ ...s, tiles: s.tiles.filter((t) => t.label.toLowerCase().includes(q.toLowerCase())) })).filter((s) => s.tiles.length);

  return (
    <MobileFrame>
      <PageHeader title="Explore more" right={<div className="flex items-center gap-2"><button aria-label="Search" onClick={() => setSearching((v) => !v)}>{searching ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}</button><Link to="/outlet-info" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold">BJ</Link></div>} />
      {searching && <div className="px-4 pt-3"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for a feature" className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-info" /></div>}
      <div className="px-4 pb-10">
        {filtered.map((s) => (
          <section key={s.title} className="border-b border-border py-4 last:border-0">
            <h2 className="mb-3 text-sm font-bold">{s.title}</h2>
            <div className="grid grid-cols-4 gap-y-4">{s.tiles.map(tileEl)}</div>
          </section>
        ))}
      </div>

      <Sheet open={step === 1} onClose={() => setStep(0)} title="Reason for scheduling time off" footer={<div className="flex gap-2"><PrimaryButton variant="outline" className="flex-1" onClick={() => setStep(0)}>Back</PrimaryButton><PrimaryButton className="flex-1" onClick={() => setStep(2)}>Continue</PrimaryButton></div>}>
        {api.scheduleOffReasons.map((r) => <RadioRow key={r} label={r} checked={reason === r} onClick={() => setReason(r)} />)}
      </Sheet>
      <Sheet open={step === 2} onClose={() => setStep(0)} title={off ? "Scheduled time off" : "Select time off duration"} footer={
        off ? <PrimaryButton className="w-full" onClick={() => { actions.setScheduleOff(null); setStep(0); toast.success("Time off cancelled. You're back online"); }}>Cancel time off</PrimaryButton>
          : <div className="flex gap-2"><PrimaryButton variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</PrimaryButton><PrimaryButton className="flex-1" disabled={to < from} onClick={() => { actions.setScheduleOff({ reason, from, to }); setStep(0); toast.success("Time off scheduled. Outlet is now offline"); }}>Confirm</PrimaryButton></div>
      }>
        {off ? (
          <div className="pb-2 text-sm"><p><b>Reason:</b> {off.reason}</p><p className="mt-1"><b>From:</b> {off.from} <b className="ml-2">To:</b> {off.to}</p></div>
        ) : (
          <div className="space-y-3 pb-2">
            <label className="block text-xs text-muted-foreground">From<input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground" /></label>
            <label className="block text-xs text-muted-foreground">To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm text-foreground" /></label>
            <p className="rounded-lg bg-warning-soft p-2 text-[11px]">You will not receive orders during this period.</p>
          </div>
        )}
      </Sheet>
    </MobileFrame>
  );
}
