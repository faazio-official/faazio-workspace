"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SellerCredentialCard } from "@/components/patterns/SellerCredentialCard";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import { setSellerStatus } from "@/lib/api";
import { usePortalLoading, useSellers } from "@/lib/api/hooks";
import type { SellerLoginCredential, SellerRecord, SellerStatus } from "@/data/types";


const STATUSES: (SellerStatus | "ALL")[] = ["ALL", "PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"];

function SuperSellers() {
  const loading = usePortalLoading();
  const [status, setStatus] = useState<SellerStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // The one-time login minted by an activation. It exists only in this response, so it is held here
  // until the admin dismisses the sheet — closing it really does end the chance to share it.
  const [issued, setIssued] = useState<{
    sellerId: string;
    businessName: string;
    phone?: string | undefined;
    credential: SellerLoginCredential;
  } | null>(null);
  const sellers = useSellers({ status });
  const rows = sellers.filter((s) =>
    query
      ? s.businessName.toLowerCase().includes(query.toLowerCase()) ||
        s.districtCode?.toLowerCase() === query.toLowerCase() ||
        s.stateCode.toLowerCase() === query.toLowerCase()
      : true,
  );

  const activate = async (seller: SellerRecord) => {
    setBusy(seller.sellerId);
    try {
      const credential = await setSellerStatus(
        seller.sellerId,
        "ACTIVE",
        "Super admin override: activated",
      );
      if (credential) {
        setIssued({
          sellerId: seller.sellerId,
          businessName: seller.businessName,
          phone: seller.contactPhone,
          credential,
        });
      } else if (credential === null) {
        toast.success("Seller activated");
      }
    } catch (err) {
      toast.error("Could not activate the seller", {
        description: err instanceof ApiError ? err.message : err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const suspend = async (seller: SellerRecord) => {
    setBusy(seller.sellerId);
    try {
      await setSellerStatus(seller.sellerId, "SUSPENDED", "Super admin override: suspended");
      toast.success("Seller suspended");
    } catch (err) {
      toast.error("Could not suspend the seller", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sellers"
        description="You can override any district admin decision; the override is logged."
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="flex items-center gap-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, district or state"
              className="h-9 w-56"
            />
            <ComponentHelp id="seller-search" label="About searching sellers" />
          </div>
          {STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={option === "ALL" ? "All" : option.replace("_", " ")}
              active={status === option}
              onClick={() => setStatus(option)}
            />
          ))}
          <ComponentHelp id="status-filter" label="About the status filter" />
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
                <TableHead>District</TableHead>
                <TableHead>Vendors</TableHead>
                                <TableHead>Applied</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Override
                    <ComponentHelp id="seller-activate" label="About activating a seller" />
                    <ComponentHelp id="seller-suspend" label="About suspending a seller" />
                  </span>
                </TableHead>
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
                  <TableCell className="num text-[13px] font-medium">
                    {seller.districtCode ?? seller.stateCode}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {(seller.vendorApps ?? []).map((app) => (
                        <SectorPill key={app} sector={app} />
                      ))}
                      {!seller.vendorApps?.length ? (
                        <span className="text-[12px] text-muted-foreground">
                          {seller.vendorCount ?? 0} vendor{(seller.vendorCount ?? 0) === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
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
                        disabled={seller.status === "ACTIVE" || busy === seller.sellerId}
                        onClick={() => void activate(seller)}
                      >
                        {busy === seller.sellerId ? "Activating…" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={seller.status === "SUSPENDED" || busy === seller.sellerId}
                        onClick={() => void suspend(seller)}
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

      <Sheet open={Boolean(issued)} onOpenChange={(next) => !next && setIssued(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Seller login for {issued?.businessName ?? "seller"}</SheetTitle>
            <SheetDescription>
              Provisioned automatically on approval. Share it once; the temporary password is never
              stored in the clear.
            </SheetDescription>
          </SheetHeader>
          {issued ? (
            <div className="px-4 pb-6">
              <SellerCredentialCard
                credential={issued.credential}
                businessName={issued.businessName}
                phone={issued.phone}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default SuperSellers;
