"use client";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatINR } from "@/lib/format";
import { advanceOrder } from "@/lib/api";
import { useMockLoading, useOrders } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import type { OrderStatus } from "@/data/types";


const COLUMNS: { status: OrderStatus; next?: OrderStatus }[] = [
  { status: "NEW", next: "PACKED" },
  { status: "PACKED", next: "SHIPPED" },
  { status: "SHIPPED", next: "DELIVERED" },
  { status: "DELIVERED" },
];

function SellerOrders() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const orders = useOrders({ sellerId });
  const closed = orders.filter((o) => o.status === "CANCELLED" || o.status === "RETURNED");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        description="Move each order forward before its SLA clock runs out."
      />

      <DataShell
        loading={loading}
        isEmpty={orders.length === 0}
        empty={<EmptyState title="No orders yet" description="Orders land here as shoppers check out." />}
      >
        <div className="grid gap-3 lg:grid-cols-4">
          {COLUMNS.map((column) => {
            const columnOrders = orders.filter((o) => o.status === column.status);
            return (
              <SectionCard
                key={column.status}
                title={column.status.replace(/_/g, " ")}
                description={`${columnOrders.length} orders`}
                bodyClassName="space-y-2 p-3"
              >
                {columnOrders.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-muted-foreground">Nothing here.</p>
                ) : (
                  columnOrders.map((order) => (
                    <div key={order.orderId} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/seller/orders/${order.orderId}`}
                          className="num text-[12px] font-semibold text-interactive"
                        >
                          {order.orderId}
                        </Link>
                        <StatusPill status={order.status} />
                      </div>
                      <p className="mt-1 text-[13px] font-medium">{order.customerName}</p>
                      <p className="num text-[12px] text-muted-foreground">
                        {formatINR(order.amountPaisa)} · {order.itemsCount} items · {order.city}
                      </p>
                      <p className="num mt-1 text-[11px] text-muted-foreground">
                        SLA {formatDateTime(order.slaDueAt)}
                      </p>
                      {column.next ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => {
                            advanceOrder(order.orderId, column.next!);
                            toast.success(`${order.orderId} → ${column.next}`);
                          }}
                        >
                          Mark {column.next.toLowerCase()}
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </SectionCard>
            );
          })}
        </div>
      </DataShell>

      <SectionCard title="Cancellations and returns" description="Counts against your health score">
        {closed.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No cancellations or returns.</p>
        ) : (
          <ul className="divide-y divide-border">
            {closed.map((order) => (
              <li key={order.orderId} className="flex items-center gap-3 py-2.5 text-[13px]">
                <span className="num font-medium">{order.orderId}</span>
                <span className="text-muted-foreground">{order.customerName}</span>
                <span className="num ml-auto">{formatINR(order.amountPaisa)}</span>
                <StatusPill status={order.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

export default SellerOrders;
