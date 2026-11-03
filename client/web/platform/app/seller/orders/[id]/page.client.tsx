"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { PageHeader, Card, EmptyState, Sheet, RadioRow, SectorBadge } from "@/components/sellers/kit";
import { formatDateTime, formatINR } from "@/lib/format";
import { acceptOrder, advanceOrder, rejectOrder } from "@/lib/api";
import { useOrder, useActiveStore } from "@/lib/api/hooks";
import { orderStatusLabel } from "@/lib/sector";
import type { OrderRecord, OrderStatus } from "@/data/types";

const FLOW: OrderStatus[] = ["NEW", "PACKED", "SHIPPED", "DELIVERED"];
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  PACKED: "Handed over",
  SHIPPED: "Mark delivered",
};
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PACKED: "SHIPPED",
  SHIPPED: "DELIVERED",
};

const REJECT_BY_SECTOR: Record<string, string[]> = {
  FOOD: ["Items out of stock", "Kitchen is full", "Restaurant closing soon", "Customer requested", "Other"],
  DEFAULT: ["Items out of stock", "Shop closed", "Customer requested", "Other"],
};

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const order = useOrder(id);
  const { stores, setActiveStoreId } = useActiveStore();
  const [rejecting, setRejecting] = useState(false);
  const sector = order?.sector;
  const rejectReasons = REJECT_BY_SECTOR[sector ?? "DEFAULT"] ?? REJECT_BY_SECTOR["DEFAULT"]!;
  const [reason, setReason] = useState<string>(rejectReasons[0]!);

  // The order may arrive after first render (order loads async); keep the selected reason valid for
  // the order's sector so a food excuse never leaks to a Mart/Pharmacy order.
  useEffect(() => {
    setReason((current) => (rejectReasons.includes(current) ? current : rejectReasons[0]!));
  }, [rejectReasons]);

  // A push deep link (seller app) may land on an order belonging to a non-active vendor. Resolve the
  // order's store and switch the console scope so the shell header and lists match the shop.
  useEffect(() => {
    if (!order?.storeId) return;
    if (stores.some((s) => s.storeId === order.storeId)) {
      setActiveStoreId(order.storeId);
    }
  }, [order?.storeId, stores, setActiveStoreId]);

  if (!order) {
    return (
      <div className="px-4 pt-4">
        <PageHeader title="Order" />
        <EmptyState text="This order is no longer available" />
        <Link href="/seller/orders" className="block text-center text-sm font-semibold text-info">
          Back to orders
        </Link>
      </div>
    );
  }

  const currentIndex = FLOW.indexOf(order.status);
  const next = NEXT_STATUS[order.status];
  const hoursLeft = (new Date(order.slaDueAt).getTime() - Date.now()) / 3600000;

  return (
    <>
      <PageHeader
        title={`Order #${order.orderId}`}
        {...(FLOW.includes(order.status) ? {} : { sub: order.status })}
        right={
          <button
            aria-label={sector === "FOOD" ? "Print KOT" : "Print"}
            onClick={() => toast.success(sector === "FOOD" ? "KOT sent to printer" : "Sent to printer")}
            className="rounded-full p-1.5 hover:bg-muted"
          >
            <Printer className="h-5 w-5" />
          </button>
        }
      />
      <div className="space-y-3 p-4 pb-36">
        <Card>
          <p className="text-xs text-muted-foreground">
            ID: {order.orderId} • {formatDateTime(order.placedAt)}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate font-bold">{order.customerName}</p>
              <p className="text-xs text-muted-foreground">
                {order.city ? `${order.city}, ${order.stateCode}` : order.sector}
              </p>
            </div>
            <span className="shrink-0">
              <SectorBadge sector={order.sector} />
            </span>
          </div>
        </Card>

        <Card>
          <p className="mb-2 text-sm font-bold">Summary</p>
          <dl className="space-y-1 text-sm">
            <Row label="Order value" value={formatINR(order.amountPaisa)} bold />
            <Row label="Items" value={`${order.itemsCount}`} />
            <Row label="Placed" value={formatDateTime(order.placedAt)} />
            <Row label="SLA due" value={formatDateTime(order.slaDueAt)} />
            <Row
              label="SLA countdown"
              value={hoursLeft > 0 ? `${hoursLeft.toFixed(1)} h left` : `${Math.abs(hoursLeft).toFixed(1)} h overdue`}
            />
            <Row label="Delivery address" value="Masked until dispatch · revealed on handover" />
            <Row label="Store" value={order.storeId || "—"} />
          </dl>
        </Card>

        <Card>
          <p className="mb-3 text-sm font-bold">Timeline</p>
          <ol className="space-y-3">
            {FLOW.map((stage, index) => (
              <li key={stage} className="flex items-center gap-2 text-sm">
                <span
                  className={
                    index <= currentIndex ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-border"
                  }
                />
                <span className={index <= currentIndex ? "font-medium" : "text-muted-foreground"}>
                  {orderStatusLabel(stage, sector)}
                </span>
                {index === currentIndex && (
                  <span className="ml-auto rounded bg-info-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-info">
                    Current
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {order.status === "NEW" || next ? (
        <div className="fixed bottom-[76px] left-1/2 flex w-full max-w-[430px] -translate-x-1/2 gap-2 border-t border-border bg-card p-3 md:bottom-0 md:max-w-[1024px]">
          {order.status === "NEW" && (
            <button
              onClick={() => setRejecting(true)}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
            >
              Reject
            </button>
          )}
          <button
            onClick={() => {
              if (order.status === "NEW") {
                acceptOrder(order.orderId);
                toast.success("Order accepted");
              } else if (next) {
                advanceOrder(order.orderId, next);
                toast.success(`Moved to ${next}`);
              }
            }}
            className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
          >
            {order.status === "NEW" ? "Accept order" : NEXT_LABEL[order.status]}
          </button>
        </div>
      ) : null}

      <Sheet
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Reason for rejection"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setRejecting(false)}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
            >
              Back
            </button>
            <button
              onClick={() => {
                rejectOrder(order.orderId, reason);
                toast.success("Order rejected — customer refunded");
                setRejecting(false);
              }}
              className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
            >
              Reject order
            </button>
          </div>
        }
      >
        {rejectReasons.map((r) => (
          <RadioRow key={r} label={r} checked={reason === r} onClick={() => setReason(r)} />
        ))}
      </Sheet>
    </>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={bold ? "font-bold" : "text-right"}>{value}</dd>
    </div>
  );
}

export default OrderDetail;