"use client";
// Admin notification outbox console — a live, cross-user view of the notification pipeline
// (`GET /admin/notifications`, admin-only). Shows delivery status + attempts so an operator can see
// which notifications are PENDING / SENT / FAILED. Read + delivery only: no send/drain controls.
import { useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { StatusPill } from "@/components/patterns/Pills";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { useAdminNotifications } from "@/lib/api/hooks";

const STATUSES = ["ALL", "PENDING", "SENT", "FAILED"] as const;

export function AdminNotificationsConsole() {
  const [status, setStatus] = useState<string>("ALL");
  const { items, loading } = useAdminNotifications(status);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Every notification the gateway has enqueued, newest first. PENDING rows await the push drain; FAILED rows exhausted their retry budget."
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-3">
          {STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={option === "ALL" ? "All" : option.charAt(0) + option.slice(1).toLowerCase()}
              active={status === option}
              onClick={() => setStatus(option)}
            />
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            Auto-refreshes every 30s
          </span>
        </div>

        <DataShell
          loading={loading && items.length === 0}
          isEmpty={items.length === 0}
          empty={
            <EmptyState
              title="No notifications"
              description="Nothing has been enqueued for this filter yet."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Kind</TableHead>
                <TableHead className="hidden lg:table-cell">Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="max-w-[280px]">
                    <p className="truncate font-medium">{n.title}</p>
                    <p className="truncate text-[12px] text-muted-foreground">{n.body}</p>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-[12px] text-muted-foreground md:table-cell">
                    {n.kind}
                  </TableCell>
                  <TableCell className="hidden font-mono text-[11px] text-muted-foreground lg:table-cell">
                    {n.userId || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={n.status} />
                    {typeof n.attempts === "number" && n.attempts > 0 ? (
                      <span className="ml-1 text-[11px] text-muted-foreground">×{n.attempts}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-[12px] text-muted-foreground sm:table-cell">
                    {formatDateTime(n.createdAt)}
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
