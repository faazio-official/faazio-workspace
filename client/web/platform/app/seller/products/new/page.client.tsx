"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Card, Sheet, RadioRow, TextField, Toggle, EmptyState } from "@/components/sellers/kit";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { createProduct, updateStock } from "@/lib/api";
import { useSellerScope, useTaxCategories } from "@/lib/api/hooks";
import { sectorLabel } from "@/lib/sector";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/patterns/ImageUploader";
import type { Sector } from "@/data/types";

const STEPS = ["Category", "Details", "Pricing", "Inventory", "Review"];

function NewProduct() {
  const router = useRouter();
  const { sellerId, stores, activeStore, loading } = useSellerScope();
  const [storeId, setStoreId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!storeId && activeStore) setStoreId(activeStore.storeId);
  }, [storeId, activeStore]);
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState("");

  // Sector follows the picked store — a seller can own Mart + Food + Pharma shops, so the listing
  // must carry the picked store's sector (productId prefix, category list, veg/Rx toggles).
  const pickedStore = storeId ? stores.find((s) => s.storeId === storeId) : undefined;
  const sector: Sector = pickedStore?.sector ?? activeStore?.sector ?? "MART";
  const categories = useTaxCategories(sector);

  // If the chosen store belongs to another sector, the previously picked category no longer exists.
  const [sectorForCategory, setSectorForCategory] = useState("");
  useEffect(() => {
    if (sectorForCategory && sectorForCategory !== sector) setCategory("");
    setSectorForCategory(sector);
  }, [sector, sectorForCategory]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("1 unit");
  const [images, setImages] = useState<string[]>([]);
  const [isVeg, setIsVeg] = useState(true);
  const [isPrescription, setIsPrescription] = useState(false);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("0");

  const [storePicker, setStorePicker] = useState(false);
  const [catPicker, setCatPicker] = useState(false);

  const pricePaisa = parseRupeesToPaisa(price);
  const selected = categories.find((c) => c.category === category);
  const taxRatePct = selected?.gstRatePct ?? 5;

  const stepValid = [
    Boolean(sector && storeId && category.trim()),
    name.trim().length > 2 && description.trim().length > 5 && images.length > 0,
    pricePaisa > 0,
    Number(quantity) >= 0,
    true,
  ];

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    const productId = `${sector.slice(0, 2).toLowerCase()}-${Date.now().toString().slice(-5)}`;
    try {
      const created = await createProduct({
        productId,
        sellerId,
        storeId,
        name: name.trim(),
        description: description.trim(),
        sector,
        category: category.trim(),
        emoji: "",
        imageUrl: images[0] ?? "",
        galleryUrls: images.slice(1),
        unit,
        pricePaisa,
        mrpPaisa: pricePaisa,
        isVeg: sector === "FOOD" ? isVeg : false,
        isPrescription: sector === "PHARMA" ? isPrescription : false,
        status: "PENDING_REVIEW",
      });
      updateStock(created.productId, Number(quantity), 30);
      toast.success("Product submitted for review");
      router.push("/seller/products");
    } catch (error) {
      toast.error("Could not submit listing", {
        description:
          error instanceof Error && error.message
            ? error.message
            : "The server rejected the listing. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && stores.length === 0) {
    return (
      <>
        <PageHeader title="List a new product" sub="Catalog" />
        <div className="px-4 pt-4">
          <Card>
            <EmptyState
              icon={<span className="text-3xl">🏪</span>}
              text="Listings belong to a shop. Create your first vendor first, then come back to list products."
            />
            <Link
              href="/seller/onboarding"
              className="block rounded-xl bg-foreground py-3 text-center text-sm font-semibold text-background"
            >
              Create a shop
            </Link>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="List a new product" sub={`Step ${step + 1} of ${STEPS.length}`} />

      <div className="px-4 pt-3">
        <div className="flex items-center gap-1.5">
          {STEPS.map((label, index) => (
            <div key={label} className="flex-1">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  index <= step ? "bg-foreground" : "bg-muted",
                )}
              />
              <p
                className={cn(
                  "mt-1.5 hidden text-center text-[9px] font-semibold uppercase tracking-wide sm:block",
                  index === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
        <p className="px-1 pt-2 text-sm font-bold">{STEPS[step]}</p>
      </div>

      <div className="space-y-3 px-4 pt-3 pb-36">
        {step === 0 && (
          <>
            <Card>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sector</p>
              <p className="mt-1 text-sm">
                {sectorLabel(sector)}
                <span className="ml-2 text-[11px] text-muted-foreground">
                  Fixed by your registration.
                </span>
              </p>
            </Card>
            <Card onClick={() => setStorePicker(true)} className="cursor-pointer">
              <p className="text-xs font-medium text-muted-foreground">Store</p>
              <p className="mt-1 text-sm font-semibold">
                {stores.find((s) => s.storeId === storeId)?.name ?? "Pick the store that stocks this listing"}
              </p>
            </Card>
            <Card onClick={() => setCatPicker(true)} className="cursor-pointer">
              <p className="text-xs font-medium text-muted-foreground">Category</p>
              <p className="mt-1 text-sm font-semibold">
                {category ? `${category} · GST ${taxRatePct}%` : "Pick an approved category"}
              </p>
            </Card>
          </>
        )}

        {step === 1 && (
          <Card>
            <TextField label="Product name" value={name} onChange={setName} />
            <TextField label="Description" value={description} onChange={setDescription} />
            <TextField label="Unit" value={unit} onChange={setUnit} />
            <div className="rounded-xl border border-dashed border-border p-3">
              <ImageUploader images={images} onChange={setImages} />
              {images.length === 0 && (
                <p className="mt-2 text-[11px] text-brand">
                  At least one photo is required before this listing can go live.
                </p>
              )}
            </div>
            {sector === "FOOD" && (
              <div className="flex items-center justify-between border-t border-border py-3">
                <span className="text-sm font-medium">Vegetarian</span>
                <Toggle label="Vegetarian" checked={isVeg} onChange={setIsVeg} />
              </div>
            )}
            {sector === "PHARMA" && (
              <div className="flex items-center justify-between border-t border-border py-3 last:border-0">
                <span className="text-sm font-medium">Prescription required</span>
                <Toggle label="Prescription required" checked={isPrescription} onChange={setIsPrescription} />
              </div>
            )}
          </Card>
        )}

        {step === 2 && (
          <Card>
            <TextField
              label="Selling price (₹, GST included)"
              type="number"
              value={price}
              onChange={setPrice}
            />
            <p className="text-[11px] text-muted-foreground">
              Shoppers pay this final price. GST is included, not added on top.
            </p>
            <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                GST rate
              </p>
              <p className="mt-1 text-sm font-bold">{taxRatePct}%</p>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <TextField
              label="Stock quantity"
              type="number"
              value={quantity}
              onChange={setQuantity}
            />
            <p className="text-[11px] text-muted-foreground">
              Delivery ETA is platform-owned (30 minutes by default).
            </p>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <div className="mb-3 flex gap-2">
              {images.map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt={`${name || "Product"} photo ${index + 1}`}
                  className="h-16 w-16 rounded-lg border border-border object-cover"
                />
              ))}
            </div>
            <dl className="divide-y divide-border text-sm">
              <Row label="Sector / category" value={`${sectorLabel(sector)} · ${category}`} />
              <Row label="Name" value={name} />
              <Row label="Unit" value={unit} />
              <Row label="Price (GST incl.)" value={formatINR(pricePaisa)} />
              <Row label="GST rate" value={`${taxRatePct}%`} />
              <Row label="Stock" value={`${quantity} units`} />
              {sector === "PHARMA" && (
                <Row label="Prescription" value={isPrescription ? "Required" : "Not required"} />
              )}
              <Row label="Status on submit" value="PENDING_REVIEW" />
            </dl>
          </Card>
        )}
      </div>

      <div className="fixed bottom-[76px] left-1/2 flex w-full max-w-[430px] -translate-x-1/2 gap-2 border-t border-border bg-card p-3 md:bottom-0 md:max-w-[1024px]">
        <button
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            disabled={!stepValid[step]}
            onClick={() => setStep((s) => s + 1)}
            className="flex-[2] rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            disabled={!stepValid[0] || pricePaisa <= 0 || submitting}
            onClick={() => void submit()}
            className="flex-[2] rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
          >
            {submitting ? "Submitting..." : "Submit for review"}
          </button>
        )}
      </div>

      <Sheet open={storePicker} onClose={() => setStorePicker(false)} title="Store">
        {stores.map((s) => (
          <RadioRow
            key={s.storeId}
            label={s.name}
            sub={s.isLive ? "Live" : "Offline"}
            checked={storeId === s.storeId}
            onClick={() => {
              setStoreId(s.storeId);
              setStorePicker(false);
            }}
          />
        ))}
      </Sheet>

      <Sheet open={catPicker} onClose={() => setCatPicker(false)} title="Category">
        {categories.map((c) => (
          <RadioRow
            key={c.taxRateId}
            label={c.category}
            sub={`GST ${c.gstRatePct}%`}
            checked={category === c.category}
            onClick={() => {
              setCategory(c.category);
              setCatPicker(false);
            }}
          />
        ))}
      </Sheet>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}

export default NewProduct;