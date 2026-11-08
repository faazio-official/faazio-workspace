"use client";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, EmptyState } from "@/components/sellers/kit";
import { formatINR } from "@/lib/format";
import { advanceOrder } from "@/lib/api";
import { usePortalLoading, useOrders, useSellerScope } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

function SellerReturns() {
  const { sellerId, storeId } = useSellerScope();
  const loading = usePortalLoading();
  const returns = useOrders({ sellerId, storeId }).filter(
    (o) => o.status === "RETURNED" || o.status === "CANCELLED",
  );

  return (
    <>
      <PageHeader title="Returns" sub="Operations" />
      <div className="space-y-3 px-4 pt-3 pb-8">
        {loading && returns.length === 0 ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : returns.length === 0 ? (
          <EmptyState
            icon={<RotateCcw className="h-12 w-12" strokeWidth={1.2} />}
            text="No open returns — return requests from shoppers land in this queue"
          />
        ) : (
          returns.map((order) => (
            <div key={order.orderId} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold">#{order.orderId}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{order.customerName}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                    order.status === "RETURNED"
                      ? "bg-brand-soft text-brand"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  {order.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Order value</p>
                  <b>{formatINR(order.amountPaisa)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">Refund from settlement</p>
                  <b>{formatINR(order.amountPaisa)}</b>
                </div>
              </div>
              {order.status === "RETURNED" && (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => {
                      advanceOrder(order.orderId, "DELIVERED");
                      toast.success("Return rejected — order stays delivered");
                    }}
                    className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-brand"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      advanceOrder(order.orderId, "RETURNED");
                      toast.success("Return approved, refund queued");
                    }}
                    className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default SellerReturns;