"use client";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatDate, formatDateTime } from "@/lib/format";
import { useCustomers, useUserTrail } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

function StateCustomers() {
  const session = useSession();
  const stateCode = session?.stateCode;
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: customers, loading, error } = useCustomers({
    ...(stateCode ? { stateCode } : {}),
    ...(q ? { query: q } : {}),
  });
  const { events: trail, loading: trailLoading } = useUserTrail(selectedUserId);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const totalSpend = useMemo(
    () => customers.reduce((sum, c) => sum + c.spendPaisa, 0),
    [customers],
  );

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
            {customers.length} customers · {formatINR(totalSpend)}
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
                  <TableCell className="text-muted-foreground">{c.userId}</TableCell>
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