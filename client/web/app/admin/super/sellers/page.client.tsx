"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
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
import { setSellerStatus } from "@/lib/api";
import { useMockLoading, useSellers } from "@/lib/api/hooks";
import type { SellerStatus } from "@/data/types";


const STATUSES: (SellerStatus | "ALL")[] = ["ALL", "PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"];

function SuperSellers() {
  const loading = useMockLoading();
  const [status, setStatus] = useState<SellerStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const sellers = useSellers({ status });
  const rows = sellers.filter((s) =>
    query
      ? s.businessName.toLowerCase().includes(query.toLowerCase()) ||
        s.stateCode.toLowerCase() === query.toLowerCase()
      : true,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sellers"
        description="You can override any state admin decision; the override is logged."
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or state code"
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
          empty={<EmptyState title="No sellers match" description="Clear the filters to see every seller." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Override</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((seller) => (
                <TableRow key={seller.sellerId} className="h-12">
                  <TableCell className="text-[13px] font-medium">{seller.businessName}</TableCell>
                  <TableCell className="num text-[13px] font-semibold">{seller.stateCode}</TableCell>
                  <TableCell>
                    <SectorPill sector={seller.category} />
                  </TableCell>
                  <TableCell className="num text-[12px]">{formatDate(seller.createdAt)}</TableCell>
                  <TableCell className="num text-right">{seller.rating.toFixed(1)}</TableCell>
                  <TableCell>
                    <StatusPill status={seller.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={seller.status === "ACTIVE"}
                        onClick={() => {
                          setSellerStatus(seller.sellerId, "ACTIVE", "Super admin override: activated");
                          toast.success("Seller activated");
                        }}
                      >
                        Activate
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={seller.status === "SUSPENDED"}
                        onClick={() => {
                          setSellerStatus(seller.sellerId, "SUSPENDED", "Super admin override: suspended");
                          toast.success("Seller suspended");
                        }}
                      >
                        Suspend
                      </Button>
                    </div>
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

export default SuperSellers;
