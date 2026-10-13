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
import { formatDateTime } from "@/lib/format";
import { useMockLoading, usePrescriptions } from "@/lib/api/hooks";
import { setPrescriptionStatus } from "@/lib/api";
import { useSession } from "@/lib/hooks/useSession";
import type { PrescriptionStatus } from "@/data/types";

function SellerPrescriptions() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-4";
  const loading = useMockLoading();
  const prescriptions = usePrescriptions({ sellerId });

  const advance = (prescriptionId: string, status: PrescriptionStatus) => {
    setPrescriptionStatus(prescriptionId, status);
    toast.success(`Prescription ${prescriptionId} marked ${status.toLowerCase()}`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Prescriptions"
        description="Verify uploaded prescriptions and move them to fulfilment. Image keys stay private to Storage."
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={prescriptions.length === 0}
          empty={
            <EmptyState
              title="No prescriptions yet"
              description="Customer prescriptions routed to your stores appear here."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prescription</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Pages</TableHead>
                <TableHead>Fulfilment</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescriptions.map((p) => (
                <TableRow key={p.prescriptionId} className="h-12">
                  <TableCell className="font-medium">{p.prescriptionId}</TableCell>
                  <TableCell>{p.userId}</TableCell>
                  <TableCell className="num text-right">{p.pages}</TableCell>
                  <TableCell>{p.fulfillment}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                  <TableCell>
                    <StatusPill status={p.status} />
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={p.status !== "RECEIVED"}
                      onClick={() => advance(p.prescriptionId, "PROCESSING")}
                    >
                      Process
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={p.status === "FULFILLED" || p.status === "CANCELLED"}
                      onClick={() => advance(p.prescriptionId, "FULFILLED")}
                    >
                      Fulfil
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={p.status === "FULFILLED" || p.status === "CANCELLED"}
                      onClick={() => advance(p.prescriptionId, "CANCELLED")}
                    >
                      Cancel
                    </Button>
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

export default SellerPrescriptions;