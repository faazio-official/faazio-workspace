"use client";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { Combobox } from "@/components/patterns/Combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
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
import { formatINR, formatDate, formatNumber } from "@/lib/format";
import { useCustomers, useDistricts, useStates } from "@/lib/api/hooks";
import { districtName, districtsForState } from "@/lib/api/reference";

const PAGE_SIZE = 50;
const ALL = "ALL";

function PlatformUsers() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [stateCode, setStateCode] = useState(ALL);
  const [districtCode, setDistrictCode] = useState(ALL);
  const [page, setPage] = useState(0);

  // Debounced server-side search — matches name, phone, customer id or pincode across every district.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Any narrowing restarts at the first page, and a new state clears the district selection.
  useEffect(() => {
    setPage(0);
  }, [q, stateCode, districtCode]);
  useEffect(() => {
    setDistrictCode(ALL);
  }, [stateCode]);

  const states = useStates();
  const districts = useDistricts();

  const { data: customers, total, totalOrders, totalSpendPaisa, loading, error } = useCustomers({
    ...(q ? { query: q } : {}),
    ...(stateCode !== ALL ? { stateCode } : {}),
    ...(districtCode !== ALL ? { districtCode } : {}),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const districtOptions = useMemo(() => {
    const scoped =
      stateCode === ALL ? districts : districtsForState(districts, stateCode);
    return [
      { value: ALL, label: "All districts" },
      ...scoped.map((d) => ({
        value: d.districtCode,
        label: d.name,
        description: d.districtCode,
      })),
    ];
  }, [districts, stateCode]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageWindow = useMemo(() => {
    const start = Math.max(0, Math.min(page - 2, pageCount - 5));
    return Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i);
  }, [page, pageCount]);

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = page * PAGE_SIZE + customers.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Platform-wide customer directory — filter by state and district, and find any customer by phone, customer id or pincode. Read-only."
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="flex items-center gap-1.5">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, customer id or pincode"
              className="h-9 w-72"
            />
            <ComponentHelp id="user-search" label="About searching users" />
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={stateCode} onValueChange={setStateCode}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All states</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s.stateCode} value={s.stateCode}>
                    {s.stateCode} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ComponentHelp id="user-state-filter" label="About the state filter" />
          </div>
          <div className="flex items-center gap-1.5">
            <Combobox
              value={districtCode}
              onChange={setDistrictCode}
              options={districtOptions}
              placeholder="District"
              searchPlaceholder="Search districts…"
              emptyText="No district in this state."
            />
            <ComponentHelp id="user-district-filter" label="About the district filter" />
          </div>
          <span className="num ml-auto text-sm text-muted-foreground">
            {formatNumber(total)} users · {formatNumber(totalOrders)} orders ·{" "}
            {formatINR(totalSpendPaisa)}
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
                q || stateCode !== ALL || districtCode !== ALL
                  ? "No customer matches those filters."
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
                <TableHead>
                  <span className="inline-flex items-center gap-1.5">
                    User id
                    <ComponentHelp id="user-customer-id" label="About the customer id" />
                  </span>
                </TableHead>
                <TableHead>Pincode</TableHead>
                <TableHead>District</TableHead>
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
                  <TableCell className="num text-muted-foreground">
                    {c.customerCode ?? (
                      <span className="inline-flex items-center gap-1.5" title={c.userId}>
                        {c.userId}
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                          pending
                        </span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="num text-muted-foreground">{c.pincode || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {districtName(districts, c.districtCode ?? "") || "—"}
                  </TableCell>
                  <TableCell className="num text-muted-foreground">{c.stateCode || "—"}</TableCell>
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
                {pageWindow.map((index) => (
                  <PaginationItem key={index}>
                    <PaginationLink
                      href="#"
                      isActive={index === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(index);
                      }}
                    >
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page >= pageCount - 1}
                    className={
                      page >= pageCount - 1 ? "pointer-events-none opacity-50" : undefined
                    }
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
    </div>
  );
}

export default PlatformUsers;
