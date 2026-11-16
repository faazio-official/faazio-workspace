"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
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
import { formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { useAdminOrders } from "@/lib/api/hooks";
import type { OrderStatus } from "@/data/types";

const STATUSES: (OrderStatus | "ALL")[] = [
  "ALL",
  "NEW",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

/** Same calendar day in the operator's browser timezone. */
function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function SuperOrders() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const [stateCode, setStateCode] = useState("ALL");

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, loading, error } = useAdminOrders({
    ...(q ? { q } : {}),
    ...(sellerId.trim() ? { sellerId: sellerId.trim() } : {}),
    ...(status !== "ALL" ? { status } : {}),
    ...(stateCode !== "ALL" ? { stateCode } : {}),
  });

  const states = Array.from(new Set(data.map((o) => o.stateCode).filter(Boolean))).sort();
  const open = data.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED");
  const outForDelivery = data.filter((o) => o.status === "SHIPPED");
  const deliveredToday = data.filter((o) => o.status === "DELIVERED" && isToday(o.statusDate));

  return (
    <div className="space-y-4">
      <PageHeader
        title="All orders"
        description="Every placed order across all districts. Use this to answer customer delivery inquiries."
      />

      <KpiStrip
        items={[
          { label: "Total orders", value: formatNumber(data.length) },
          { label: "Open", value: formatNumber(open.length) },
          { label: "Out for delivery", value: formatNumber(outForDelivery.length) },
          { label: "Delivered today", value: formatNumber(deliveredToday.length) },
        ]}
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="flex items-center gap-1.5">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, order, phone..."
              className="h-9 w-64"
            />
            <ComponentHelp id="orders-search" label="About searching orders" />
          </div>
          <Input
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            placeholder="Seller id"
            className="h-9 w-40"
          />
          {STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={option}
              active={status === option}
              onClick={() => setStatus(option)}
            />
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <Select value={stateCode} onValueChange={setStateCode}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All states</SelectItem>
                {states.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ComponentHelp id="orders-state-filter" label="About the state filter" />
          </div>
        </div>
        <DataShell
          loading={loading}
          error={error}
          isEmpty={data.length === 0}
          empty={
            <EmptyState
              title="No orders match"
              description="Clear the filters to see every placed order across districts."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>SLA due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((order) => (
                <TableRow key={order.orderId} className="h-12">
                  <TableCell className="num text-[13px] font-medium">
                    <Link
                      href={`/admin/super/orders/${encodeURIComponent(order.orderId)}`}
                      className="text-primary hover:underline"
                    >
                      {order.orderNumber || order.orderId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[13px]">{order.customerName}</TableCell>
                  <TableCell className="num text-[13px]">{order.customerPhone || "—"}</TableCell>
                  <TableCell className="text-[13px]">{order.city || "—"}</TableCell>
                  <TableCell className="num text-[13px]">{order.stateCode || "—"}</TableCell>
                  <TableCell className="text-[13px]">{order.sellerName || order.sellerId || "—"}</TableCell>
                  <TableCell>
                    <SectorPill sector={order.sector} />
                  </TableCell>
                  <TableCell className="num text-right">{order.itemsCount}</TableCell>
                  <TableCell className="num text-right">{formatINR(order.amountPaisa)}</TableCell>
                  <TableCell className="num text-[12px]">{formatDateTime(order.placedAt)}</TableCell>
                  <TableCell className="num text-[12px]">{formatDateTime(order.slaDueAt)}</TableCell>
                  <TableCell>
                    <StatusPill status={order.status} />
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

export default SuperOrders;
