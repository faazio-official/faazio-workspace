"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
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
import {
  approveFeeChangeRequest,
  listFeeChangeRequests,
  rejectFeeChangeRequest,
} from "@/lib/api";
import { useSession } from "@/lib/hooks/useSession";
import { districtName } from "@/data/districts";
import type { FeeChangeRequest } from "@/data/types";

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

/**
 * Platform-fee change review queue. `scope="district"` only narrows the display; the gateway
 * already scopes a district admin to their own district and lets a super admin see every district.
 */
export function FeeChangeRequestsBoard({
  scope,
}: {
  scope: "district" | "global";
}) {
  const session = useSession();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("PENDING");
  const [rows, setRows] = useState<FeeChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(
        await listFeeChangeRequests({
          status: status === "ALL" ? undefined : status,
          districtCode: scope === "district" ? session?.districtCode : undefined,
        }),
      );
    } catch {
      toast.error("Could not load fee-change requests");
    } finally {
      setLoading(false);
    }
  }, [scope, session?.districtCode, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(row: FeeChangeRequest) {
    setBusy(row.requestId);
    try {
      await approveFeeChangeRequest(row.requestId);
      toast.success(`${row.businessName || row.sellerId} is now on ${row.requestedFeePct}%`);
      await load();
    } catch {
      toast.error("Could not approve the request");
    } finally {
      setBusy(null);
    }
  }

  async function reject(row: FeeChangeRequest) {
    const reason = window.prompt(
      `Reason for rejecting ${row.currentFeePct}% → ${row.requestedFeePct}% (min 4 characters)`,
    );
    if (!reason || reason.trim().length < 4) return;
    setBusy(row.requestId);
    try {
      await rejectFeeChangeRequest(row.requestId, reason.trim());
      toast.success("Request rejected");
      await load();
    } catch {
      toast.error("Could not reject the request");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fee change requests"
        description={
          scope === "district"
            ? `Seller-initiated platform-fee changes in ${districtName(session?.districtCode ?? "") || "your district"}.`
            : "Seller-initiated platform-fee changes across every district."
        }
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={option === "ALL" ? "All" : option[0] + option.slice(1).toLowerCase()}
              active={status === option}
              onClick={() => setStatus(option)}
            />
          ))}
        </div>
        <DataShell
          loading={loading}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title="No requests"
              description="Sellers who ask for a new platform fee will appear here for review."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>District</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead>Requested at</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.requestId} className="h-12">
                  <TableCell className="text-[13px] font-medium">
                    {row.businessName || row.sellerId}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {row.districtCode ? districtName(row.districtCode) || row.districtCode : "—"}
                  </TableCell>
                  <TableCell className="num text-right text-[12px]">{row.currentFeePct}%</TableCell>
                  <TableCell className="num text-right text-[13px] font-semibold">
                    {row.requestedFeePct}%
                  </TableCell>
                  <TableCell className="num text-[12px]">{formatDateTime(row.requestedAt)}</TableCell>
                  <TableCell>
                    <StatusPill status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status === "PENDING" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === row.requestId}
                          onClick={() => void reject(row)}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy === row.requestId}
                          onClick={() => void approve(row)}
                        >
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        {row.reviewReason || "—"}
                      </span>
                    )}
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
