"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PageHeader, Card, Sheet, TextField, Toggle, EmptyState, FixedActionBar, RadioRow } from "@/components/sellers/kit";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { deleteProduct, saveProductImage, updateProduct, upsertPrice } from "@/lib/api";
import { useProduct } from "@/lib/api/hooks";
import { ImageUploader } from "@/components/patterns/ImageUploader";
import { productGallery } from "@/lib/media/productImages";
import { tamilFieldError } from "@/lib/tamil";
import { sectorLabel } from "@/lib/sector";
import { cn } from "@/lib/utils";
import { NET_UNITS, PACK_TYPES, RETURN_POLICIES, deriveUnit, lockedNetUnit } from "@/lib/productOptions";
import type { NetUnit, PackType, ProductStatus } from "@/data/types";

const STATUS_PILL: Record<ProductStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-warning-soft text-warning",
  ACTIVE: "bg-success-soft text-success",
  CHANGES_REQUESTED: "bg-warning-soft text-warning",
  REJECTED: "bg-brand-soft text-brand",
  DELISTED: "bg-muted text-muted-foreground",
};

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const product = useProduct(id);
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [nameTa, setNameTa] = useState(product?.nameTa ?? "");
  const [descriptionTa, setDescriptionTa] = useState(product?.descriptionTa ?? "");
  const nameTaError = tamilFieldError(nameTa, 200);
  const descriptionTaError = tamilFieldError(descriptionTa, 4000);
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [price, setPrice] = useState(product ? String(product.pricePaisa / 100) : "");
  const [mrp, setMrp] = useState(product?.mrpPaisa ? String(product.mrpPaisa / 100) : "");
  const [sameAsPrice, setSameAsPrice] = useState(!product?.mrpPaisa);
  const [packType, setPackType] = useState<PackType | "">(product?.packType ?? "");
  const [netQty, setNetQty] = useState(product?.netQty ? String(product.netQty) : "");
  const [netUnit, setNetUnit] = useState<NetUnit | "">(product?.netUnit ?? "");
  const locked = lockedNetUnit(packType);
  const [variantLabel, setVariantLabel] = useState(product?.variantLabel ?? "");
  const [isPrescription, setIsPrescription] = useState(product?.isPrescription ?? false);
  const [isVeg, setIsVeg] = useState(product?.isVeg ?? true);
  const [images, setImages] = useState<string[]>(product ? productGallery(product) : []);
  const lm = product?.attributes?.legalMetrology;
  const [countryOfOrigin, setCountryOfOrigin] = useState(lm?.countryOfOrigin ?? "India");
  const [manufacturerName, setManufacturerName] = useState(lm?.manufacturerName ?? "");
  const [manufacturerAddress, setManufacturerAddress] = useState(lm?.manufacturerAddress ?? "");
  const [packerName, setPackerName] = useState(lm?.packerName ?? "");
  const [packerAddress, setPackerAddress] = useState(lm?.packerAddress ?? "");
  const [shelfLifeDays, setShelfLifeDays] = useState(lm?.shelfLifeDays ? String(lm.shelfLifeDays) : "");
  const [storage, setStorage] = useState(lm?.storage ?? "");
  const [returnPolicy, setReturnPolicy] = useState(lm?.returnPolicy ?? RETURN_POLICIES[0]!.value);
  const [highlights, setHighlights] = useState(
    Array.isArray(product?.attributes?.highlights) ? (product?.attributes?.highlights as string[]).join("\n") : "",
  );
  const [ingredients, setIngredients] = useState(
    typeof product?.attributes?.ingredients === "string" ? product.attributes.ingredients : "",
  );
  const [saltComposition, setSaltComposition] = useState(
    typeof product?.attributes?.saltComposition === "string" ? product.attributes.saltComposition : "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [returnPicker, setReturnPicker] = useState(false);

  if (!product) {
    return (
      <>
        <PageHeader title="Product" />
        <div className="px-4 pt-4">
          <EmptyState text="This listing may have been deleted by an admin" />
          <Link href="/seller/products" className="block text-center text-sm font-semibold text-info">
            Back to products
          </Link>
        </div>
      </>
    );
  }

  const pricePaisa = parseRupeesToPaisa(price);
  const mrpPaisa = sameAsPrice ? pricePaisa : parseRupeesToPaisa(mrp);
  const derivedUnit = deriveUnit(packType, Number(netQty) || undefined, netUnit);
  const discountPct = mrpPaisa > pricePaisa ? Math.round(((mrpPaisa - pricePaisa) / mrpPaisa) * 100) : 0;
  const saveable =
    pricePaisa > 0 &&
    mrpPaisa >= pricePaisa &&
    name.trim().length >= 3 &&
    (!packType || Number(netQty) > 0) &&
    !nameTaError &&
    !descriptionTaError;

  return (
    <>
      <PageHeader
        title="Edit product"
        sub={product.name}
        right={
          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", STATUS_PILL[product.status])}>
            {product.status.replace(/_/g, " ")}
          </span>
        }
      />

      <div className="space-y-3 px-4 pt-3 pb-36">
        {product.status === "REJECTED" ? (
          <Card className="border-brand/30 bg-brand-soft">
            <p className="text-sm font-bold text-brand">This listing was rejected</p>
            <p className="mt-1 text-[12px] text-brand">
              {product.reviewReason?.trim() || "An admin asked for changes. Update the listing and submit it for review again."}
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
            <p className="mt-2 text-[11px] text-brand">This listing has no photo; shoppers will skip it. Upload at least one.</p>
          )}
        </Card>

        <Card>
          <p className="mb-2 text-sm font-bold">Listing details</p>
          <p className="text-[11px] text-muted-foreground">
            {product.productId} · {sectorLabel(product.sector)} · {product.category}
          </p>
          <TextField label="Name" value={name} onChange={setName} />
          <TextField label="Brand" value={brand} onChange={setBrand} />
          <TextField label="Description" value={description} onChange={setDescription} />
          <TextField label="Name (Tamil)" lang="ta" value={nameTa} onChange={setNameTa} placeholder="தமிழில் மட்டும்" />
          {nameTaError ? <p className="text-[11px] text-destructive">{nameTaError}</p> : null}
          <TextField label="Description (Tamil)" lang="ta" value={descriptionTa} onChange={setDescriptionTa} placeholder="தமிழில் மட்டும்" />
          {descriptionTaError ? <p className="text-[11px] text-destructive">{descriptionTaError}</p> : null}
          {product.sector !== "PHARMA" && (
            <div className="flex items-center justify-between border-t border-border py-3">
              <span className="text-sm font-medium">Vegetarian</span>
              <Toggle label="Vegetarian" checked={isVeg} onChange={setIsVeg} />
            </div>
          )}
          {product.sector === "PHARMA" && (
            <div className="flex items-center justify-between border-t border-border py-3">
              <span className="text-sm font-medium">Prescription required</span>
              <Toggle label="Prescription required" checked={isPrescription} onChange={setIsPrescription} />
            </div>
          )}
        </Card>

        <Card>
          <p className="mb-2 text-sm font-bold">Pack size</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={packType === ""} onClick={() => { setPackType(""); setNetQty(""); setNetUnit(""); }}>
              No pack size
            </Chip>
            {PACK_TYPES.map((p) => (
              <Chip key={p.value} active={packType === p.value} onClick={() => { setPackType(p.value); setNetUnit(lockedNetUnit(p.value) ?? "piece"); }}>
                {p.label}
              </Chip>
            ))}
          </div>
          {packType ? (
            <div className="mt-3 space-y-3">
              <TextField
                label={packType === "KG" || packType === "G" ? "Weight" : packType === "L" || packType === "ML" ? "Volume" : "Quantity in pack"}
                type="number"
                value={netQty}
                onChange={setNetQty}
              />
              {locked ? (
                <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
                  Net unit: <b>{locked}</b>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {NET_UNITS.slice(0, 4).map((u) => (
                    <Chip key={u.value} active={netUnit === u.value} onClick={() => setNetUnit(u.value)}>
                      {u.label}
                    </Chip>
                  ))}
                </div>
              )}
              {derivedUnit ? <p className="text-[12px] font-semibold text-success">Shoppers see: {derivedUnit}</p> : null}
              <TextField label="Variant label" value={variantLabel} onChange={setVariantLabel} placeholder={derivedUnit || "e.g. Shade 04"} />
            </div>
          ) : null}
        </Card>

        <Card>
          <p className="mb-2 text-sm font-bold">Price & MRP</p>
          <TextField label="Selling price (₹, GST included)" type="number" value={price} onChange={setPrice} />
          <div className="flex items-center justify-between border-t border-border py-3">
            <div>
              <p className="text-sm font-medium">Same as selling price</p>
              <p className="text-[11px] text-muted-foreground">Turn off to declare a higher MRP and show a discount.</p>
            </div>
            <Toggle label="Same as selling price" checked={sameAsPrice} onChange={setSameAsPrice} />
          </div>
          {!sameAsPrice && (
            <>
              <TextField label="MRP (₹)" type="number" value={mrp} onChange={setMrp} />
              {pricePaisa > 0 && mrpPaisa < pricePaisa ? (
                <p className="text-[11px] text-brand">MRP cannot be lower than the selling price.</p>
              ) : null}
              {discountPct > 0 ? (
                <p className="text-[12px] font-semibold text-success">
                  Shoppers see ₹{mrpPaisa / 100} struck through, ₹{pricePaisa / 100} and {discountPct}% OFF.
                </p>
              ) : null}
            </>
          )}
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">GST</p>
            <p className="mt-1 text-xs">Rate is set by the platform category master.</p>
          </div>
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            New shelf price <b className="text-foreground">{pricePaisa > 0 ? formatINR(pricePaisa) : "—"}</b> · GST included
          </p>
          {pricePaisa <= 0 && <p className="mt-1 text-[11px] text-brand">Enter a price greater than zero.</p>}
        </Card>

        <Card>
          <p className="mb-2 text-sm font-bold">Compliance profile</p>
          <TextField label="Country of origin" value={countryOfOrigin} onChange={setCountryOfOrigin} />
          <TextField label="Manufacturer name" value={manufacturerName} onChange={setManufacturerName} />
          <TextField label="Manufacturer address" value={manufacturerAddress} onChange={setManufacturerAddress} />
          <TextField label="Packer name" value={packerName} onChange={setPackerName} />
          <TextField label="Packer address" value={packerAddress} onChange={setPackerAddress} />
          <TextField label="Shelf life (days)" type="number" value={shelfLifeDays} onChange={setShelfLifeDays} />
          <TextField label="Storage instructions" value={storage} onChange={setStorage} />
          <Card onClick={() => setReturnPicker(true)} className="mt-1 cursor-pointer border-border shadow-none">
            <p className="text-xs font-medium text-muted-foreground">Return policy</p>
            <p className="mt-1 text-sm font-semibold">{RETURN_POLICIES.find((p) => p.value === returnPolicy)?.label ?? "Pick a policy"}</p>
          </Card>
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Highlights (one per line)</p>
            <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Ingredients</p>
            <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
          </div>
          {product.sector === "PHARMA" && <TextField label="Salt composition" value={saltComposition} onChange={setSaltComposition} />}
        </Card>
      </div>

      <FixedActionBar>
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
            const attributes = {
              ...(product.attributes ?? {}),
              highlights: highlights.split("\n").map((l) => l.trim()).filter(Boolean),
              ...(ingredients.trim() ? { ingredients: ingredients.trim() } : {}),
              ...(product.sector === "PHARMA" && saltComposition.trim() ? { saltComposition: saltComposition.trim() } : {}),
              legalMetrology: {
                countryOfOrigin: countryOfOrigin.trim(),
                ...(manufacturerName.trim() ? { manufacturerName: manufacturerName.trim() } : {}),
                ...(manufacturerAddress.trim() ? { manufacturerAddress: manufacturerAddress.trim() } : {}),
                ...(packerName.trim() ? { packerName: packerName.trim() } : {}),
                ...(packerAddress.trim() ? { packerAddress: packerAddress.trim() } : {}),
                ...(shelfLifeDays ? { shelfLifeDays: Number(shelfLifeDays) } : {}),
                ...(storage.trim() ? { storage: storage.trim() } : {}),
                returnPolicy,
              },
            };
            updateProduct(product.productId, {
              name: name.trim(),
              description: description.trim(),
              nameTa: nameTa.trim(),
              descriptionTa: descriptionTa.trim(),
              brand: brand.trim(),
              ...(packType ? { packType, netQty: Number(netQty), netUnit: (netUnit || "piece") as NetUnit } : {}),
              variantLabel: variantLabel.trim(),
              attributes,
              ...(product.sector !== "PHARMA" ? { isVeg } : {}),
              ...(product.sector === "PHARMA" ? { isPrescription } : {}),
              imageUrl: images[0] ?? "",
              galleryUrls: images.slice(1),
            });
            upsertPrice(product.productId, pricePaisa, mrpPaisa);
            saveProductImage(product.productId, images[0]);
            toast.success("Listing updated");
          }}
          className="flex-[2] rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
        >
          Save changes
        </button>
      </FixedActionBar>

      <Sheet open={returnPicker} onClose={() => setReturnPicker(false)} title="Return policy">
        {RETURN_POLICIES.map((p) => (
          <RadioRow key={p.value} label={p.label} checked={returnPolicy === p.value} onClick={() => { setReturnPolicy(p.value); setReturnPicker(false); }} />
        ))}
      </Sheet>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${product.name}?`}
        footer={
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold">
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
          Shoppers lose this listing immediately. It moves to Trash, where you can restore it for 7 days before it is permanently removed. The action is written to the audit log.
        </p>
      </Sheet>
    </>
  );
}

export default EditProduct;
