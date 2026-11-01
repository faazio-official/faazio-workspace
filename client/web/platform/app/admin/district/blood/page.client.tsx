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
import { useMockLoading, useBloodRequests } from "@/lib/api/hooks";
import { removeBloodRequest } from "@/lib/api";
import { useSession } from "@/lib/hooks/useSession";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

function StateBlood() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const requests = useBloodRequests({ stateCode });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Blood bank"
        description="Review the public blood-request board. Remove stale or abusive posts — contact details are PII."
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={requests.length === 0}
          empty={
            <EmptyState
              title="No open requests"
              description="Active blood requests in your district appear here."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    Action
                    <ComponentHelp id="remove-button" label="About removing a request" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.requestId} className="h-12">
                  <TableCell className="font-medium">{r.requestId}</TableCell>
                  <TableCell>{r.hospital}</TableCell>
                  <TableCell>{r.city}</TableCell>
                  <TableCell className="font-medium">{r.bloodGroup}</TableCell>
                  <TableCell className="num text-right">{r.unitsRequired}</TableCell>
                  <TableCell>
                    <StatusPill status={r.urgency} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(r.expiresAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        removeBloodRequest(r.requestId);
                        toast.success(`Request ${r.requestId} removed`);
                      }}
                    >
                      Remove
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

export default StateBlood;