"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteProduct, setProductStatus } from "@/lib/api";
import { useLiveProducts, useProduct, useSeller } from "@/lib/api/hooks";
import type { ProductRecord, Sector } from "@/data/types";
import { ProductThumb } from "@/components/patterns/ProductThumb";

const SECTORS: (Sector | "ALL")[] = ["ALL", "MART", "FOOD", "PHARMA"];
const MAX_REASON = 500;

type ViewMode = "LISTED" | "REQUESTED";

const VIEW_LABEL: Record<ViewMode, string> = {
  LISTED: "Listed products",
  REQUESTED: "Requested products",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium">{value || "—"}</span>
    </div>
  );
}

/** Complete seller-filled overview of one listing, with the moderation actions. */
function ProductDetailsDialog({
  productId,
  onClose,
  onApprove,
  onReject,
}: {
  productId: string | null;
  onClose: () => void;
  onApprove: (product: ProductRecord) => void;
  onReject: (product: ProductRecord) => void;
}) {
  const product = useProduct(productId ?? "");
  // Hooks must run unconditionally: the seller id is empty when the dialog is closed.
  const seller = useSeller(product?.sellerId ?? "");
  const pending = product?.status === "PENDING_REVIEW";

  return (
    <Dialog open={productId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
        {product ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ProductThumb product={product} size="md" />
                <span className="min-w-0 truncate">{product.name}</span>
              </DialogTitle>
              <DialogDescription>Complete listing as submitted by the seller.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <section>
                <h3 className="mb-1 text-[12px] font-semibold text-muted-foreground">Product</h3>
                <DetailRow label="Name" value={product.name} />
                {product.nameTa ? <DetailRow label="Name (Tamil)" value={product.nameTa} /> : null}
                <DetailRow label="Description" value={product.description} />
                {product.descriptionTa ? (
                  <DetailRow label="Description (Tamil)" value={product.descriptionTa} />
                ) : null}
                <DetailRow label="Sector" value={product.sector} />
                <DetailRow label="Category" value={product.category} />
                <DetailRow label="Unit" value={product.unit} />
                <DetailRow
                  label="Price"
                  value={`${formatINR(product.pricePaisa)} / ${product.unit || "unit"}`}
                />
                <DetailRow label="Veg" value={product.isVeg ? "Yes" : "No"} />
                <DetailRow
                  label="Prescription required"
                  value={product.isPrescription ? "Yes" : "No"}
                />
                <DetailRow label="Product id" value={product.productId} />
                <DetailRow label="Created" value={formatDate(product.createdAt)} />
              </section>

              {product.galleryUrls && product.galleryUrls.length > 0 ? (
                <section>
                  <h3 className="mb-1.5 text-[12px] font-semibold text-muted-foreground">Images</h3>
                  <div className="flex flex-wrap gap-2">
                    {[product.imageUrl, ...product.galleryUrls].filter(Boolean).map((url, i) => (
                      <a
                        key={`${url}-${i}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="size-16 overflow-hidden rounded-md border border-border bg-muted"
                      >
                        <img src={url} alt="" className="size-full object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <h3 className="mb-1 text-[12px] font-semibold text-muted-foreground">Seller</h3>
                <DetailRow label="Seller id" value={product.sellerId} />
                <DetailRow label="Business name" value={seller?.businessName ?? ""} />
                <DetailRow label="Owner name" value={seller?.ownerName ?? ""} />
                <DetailRow label="Contact phone" value={seller?.contactPhone ?? ""} />
                <DetailRow label="Address" value={seller?.businessAddress ?? ""} />
              </section>

              <section>
                <h3 className="mb-1 text-[12px] font-semibold text-muted-foreground">Review</h3>
                <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                  <span className="text-muted-foreground">Status</span>
                  <StatusPill status={product.status} />
                </div>
                {product.reviewReason ? (
                  <DetailRow label="Rejection reason" value={product.reviewReason} />
                ) : null}
              </section>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {pending ? (
                <>
                  <Button variant="destructive" onClick={() => onReject(product)}>
                    Reject
                  </Button>
                  <Button onClick={() => onApprove(product)}>Accept</Button>
                </>
              ) : null}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Listing unavailable</DialogTitle>
              <DialogDescription>This listing may have been removed.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuperProducts() {
  const [sector, setSector] = useState<Sector | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("LISTED");
  const [selected, setSelected] = useState<string[]>([]);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [approving, setApproving] = useState<ProductRecord | null>(null);
  const [rejecting, setRejecting] = useState<ProductRecord | null>(null);
  const [reason, setReason] = useState("");

  // Authoritative read: the hydration slice is written once per login and persisted, so a newly
  // submitted request (or another admin's decision) would never show here without a fresh fetch.
  const all = useLiveProducts({ sector, query });
  const loading = all.loading && all.data.length === 0;
  const activeCount = all.data.filter((p) => p.status === "ACTIVE").length;
  const pendingCount = all.data.filter((p) => p.status === "PENDING_REVIEW").length;
  const needsChangesCount = all.data.filter((p) => p.status === "CHANGES_REQUESTED").length;
  const products = useMemo(
    () =>
      all.data.filter((p) => p.status === (viewMode === "LISTED" ? "ACTIVE" : "PENDING_REVIEW")),
    [all.data, viewMode],
  );

  function toggle(id: string) {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  function confirmApprove() {
    if (!approving) return;
    const id = approving.productId;
    setProductStatus(id, "ACTIVE");
    toast.success("Listing approved", { description: "It is visible to shoppers immediately." });
    setApproving(null);
    setSelected((list) => list.filter((x) => x !== id));
    // Re-read the server so the board and the KPIs reflect the decision (and any other admin's).
    all.refresh();
  }

  function confirmReject() {
    if (!rejecting) return;
    const message = reason.trim();
    if (!message) {
      toast.error("Add a reason so the seller knows what to fix");
      return;
    }
    const id = rejecting.productId;
    setProductStatus(id, "REJECTED", message);
    toast.success("Listing rejected", { description: "The seller will see your note." });
    setRejecting(null);
    setReason("");
    setSelected((list) => list.filter((x) => x !== id));
    all.refresh();
  }

  function deleteMany(ids: string[]) {
    ids.forEach((id) => deleteProduct(id, "Bulk removal by super admin"));
    setSelected([]);
    all.refresh();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Global catalog"
        description="Every listing across every state and seller. Switch between listed and requested products."
      />

      <KpiStrip
        items={[
          { label: "Active listings", value: formatNumber(activeCount) },
          { label: "Pending review", value: formatNumber(pendingCount) },
          { label: "Needs changes", value: formatNumber(needsChangesCount) },
          { label: "Showing", value: formatNumber(products.length) },
          { label: "Selected", value: formatNumber(selected.length) },
        ]}
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="flex items-center gap-1.5">
            <FilterChip
              label={VIEW_LABEL.LISTED}
              active={viewMode === "LISTED"}
              onClick={() => {
                setViewMode("LISTED");
                setSelected([]);
              }}
            />
            <FilterChip
              label={VIEW_LABEL.REQUESTED}
              active={viewMode === "REQUESTED"}
              onClick={() => {
                setViewMode("REQUESTED");
                setSelected([]);
              }}
            />
            <ComponentHelp id="view-mode-toggle" label="About the listed/requested switch" />
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search product or id"
              className="h-9 w-56"
            />
            <ComponentHelp id="product-search" label="About searching the catalog" />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={all.loading}
            onClick={() => all.refresh()}
          >
            <RefreshCw className={cn("size-3.5", all.loading && "animate-spin")} />
            {all.loading ? "Refreshing" : "Refresh"}
          </Button>
          {SECTORS.map((option) => (
            <FilterChip
              key={option}
              label={option === "ALL" ? "All sectors" : option}
              active={sector === option}
              onClick={() => setSector(option)}
            />
          ))}
          <ComponentHelp id="sector-filter" label="About the sector filter" />
          {selected.length > 0 ? (
            <div className="ml-auto flex items-center gap-1.5">
              <ComponentHelp id="approve-selected" label="About bulk approving" />
              <Button
                size="sm"
                onClick={() => {
                  const ids = [...selected];
                  ids.forEach((id) => setProductStatus(id, "ACTIVE", "Bulk approved"));
                  toast.success(`${ids.length} listings approved`);
                  setSelected([]);
                  all.refresh();
                }}
              >
                Approve selected
              </Button>
              <ComponentHelp id="delete-selected" label="About bulk deleting" />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    Delete selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selected.length} listings?</AlertDialogTitle>
                    <AlertDialogDescription>
                      They disappear from the consumer app immediately. The deletion is logged.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        const ids = [...selected];
                        deleteMany(ids);
                        toast.success(`${ids.length} listings removed`);
                      }}
                    >
                      Delete listings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null}
        </div>
        <DataShell
          loading={loading}
          isEmpty={products.length === 0}
          empty={
            <EmptyState
              title={
                viewMode === "LISTED" ? "No listed products match" : "No pending requests match"
              }
              description={
                viewMode === "LISTED"
                  ? "Clear the filters to see the full catalog."
                  : "No seller requests are waiting for a decision right now."
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <ComponentHelp id="bulk-select" label="About bulk selection" />
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Actions
                    <ComponentHelp id="view-details" label="About viewing details" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.productId} className="h-12">
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(product.productId)}
                      onCheckedChange={() => toggle(product.productId)}
                      aria-label={`Select ${product.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProductThumb product={product} />
                      <span className="text-[13px] font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SectorPill sector={product.sector} />
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {product.sellerId}
                  </TableCell>
                  <TableCell className="num text-right">{formatINR(product.pricePaisa)}</TableCell>
                  <TableCell>
                    <StatusPill status={product.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetailsId(product.productId)}
                      >
                        View details
                      </Button>
                      {product.status === "PENDING_REVIEW" ? (
                        <>
                          <Button size="sm" onClick={() => setApproving(product)}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejecting(product);
                              setReason("");
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <ProductDetailsDialog
        productId={detailsId}
        onClose={() => setDetailsId(null)}
        onApprove={(product) => {
          setDetailsId(null);
          setApproving(product);
        }}
        onReject={(product) => {
          setDetailsId(null);
          setRejecting(product);
          setReason("");
        }}
      />

      <AlertDialog open={approving !== null} onOpenChange={(open) => !open && setApproving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              {approving?.name} will become visible to shoppers immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove}>Approve listing</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <Label htmlFor="super-reject-reason">Reason</Label>
            <Textarea
              id="super-reject-reason"
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
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={reason.trim().length === 0}
            >
              Reject listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SuperProducts;
