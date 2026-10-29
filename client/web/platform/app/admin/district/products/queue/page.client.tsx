"use client";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";
import { setProductStatus } from "@/lib/api";
import { useMockLoading, useProducts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ProductThumb } from "@/components/patterns/ProductThumb";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";


function ListingQueue() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const pending = useProducts({ stateCode, status: "PENDING_REVIEW" });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Listing queue"
        description="Approved listings become visible in the consumer app immediately."
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={pending.length === 0}
          empty={
            <EmptyState
              title="Queue is clear"
              description="No listings from your district are waiting for approval."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Decision
                    <ComponentHelp id="approve-button" label="About approving a listing" />
                    <ComponentHelp id="reject-button" label="About rejecting a listing" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((product) => (
                <TableRow key={product.productId} className="h-12">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProductThumb product={product} />
                      <span className="text-[13px] font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SectorPill sector={product.sector} />
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">{product.sellerId}</TableCell>
                  <TableCell className="num text-right">{formatINR(product.pricePaisa)}</TableCell>
                  <TableCell className="num text-[12px]">{formatDate(product.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setProductStatus(product.productId, "ACTIVE", "Listing approved");
                          toast.success("Listing approved");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setProductStatus(product.productId, "REJECTED", "Listing rejected in review");
                          toast.success("Listing rejected");
                        }}
                      >
                        Reject
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

export default ListingQueue;
