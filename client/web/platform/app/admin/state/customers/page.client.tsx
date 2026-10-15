"use client";
import { useMemo, useState } from "react";
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
import { formatINR, formatDate } from "@/lib/format";
import { useCustomers, useMockLoading } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";

function StateCustomers() {
  const session = useSession();
  const stateCode = session?.stateCode;
  const [query, setQuery] = useState("");
  const loading = useMockLoading();
  const customers = useCustomers({ stateCode, query });

  const totalSpend = useMemo(
    () => customers.reduce((sum, c) => sum + c.spendPaisa, 0),
    [customers],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="PII-safe customer activity for your state (no phone, address or email). Read-only monitoring."
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or user id"
            className="max-w-xs"
          />
          <span className="num text-sm text-muted-foreground">
            {customers.length} customers · {formatINR(totalSpend)}
          </span>
        </div>
        <DataShell
          loading={loading}
          isEmpty={customers.length === 0}
          empty={
            <EmptyState
              title="No customers yet"
              description="Customers whose orders fall in this state appear here."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
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
                <TableRow key={c.userId} className="h-12">
                  <TableCell className="font-medium">{c.name}</TableCell>
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

export default StateCustomers;