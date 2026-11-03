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
import { useMockLoading, useOrders, useSellerScope } from "@/lib/api/hooks";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

function SellerReturns() {
  const { sellerId, storeId } = useSellerScope();
  const loading = useMockLoading();
  const returns = useOrders({ sellerId, storeId }).filter(
    (o) => o.status === "RETURNED" || o.status === "CANCELLED",
  );

  return (
    <div className="space-y-4 px-4 pt-4">
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
                <TableHead className="text-right">Order value</TableHead>
                <TableHead className="text-right">Refund from settlement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="flex items-center justify-end gap-1.5">
                    <ComponentHelp id="approve-button" label="About approving a return" />
                    <ComponentHelp id="reject-button" label="About rejecting a return" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((order) => {
                const refund = order.amountPaisa;
                return (
                  <TableRow key={order.orderId} className="h-12">
                    <TableCell className="num font-medium">{order.orderId}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell className="num text-right">{formatINR(order.amountPaisa)}</TableCell>
                    <TableCell className="num text-right">{formatINR(refund)}</TableCell>
                    <TableCell>
                      <StatusPill status={order.status} />
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      {/* Approving writes the (idempotent) RETURNED transition + audit trail; a
                          CANCELLED row is a rejection by the seller, so there is nothing to refund. */}
                      {order.status === "RETURNED" ? (
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
                      ) : null}
                      {order.status === "RETURNED" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            advanceOrder(order.orderId, "DELIVERED");
                            toast.success("Return rejected — order stays delivered");
                          }}
                        >
                          Reject
                        </Button>
                      ) : null}
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
