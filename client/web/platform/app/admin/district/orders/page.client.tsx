"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatINR, formatNumber, formatPercent } from "@/lib/format";
import { useMockLoading, useOrders } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";


function StateOrders() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const orders = useOrders({ stateCode });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const now = Date.now() + tick;
  const open = orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED");
  const breaches = open.filter((o) => new Date(o.slaDueAt).getTime() < now);
  const pendingDispatch = open.filter((o) => o.status === "NEW" || o.status === "PACKED");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders monitor"
        description="Refreshes every 30 seconds. Breaches are ordered by how late they are."
      />

      <KpiStrip
        items={[
          { label: "Open orders", value: formatNumber(open.length) },
          { label: "Pending dispatch", value: formatNumber(pendingDispatch.length) },
          { label: "SLA breaches", value: formatNumber(breaches.length) },
          {
            label: "On-time rate",
            value: open.length ? formatPercent(((open.length - breaches.length) / open.length) * 100) : "100%",
          },
        ]}
      />

      <SectionCard
        title="Escalations"
        description="Breached dispatch SLA"
        actions={<ComponentHelp id="escalations-board" label="About the escalations board" />}
        bodyClassName="p-0"
      >
        <DataShell
          loading={loading}
          isEmpty={breaches.length === 0}
          empty={<EmptyState title="No escalations" description="Every open order in your district is inside its SLA." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>SLA due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    Action
                    <ComponentHelp id="escalate-button" label="About escalating an order" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breaches
                .sort((a, b) => new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime())
                .map((order) => (
                  <TableRow key={order.orderId} className="h-12">
                    <TableCell className="num text-[13px] font-medium">{order.orderId}</TableCell>
                    <TableCell className="num text-[12px] text-muted-foreground">{order.sellerId}</TableCell>
                    <TableCell>
                      <SectorPill sector={order.sector} />
                    </TableCell>
                    <TableCell className="text-[13px]">{order.city}</TableCell>
                    <TableCell className="num text-right">{formatINR(order.amountPaisa)}</TableCell>
                    <TableCell className="num text-[12px] text-destructive">
                      {formatDateTime(order.slaDueAt)}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={order.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast.success(`Escalation raised with ${order.sellerId}`)}
                      >
                        Escalate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <SectionCard title="All open orders" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={open.length === 0}
          empty={<EmptyState title="Nothing open" description="All orders in your district are delivered or cancelled." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {open.map((order) => (
                <TableRow key={order.orderId} className="h-12">
                  <TableCell className="num text-[13px] font-medium">{order.orderId}</TableCell>
                  <TableCell className="text-[13px]">{order.customerName}</TableCell>
                  <TableCell className="text-[13px]">{order.city}</TableCell>
                  <TableCell className="num text-right">{order.itemsCount}</TableCell>
                  <TableCell className="num text-right">{formatINR(order.amountPaisa)}</TableCell>
                  <TableCell className="num text-[12px]">{formatDateTime(order.placedAt)}</TableCell>
                  <TableCell>
                    <StatusPill status={order.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default StateOrders;
