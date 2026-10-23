"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDateTime } from "@/lib/format";
import { setTicketStatus } from "@/lib/api";
import { useMockLoading, useTickets } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import type { TicketStatus } from "@/data/types";

const STATUSES: (TicketStatus | "ALL")[] = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function StateSupport() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const [status, setStatus] = useState<TicketStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const tickets = useTickets({ stateCode, status, query });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support"
        description="Customer tickets raised in your district. Update the status as you work each one."
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject or ticket id"
            className="max-w-xs"
          />
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((option) => (
              <FilterChip
                key={option}
                label={option}
                active={status === option}
                onClick={() => setStatus(option)}
              />
            ))}
          </div>
        </div>
        <DataShell
          loading={loading}
          isEmpty={tickets.length === 0}
          empty={
            <EmptyState
              title="No tickets"
              description="Support tickets raised in your district appear here."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.ticketId} className="h-12">
                  <TableCell className="num font-medium">{t.ticketId}</TableCell>
                  <TableCell>
                    <div className="font-medium">{t.subject}</div>
                    <div className="max-w-md truncate text-[12px] text-muted-foreground">{t.body}</div>
                  </TableCell>
                  <TableCell className="num text-muted-foreground">{t.userId ?? "—"}</TableCell>
                  <TableCell className="num text-muted-foreground">{t.sellerId ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell>
                    <StatusPill status={t.status} />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={t.status}
                      onValueChange={(value) => {
                        setTicketStatus(t.ticketId, value as TicketStatus);
                        toast.success(`${t.ticketId} → ${value.replace(/_/g, " ")}`);
                      }}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.filter((s) => s !== "ALL").map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

export default StateSupport;