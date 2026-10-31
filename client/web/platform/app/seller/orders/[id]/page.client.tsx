"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatINR } from "@/lib/format";
import { acceptOrder, advanceOrder, rejectOrder } from "@/lib/api";
import { useOrder } from "@/lib/api/hooks";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import type { OrderStatus } from "@/data/types";

const FLOW: OrderStatus[] = ["NEW", "PACKED", "SHIPPED", "DELIVERED"];

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const order = useOrder(id);

  if (!order) {
    return (
      <SectionCard>
        <EmptyState
          title="Order not found"
          description="This order id is not in your workspace."
          action={
            <Button asChild size="sm">
              <Link href="/seller/orders">Back to orders</Link>
            </Button>
          }
        />
      </SectionCard>
    );
  }

  const currentIndex = FLOW.indexOf(order.status);
  const next = currentIndex >= 0 ? FLOW[currentIndex + 1] : undefined;
  const hoursLeft = (new Date(order.slaDueAt).getTime() - Date.now()) / 3600000;

  return (
    <div className="space-y-4">
      <PageHeader
        title={order.orderId}
        description={`${order.customerName} · ${order.city}, ${order.stateCode}`}
        actions={
          <>
            <StatusPill status={order.status} />
            {order.status === "NEW" ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => {
                      acceptOrder(order.orderId);
                      toast.success("Order accepted");
                    }}
                  >
                    Accept
                  </Button>
                  <ComponentHelp id="accept-button" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const reason = window.prompt(
                        "Rejection reason (the customer is refunded)",
                        "Out of stock",
                      );
                      if (reason === null) return;
                      rejectOrder(order.orderId, reason.trim() || "Out of stock");
                      toast.success("Order rejected");
                    }}
                  >
                    Reject
                  </Button>
                  <ComponentHelp id="reject-button" />
                </div>
              </>
            ) : next ? (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    advanceOrder(order.orderId, next);
                    toast.success(`Moved to ${next}`);
                  }}
                >
                  Mark {next.toLowerCase()}
                </Button>
                <ComponentHelp id="advance-button" />
              </div>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Summary" className="lg:col-span-2">
          <dl className="grid gap-3 text-[13px] md:grid-cols-2">
            <Row label="Order value" value={formatINR(order.amountPaisa)} />
            <Row label="Items" value={`${order.itemsCount}`} />
            <Row label="Sector" value={order.sector} />
            <Row label="Placed" value={formatDateTime(order.placedAt)} />
            <Row label="SLA due" value={formatDateTime(order.slaDueAt)} />
            <Row
              label="SLA countdown"
              value={
                hoursLeft > 0
                  ? `${hoursLeft.toFixed(1)} h left`
                  : `${Math.abs(hoursLeft).toFixed(1)} h overdue`
              }
            />
            <Row label="Delivery address" value="Flat •••, ••• Road, ••• (revealed on dispatch)" />
            <Row label="Store" value={order.storeId} />
          </dl>
        </SectionCard>

        <SectionCard title="Timeline">
          <ol className="space-y-3">
            {FLOW.map((stage, index) => (
              <li key={stage} className="flex items-center gap-2 text-[13px]">
                <span
                  className={
                    index <= currentIndex
                      ? "size-2 rounded-full bg-success"
                      : "size-2 rounded-full bg-border"
                  }
                />
                <span className={index <= currentIndex ? "font-medium" : "text-muted-foreground"}>
                  {stage}
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

export default OrderDetail;
