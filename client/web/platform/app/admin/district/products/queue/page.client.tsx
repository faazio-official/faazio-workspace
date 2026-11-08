"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { usePortalLoading, useProducts } from "@/lib/api/hooks";
import { ProductThumb } from "@/components/patterns/ProductThumb";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

const MAX_REASON = 500;

function ListingQueue() {
  const loading = usePortalLoading();
  const pending = useProducts({ status: "PENDING_REVIEW" });
  const [rejecting, setRejecting] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");

  function openReject(product: { productId: string; name: string }) {
    setRejecting({ id: product.productId, name: product.name });
    setReason("");
  }

  function confirmReject() {
    if (!rejecting) return;
    const message = reason.trim();
    if (!message) {
      toast.error("Add a reason so the seller knows what to fix");
      return;
    }
    setProductStatus(rejecting.id, "REJECTED", message);
    toast.success("Listing rejected", { description: "The seller will see your note." });
    setRejecting(null);
    setReason("");
  }

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
                          setProductStatus(product.productId, "ACTIVE");
                          toast.success("Listing approved");
                        }}
                      >
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openReject(product)}>
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

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this listing?</DialogTitle>
            <DialogDescription>
              {rejecting?.name} will stay hidden from shoppers. Tell the seller what to fix so they
              can submit it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
              placeholder="e.g. Product photo is blurred and the name is missing the pack size."
              rows={4}
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {reason.length}/{MAX_REASON}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={reason.trim().length === 0}>
              Reject listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ListingQueue;
