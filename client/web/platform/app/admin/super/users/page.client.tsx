"use client";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
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
import { formatINR, formatDate } from "@/lib/format";
import { useCustomers } from "@/lib/api/hooks";

function PlatformUsers() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  // Debounced server-side search — matches name, phone or user id across every district.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: customers, loading, error } = useCustomers({ ...(q ? { query: q } : {}), limit: 500 });

  const totalSpend = useMemo(
    () => customers.reduce((sum, c) => sum + c.spendPaisa, 0),
    [customers],
  );
  const totalOrders = useMemo(
    () => customers.reduce((sum, c) => sum + c.ordersCount, 0),
    [customers],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Platform-wide customer monitoring, including the phone each customer signed in with — read-only."
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
          <div className="flex items-center gap-1.5">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, user id or phone"
              className="max-w-xs"
            />
            <ComponentHelp id="user-search" label="About searching users" />
          </div>
          <span className="num text-sm text-muted-foreground">
            {customers.length} users · {totalOrders} orders · {formatINR(totalSpend)}
          </span>
        </div>
        <DataShell
          loading={loading}
          error={error}
          isEmpty={customers.length === 0}
          empty={
            <EmptyState
              title="No users found"
              description={
                q
                  ? "No customer matches that name, phone or user id."
                  : "Customers appear here as soon as they sign in to the app."
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>User id</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Orders
                    <ComponentHelp id="user-orders" label="About the order count" />
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Spend
                    <ComponentHelp id="user-spend" label="About the spend total" />
                  </span>
                </TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.userId} className="h-12">
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
    </div>
  );
}

export default PlatformUsers;
