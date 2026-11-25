"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { useCustomers, useUserTrail } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

const PAGE_SIZE = 50;

function StateCustomers() {
  const session = useSession();
  const stateCode = session?.stateCode;
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: customers, total, totalSpendPaisa, loading, error } = useCustomers({
    ...(stateCode ? { stateCode } : {}),
    ...(q ? { query: q } : {}),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const { events: trail, loading: trailLoading } = useUserTrail(selectedUserId);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [q, stateCode]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = page * PAGE_SIZE + customers.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Customer activity for your district, including their sign-in phone. Read-only monitoring."
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border p-3">
          <div className="flex items-center gap-1.5">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, user id or phone"
              className="max-w-xs"
            />
            <ComponentHelp id="customer-search" label="About customer search" />
          </div>
          <span className="num text-sm text-muted-foreground">
            {total} customers · {formatINR(totalSpendPaisa)}
          </span>
        </div>
        <DataShell
          loading={loading}
          error={error}
          isEmpty={customers.length === 0}
          empty={
            <EmptyState
              title="No customers found"
              description="Customers whose orders fall in this district appear here."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <span className="inline-flex items-center gap-1.5">
                    Customer
                    <ComponentHelp id="customer-row" label="About selecting a customer" />
                  </span>
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>User id</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow
                  key={c.userId}
                  className={`h-12 cursor-pointer ${selectedUserId === c.userId ? "bg-muted/50" : ""}`}
                  onClick={() => setSelectedUserId((prev) => (prev === c.userId ? null : c.userId))}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="num">{c.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.customerCode ?? c.userId}</TableCell>
                  <TableCell>{c.stateCode ?? "—"}</TableCell>
                  <TableCell className="num text-right">{c.ordersCount}</TableCell>
                  <TableCell className="num text-right font-medium">{formatINR(c.spendPaisa)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
            <span className="num text-sm text-muted-foreground">
              Showing {from}–{to} of {formatNumber(total)}
            </span>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page === 0}
                    className={page === 0 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 0) setPage((p) => Math.max(0, p - 1));
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-3 text-sm text-muted-foreground">
                    Page {page + 1} of {pageCount}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page >= pageCount - 1}
                    className={page >= pageCount - 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(pageCount - 1, p + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </SectionCard>

      {selectedUserId && (
        <SectionCard
          title="Activity trail"
          description={`ID-only behaviour events for ${selectedUserId} (no PII; sourced from the app's event stream).`}
          actions={<ComponentHelp id="activity-trail" label="About the activity trail" />}
          bodyClassName="p-0"
        >
          <DataShell
            loading={trailLoading}
            isEmpty={trail.length === 0}
            empty={
              <EmptyState
                title="No activity yet"
                description="Events appear here once the customer browses products with the gateway connected."
              />
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trail.map((e, i) => (
                  <TableRow key={`${e.productId}-${e.at}-${i}`} className="h-12">
                    <TableCell className="font-medium">{e.event}</TableCell>
                    <TableCell className="text-muted-foreground">{e.productId}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(e.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataShell>
        </SectionCard>
      )}
    </div>
  );
}

export default StateCustomers;