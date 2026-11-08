"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PageHeader, Card, Sheet, TextField, Toggle, EmptyState } from "@/components/sellers/kit";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { deleteProduct, saveProductImage, updateProduct, upsertPrice } from "@/lib/api";
import { useProduct } from "@/lib/api/hooks";
import { ImageUploader } from "@/components/patterns/ImageUploader";
import { productGallery } from "@/lib/media/productImages";
import { sectorLabel } from "@/lib/sector";
import { cn } from "@/lib/utils";
import type { ProductStatus } from "@/data/types";

const STATUS_PILL: Record<ProductStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-warning-soft text-warning",
  ACTIVE: "bg-success-soft text-success",
  REJECTED: "bg-brand-soft text-brand",
  DELISTED: "bg-muted text-muted-foreground",
};

function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const product = useProduct(id);
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.pricePaisa / 100) : "");
  const [isPrescription, setIsPrescription] = useState(product?.isPrescription ?? false);
  const [isVeg, setIsVeg] = useState(product?.isVeg ?? true);
  const [images, setImages] = useState<string[]>(product ? productGallery(product) : []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!product) {
    return (
      <div className="px-4 pt-4">
        <PageHeader title="Product" />
        <EmptyState text="This listing may have been deleted by an admin" />
        <Link
          href="/seller/products"
          className="block text-center text-sm font-semibold text-info"
        >
          Back to products
        </Link>
      </div>
    );
  }

  const pricePaisa = parseRupeesToPaisa(price);
  const saveable = pricePaisa > 0 && name.trim().length >= 3;

  return (
    <>
      <PageHeader
        title="Edit product"
        sub={product.name}
        right={
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
              STATUS_PILL[product.status],
            )}
          >
            {product.status.replace(/_/g, " ")}
          </span>
        }
      />

      <div className="space-y-3 px-4 pt-3 pb-36">
        {product.status === "REJECTED" ? (
          <Card className="border-brand/30 bg-brand-soft">
            <p className="text-sm font-bold text-brand">This listing was rejected</p>
            <p className="mt-1 text-[12px] text-brand">
              {product.reviewReason?.trim() ||
                "An admin asked for changes. Update the listing and submit it for review again."}
            </p>
          </Card>
        ) : null}
        <Card>
          <p className="mb-2 text-sm font-bold">Photos</p>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Exactly what shoppers see on the product page, cards and search results.
          </p>
          <ImageUploader images={images} onChange={setImages} />
          {images.length === 0 && (
            <p className="mt-2 text-[11px] text-brand">
              This listing has no photo; shoppers will skip it. Upload at least one.
            </p>
          )}
        </Card>

        <Card>
          <p className="mb-2 text-sm font-bold">Listing details</p>
          <p className="text-[11px] text-muted-foreground">
            {product.productId} · {sectorLabel(product.sector)} · {product.category}
          </p>
          <TextField label="Name" value={name} onChange={setName} />
          <TextField label="Description" value={description} onChange={setDescription} />
          <TextField
            label="Selling price (₹, GST included)"
            type="number"
            value={price}
            onChange={setPrice}
          />
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              GST
            </p>
            <p className="mt-1 text-xs">Rate is set by the platform category master.</p>
          </div>
          {product.sector === "FOOD" && (
            <div className="flex items-center justify-between border-t border-border py-3">
              <span className="text-sm font-medium">Vegetarian</span>
              <Toggle label="Vegetarian" checked={isVeg} onChange={setIsVeg} />
            </div>
          )}
          {product.sector === "PHARMA" && (
            <div className="flex items-center justify-between border-t border-border py-3">
              <span className="text-sm font-medium">Prescription required</span>
              <Toggle
                label="Prescription required"
                checked={isPrescription}
                onChange={setIsPrescription}
              />
            </div>
          )}
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            New shelf price{" "}
            <b className="text-foreground">
              {pricePaisa > 0 ? formatINR(pricePaisa) : "—"}
            </b>{" "}
            · GST included
          </p>
          {pricePaisa <= 0 && (
            <p className="mt-1 text-[11px] text-brand">Enter a price greater than zero.</p>
          )}
        </Card>
      </div>

      <div className="fixed bottom-[76px] left-1/2 flex w-full max-w-[430px] -translate-x-1/2 gap-2 border-t border-border bg-card p-3 md:bottom-0 md:max-w-[1024px]">
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-brand"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
        <button
          disabled={!saveable}
          onClick={() => {
            updateProduct(product.productId, {
              name: name.trim(),
              description: description.trim(),
              ...(product.sector === "FOOD" ? { isVeg } : {}),
              ...(product.sector === "PHARMA" ? { isPrescription } : {}),
              imageUrl: images[0] ?? "",
              galleryUrls: images.slice(1),
            });
            upsertPrice(product.productId, pricePaisa);
            saveProductImage(product.productId, images[0]);
            toast.success("Listing updated");
          }}
          className="flex-[2] rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
        >
          Save changes
        </button>
      </div>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${product.name}?`}
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
            >
              Keep listing
            </button>
            <button
              onClick={() => {
                deleteProduct(product.productId, "Seller removed listing");
                toast.success("Listing deleted");
                router.push("/seller/products");
              }}
              className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Delete
            </button>
          </div>
        }
      >
        <p className="pb-2 text-xs text-muted-foreground">
          Shoppers lose this listing immediately. The action is written to the audit log.
        </p>
      </Sheet>
    </>
  );
}

export default EditProduct;