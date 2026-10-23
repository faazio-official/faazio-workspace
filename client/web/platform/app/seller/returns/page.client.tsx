"use client";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/format";
import { advanceOrder } from "@/lib/api";
import { useMockLoading, useOrders } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";


const REASONS = ["Damaged in transit", "Wrong item", "Changed mind", "Late delivery"];

function SellerReturns() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const returns = useOrders({ sellerId }).filter(
    (o) => o.status === "RETURNED" || o.status === "CANCELLED",
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Returns"
        description="Approvals refund the full order value from your next settlement cycle."
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={returns.length === 0}
          empty={
            <EmptyState
              title="No open returns"
              description="Return requests from shoppers land in this queue."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Order value</TableHead>
                <TableHead className="text-right">Refund from settlement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((order, index) => {
                const refund = order.amountPaisa;
                return (
                  <TableRow key={order.orderId} className="h-12">
                    <TableCell className="num font-medium">{order.orderId}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {REASONS[index % REASONS.length]}
                    </TableCell>
                    <TableCell className="num text-right">{formatINR(order.amountPaisa)}</TableCell>
                    <TableCell className="num text-right">{formatINR(refund)}</TableCell>
                    <TableCell>
                      <StatusPill status={order.status} />
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          advanceOrder(order.orderId, "RETURNED");
                          toast.success("Return approved, refund queued");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => toast.success("Return rejected with reason recorded")}
                      >
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default SellerReturns;
