"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ErrorState, TableSkeleton } from "@/components/patterns/DataState";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatINR } from "@/lib/format";
import { updateAdminOrderStatus } from "@/lib/api";
import { useAdminOrder } from "@/lib/api/hooks";
import type { OrderStatus } from "@/data/types";

const STATUSES: OrderStatus[] = [
  "NEW",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { order, loading, error, refresh } = useAdminOrder(id);
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Order detail" />
        <SectionCard>
          <TableSkeleton rows={5} />
        </SectionCard>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <PageHeader title="Order detail" />
        <SectionCard>
          <ErrorState message={error ?? "Order not found"} onRetry={refresh} />
          <div className="pb-4 text-center">
            <Link href="/admin/super/orders" className="text-[13px] font-semibold text-primary hover:underline">
              Back to all orders
            </Link>
          </div>
        </SectionCard>
      </div>
    );
  }

  const hoursLeft = (new Date(order.slaDueAt).getTime() - Date.now()) / 3600000;

  const applyStatus = () => {
    if (!nextStatus) return;
    setSaving(true);
    updateAdminOrderStatus(order.orderId, nextStatus)
      .then(() => {
        toast.success(`Order marked ${nextStatus.toLowerCase()}`);
        setNextStatus("");
        refresh();
      })
      .catch((err: unknown) => {
        const description = err instanceof Error && err.message ? err.message : "The server rejected the change.";
        toast.error("Status update failed", { description });
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={order.orderNumber || order.orderId}
        description="Status and SLA so you can answer a customer's delivery question."
      />

      <SectionCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <dl className="space-y-1">
            <Row label="Customer">{order.customerName}</Row>
            <Row label="Phone">
              <span className="num">{order.customerPhone || "—"}</span>
            </Row>
            <Row label="District / State">
              {[order.districtName, order.stateCode].filter(Boolean).join(", ") || "—"}
            </Row>
            <Row label="Seller">{order.sellerName || order.sellerId || "—"}</Row>
            <Row label="Sector">
              <SectorPill sector={order.sector} />
            </Row>
          </dl>
          <dl className="space-y-1">
            <Row label="Placed">
              <span className="num">{formatDateTime(order.placedAt)}</span>
            </Row>
            <Row label="Order value">
              <span className="num font-medium">{formatINR(order.amountPaisa)}</span>
            </Row>
            <Row label="Status">
              <StatusPill status={order.status} />
            </Row>
            <Row label="SLA due">
              <span className="num">
                {formatDateTime(order.slaDueAt)}
                <span className="ml-1 text-muted-foreground">
                  {hoursLeft > 0
                    ? `(${hoursLeft.toFixed(1)} h left)`
                    : `(${Math.abs(hoursLeft).toFixed(1)} h overdue)`}
                </span>
              </span>
            </Row>
            <Row label="Fulfillment">{order.fulfillment || "DELIVERY"}</Row>
          </dl>
        </div>
      </SectionCard>

      <SectionCard title="Mark status" description="Super-admin override. The seller and customer are notified.">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as OrderStatus)}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Choose status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!nextStatus || saving} onClick={applyStatus}>
            {saving ? "Updating..." : "Update status"}
          </Button>
          <ComponentHelp id="order-status-override" label="About overriding order status" />
        </div>
      </SectionCard>

      <SectionCard title="Items" bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.lineItems.map((line) => (
              <TableRow key={line.lineId} className="h-12">
                <TableCell className="text-[13px] font-medium">{line.name}</TableCell>
                <TableCell className="text-[12px] text-muted-foreground">{line.variant || "—"}</TableCell>
                <TableCell className="num text-right">{line.qty}</TableCell>
                <TableCell className="num text-right">{formatINR(line.unitPrice * 100)}</TableCell>
                <TableCell className="num text-right">{formatINR(line.unitPrice * 100 * line.qty)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Delivery">
        {order.delivery ? (
          <dl className="space-y-1">
            <Row label="Rider">{order.delivery.riderName || order.delivery.riderId || "Unassigned"}</Row>
            <Row label="Rider phone">
              <span className="num">{order.delivery.riderPhone || "—"}</span>
            </Row>
            <Row label="Delivery status">{order.delivery.status || "—"}</Row>
            <Row label="Payout mode">{order.delivery.payoutMode || "—"}</Row>
            <Row label="Assigned at">
              <span className="num">{order.delivery.assignedAt ? formatDateTime(order.delivery.assignedAt) : "—"}</span>
            </Row>
          </dl>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            No rider assigned yet. This order has not been dispatched.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

export default AdminOrderDetail;
