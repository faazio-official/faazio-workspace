"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Calendar, ChevronRight, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { OutletHeader } from "@/components/sellers/shells";
import { SellerHamburger } from "@/components/sellers/hamburger";
import { Sheet, EmptyState } from "@/components/sellers/kit";
import { useOrders, useSellerScope } from "@/lib/api/hooks";
import { formatDateTime, formatINR } from "@/lib/format";
import { orderStatusLabel } from "@/lib/sector";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "all", label: "All time" },
];

function OrderHistory() {
  const router = useRouter();
  const { sellerId, storeId } = useSellerScope();
  const orders = useOrders({ sellerId, storeId });
  const [q, setQ] = useState("");
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]!);
  const [open, setOpen] = useState(false);

  const cutoff =
    range.key === "all" ? null : Date.now() - Number(range.key) * 24 * 3600 * 1000;
  const ql = q.replace(/\D/g, "").toLowerCase();
  const list = [...orders]
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    .filter((o) => (cutoff ? new Date(o.placedAt).getTime() >= cutoff : true))
    .filter((o) => (ql ? o.orderId.toLowerCase().includes(ql) || o.customerName.toLowerCase().includes(ql) : true));

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-card px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          aria-label="Back"
          onClick={() => router.back()}
          className="rounded-full p-1 hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <OutletHeader showData />
        <SellerHamburger />
      </header>
      <div className="space-y-3 px-4 pb-10 pt-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by order ID"
            className="w-full bg-transparent text-sm outline-none"
          />
          {q && (
            <button aria-label="Clear search" onClick={() => setQ("")} className="p-0.5 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between text-xs"
        >
          <span className="text-left">
            <b>{range.label}</b>
            <br />
            <span className="text-muted-foreground">{list.length} orders</span>
          </span>
          <Calendar className="h-4 w-4" />
        </button>
        {list.length === 0 && <EmptyState text="No orders found in this range" />}
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((o) => (
            <Link
              key={o.orderId}
              href={`/seller/orders/${encodeURIComponent(o.orderId)}`}
              className="block rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex gap-1">
                <span
                  className={cn(
                    "rounded px-1.5 text-[9px] font-bold uppercase text-primary-foreground",
                    o.status === "DELIVERED" ? "bg-success" : o.status === "CANCELLED" ? "bg-warning" : "bg-info",
                  )}
                >
                  {orderStatusLabel(o.status, o.sector)}
                </span>
                {o.status === "DELIVERED" && o.amountPaisa > 0 && (
                  <span className="rounded bg-info-soft px-1.5 text-[9px] font-bold uppercase text-info">
                    Repeat
                  </span>
                )}
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <b className="min-w-0 truncate">ID: {o.orderId}</b>
                <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                  {formatDateTime(o.placedAt)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{o.customerName}</p>
              <div className="mt-2 flex justify-between border-t border-dashed border-border pt-2 text-xs">
                <span>{o.itemsCount} items</span>
                <span className="flex items-center font-semibold">
                  {formatINR(o.amountPaisa)} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Select date range">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => {
              setRange(r);
              setOpen(false);
            }}
            className="block w-full border-b border-border py-3 text-left text-sm last:border-0"
          >
            {r.label}
          </button>
        ))}
      </Sheet>
    </>
  );
}

export default OrderHistory;