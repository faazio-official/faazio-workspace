"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { useMockLoading, useSellers } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import type { SellerStatus } from "@/data/types";


const STATUSES: (SellerStatus | "ALL")[] = ["ALL", "PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"];

function StateSellers() {
  const session = useSession();
  const districtCode = session?.districtCode ?? "TCH";
  const loading = useMockLoading();
  const [status, setStatus] = useState<SellerStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const sellers = useSellers({ districtCode, status });
  const rows = sellers.filter((s) =>
    query ? s.businessName.toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Sellers" description="Approve KYC to let a seller list products in your district." />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business name"
            className="h-9 w-56"
          />
          {STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={option === "ALL" ? "All" : option.replace("_", " ")}
              active={status === option}
              onClick={() => setStatus(option)}
            />
          ))}
        </div>
        <DataShell
          loading={loading}
          isEmpty={rows.length === 0}
          empty={<EmptyState title="No sellers match" description="Clear the filters to see every seller in your district." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((seller) => (
                <TableRow key={seller.sellerId} className="h-12">
                  <TableCell className="text-[13px] font-medium">
                    <Link
                      href={`/admin/district/sellers/${seller.sellerId}`}
                      className="text-primary hover:underline"
                    >
                      {seller.businessName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[13px]">{seller.ownerName}</TableCell>
                  <TableCell>
                    <SectorPill sector={seller.category} />
                  </TableCell>
                  <TableCell className="num text-[12px]">{seller.gstin}</TableCell>
                  <TableCell className="num text-right">{seller.platformFeePct ?? 10}%</TableCell>
                  <TableCell className="num text-right">{seller.rating.toFixed(1)}</TableCell>
                  <TableCell className="num text-[12px]">{formatDate(seller.createdAt)}</TableCell>
                  <TableCell>
                    <StatusPill status={seller.status} />
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

export default StateSellers;
