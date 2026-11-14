import { CreditCard, Wallet, Zap } from "lucide-react";
import type { Order } from "@/mocks";
import { cn } from "@/lib/utils";

export const statusLabel = { assigned: "Assigned", at_store: "At Store", picked_up: "Picked Up", at_dropoff: "At Drop-off", delivered: "Delivered" } as const;

export function StatusText({ status }: { status: Order["status"] }) {
  return <span className={cn("text-[11px] font-medium", status === "delivered" ? "text-success" : "text-primary")}>{statusLabel[status]}</span>;
}

export function OrderChips({ order }: { order: Order }) {
  const chip = "inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[11px] font-medium text-primary";
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className={chip}>{order.payment === "cod" ? <Wallet className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}{order.payment === "cod" ? "COD" : "online"}</span>
      <span className={chip}><Zap className="h-3 w-3" />{order.type}</span>
      <span className={cn("rounded-md px-2 py-1 text-[11px] font-semibold", order.status === "delivered" ? "bg-success text-success-foreground" : "bg-card text-primary")}>{statusLabel[order.status]}</span>
    </div>
  );
}

export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const fmtShort = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
