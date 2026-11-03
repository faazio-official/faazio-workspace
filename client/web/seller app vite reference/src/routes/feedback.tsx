import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Star, ChevronRight, Calendar, MessageSquare, Menu as MenuIcon, Bell } from "lucide-react";
import { toast } from "sonner";
import { OrdersShell, OutletHeader } from "@/components/app/shells";
import { PillTabs, EmptyState, Sheet, PrimaryButton } from "@/components/app/kit";
import { useApp, actions } from "@/store/app-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feedback")({
  validateSearch: (s: Record<string, unknown>): { tab?: "reviews" | "complaints" } => (s.tab === "reviews" ? { tab: "reviews" } : {}),
  head: () => ({ meta: [{ title: "Feedback — Restaurant Partner" }, { name: "description", content: "Customer complaints and reviews." }, { property: "og:title", content: "Feedback" }, { property: "og:description", content: "Customer complaints and reviews." }] }),
  component: FeedbackPage,
});

const ranges = ["Last 7 days", "Last 30 days", "Last 90 days"];

function FeedbackPage() {
  const initial = Route.useSearch().tab ?? "complaints";
  const [tab, setTab] = useState<"complaints" | "reviews">(initial);
  const reviews = useApp((s) => s.reviews);
  const complaints = useApp((s) => s.complaints);
  const r = useApp((s) => s.restaurant);
  const [q, setQ] = useState("");
  const [range, setRange] = useState(ranges[0]);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [stars, setStars] = useState<number | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const list = reviews.filter((x) => (!stars || x.rating === stars) && (x.customer.toLowerCase().includes(q.toLowerCase()) || x.orderId.includes(q)));

  const header = (
    <header className="sticky top-0 z-30 bg-card px-4 pb-3 pt-3">
      <div className="flex items-center gap-2">
        <OutletHeader showData />
        <Link to="/notifications" className="p-1.5" aria-label="Notifications"><Bell className="h-5 w-5" /></Link>
        <Link to="/explore" className="p-1.5" aria-label="Explore more"><MenuIcon className="h-5 w-5" /></Link>
      </div>
      <div className="mt-3"><PillTabs tabs={[{ key: "complaints", label: "Complaints" }, { key: "reviews", label: "Reviews" }]} value={tab} onChange={setTab} /></div>
    </header>
  );

  return (
    <OrdersShell header={header}>
      {tab === "complaints" ? (
        <div className="px-4 pt-3">
          <button onClick={() => setRangeOpen(true)} className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-xs">
            <span><b>{range}</b> <span className="text-muted-foreground">• Compared with previous period</span></span><Calendar className="h-4 w-4" />
          </button>
          {complaints.length === 0 ? <EmptyState icon={<MessageSquare className="h-12 w-12" strokeWidth={1.2} />} text="No complaints found" /> : null}
        </div>
      ) : (
        <div className="space-y-3 px-4 pt-3">
          <Link to="/outlet-info" className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <span className="rounded-md bg-success px-1.5 py-0.5 text-xs font-bold text-primary-foreground">{r.rating}★</span>
            <span className="flex-1 text-xs"><b>{r.ratingCount} ratings • {reviews.length} reviews</b><br /><span className="text-muted-foreground">Delivery ratings</span></span>
            <ChevronRight className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviews" className="w-full bg-transparent text-sm outline-none" />
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {[5, 4, 3, 2, 1].map((n) => (
              <button key={n} onClick={() => setStars(stars === n ? null : n)} className={cn("flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs", stars === n ? "border-foreground bg-foreground text-background" : "border-border bg-card")}>{n}<Star className="h-3 w-3" /></button>
            ))}
          </div>
          <p className="text-sm font-bold">Reviews ({list.length})</p>
          {list.length === 0 && <EmptyState text="No reviews found" />}
          {list.map((rv) => (
            <div key={rv.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] text-muted-foreground">Order #{rv.orderId} • {r.name}, {r.area}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">{rv.customer[0]}</span>
                <div className="flex-1"><p className="text-sm font-bold">{rv.customer}</p><p className="text-[10px] text-muted-foreground">{rv.customerOrders} order{rv.customerOrders > 1 ? "s" : ""} with you</p></div>
                <span className="text-[10px] text-muted-foreground">{rv.date}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground", rv.rating >= 4 ? "bg-success" : "bg-warning")}>{rv.rating}★</span>
                <span className="text-[11px] text-muted-foreground">{rv.items.join(", ")}</span>
              </div>
              {rv.text && <p className="mt-2 text-sm">{rv.text}</p>}
              {rv.replied ? (
                <p className="mt-2 rounded-lg bg-muted p-2 text-xs"><b>Your reply:</b> {rv.replied}</p>
              ) : (
                <button onClick={() => { setReplyFor(rv.id); setReply(""); }} className="mt-3 text-xs font-semibold text-info">Reply</button>
              )}
            </div>
          ))}
        </div>
      )}
      <Sheet open={rangeOpen} onClose={() => setRangeOpen(false)} title="Select date range">
        {ranges.map((x) => <button key={x} onClick={() => { setRange(x); setRangeOpen(false); }} className="block w-full border-b border-border py-3 text-left text-sm last:border-0">{x}</button>)}
      </Sheet>
      <Sheet open={!!replyFor} onClose={() => setReplyFor(null)} title="Reply to review" footer={<PrimaryButton className="w-full" disabled={!reply.trim()} onClick={() => { actions.replyReview(replyFor!, reply.trim()); setReplyFor(null); toast.success("Reply posted"); }}>Post reply</PrimaryButton>}>
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} placeholder="Thank the customer…" className="w-full rounded-xl border border-border p-3 text-sm outline-none focus:border-info" />
      </Sheet>
    </OrdersShell>
  );
}
