"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { EmptyState } from "@/components/patterns/DataState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { validatePrice } from "@/lib/pricing/rules";
import { deleteProduct, saveProductImage, updateProduct } from "@/lib/api";
import { useProduct } from "@/lib/api/hooks";
import { StatusPill } from "@/components/patterns/Pills";
import { ImageUploader } from "@/components/patterns/ImageUploader";
import { productGallery } from "@/lib/media/productImages";


function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const product = useProduct(id);
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [mrp, setMrp] = useState(product ? String(product.mrpPaisa / 100) : "");
  const [price, setPrice] = useState(product ? String(product.pricePaisa / 100) : "");
  const [isPrescription, setIsPrescription] = useState(product?.isPrescription ?? false);
  const [images, setImages] = useState<string[]>(product ? productGallery(product) : []);

  if (!product) {
    return (
      <SectionCard>
        <EmptyState
          title="Product not found"
          description="This listing may have been deleted by an admin."
          action={
            <Button asChild size="sm">
              <Link href="/seller/products">Back to products</Link>
            </Button>
          }
        />
      </SectionCard>
    );
  }

  const mrpPaisa = parseRupeesToPaisa(mrp);
  const pricePaisa = parseRupeesToPaisa(price);
  const check = validatePrice(mrpPaisa, pricePaisa);

  return (
    <div className="space-y-4">
      <PageHeader
        title={product.name}
        description={`${product.productId} · ${product.sector} · ${product.category}`}
        actions={<StatusPill status={product.status} />}
      />

      <SectionCard
        title="Photos"
        description="Exactly what shoppers see on the product page, cards and search results."
      >
        <ImageUploader images={images} onChange={setImages} />
        {images.length === 0 ? (
          <p className="mt-2 text-[12px] text-destructive">
            This listing has no photo — shoppers will skip it. Upload at least one.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Listing details">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mrp">MRP (₹)</Label>
            <Input id="mrp" value={mrp} onChange={(e) => setMrp(e.target.value)} inputMode="decimal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Selling price (₹)</Label>
            <Input id="price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 md:col-span-2">
            <Label htmlFor="rx">Prescription required</Label>
            <Switch id="rx" checked={isPrescription} onCheckedChange={setIsPrescription} />
          </div>
        </div>

        <p className="num mt-3 text-[12px] text-muted-foreground">
          New shelf price {formatINR(pricePaisa)} · discount {check.discountPercent}%
        </p>
        {!check.ok ? <p className="mt-1 text-[12px] text-destructive">{check.message}</p> : null}

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                Delete listing
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Shoppers lose this listing immediately. The action is written to the audit log.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep listing</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    deleteProduct(product.productId, "Seller removed listing");
                    toast.success("Listing deleted");
                    router.push("/seller/products");
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            size="sm"
            disabled={!check.ok || name.trim().length < 3}
            onClick={() => {
              updateProduct(product.productId, {
                name: name.trim(),
                description: description.trim(),
                mrpPaisa,
                pricePaisa,
                isPrescription,
                imageUrl: images[0] ?? "",
                galleryUrls: images.slice(1),
              });
              saveProductImage(product.productId, images[0]);
              toast.success("Listing updated");
            }}
          >
            Save changes
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

export default EditProduct;
