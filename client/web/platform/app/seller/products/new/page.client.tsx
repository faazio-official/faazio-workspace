"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { createProduct, fetchSellerStores, updateStock, type SellerStoreSummary } from "@/lib/api";
import { useSeller, useStores, useTaxCategories } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/patterns/ImageUploader";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

const STEPS = ["Category", "Details", "Pricing", "Inventory", "Review"];

function NewProduct() {
  const router = useRouter();
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const seller = useSeller(sellerId);
  const localStores = useStores({ sellerId });
  // The gateway only accepts a store the logged-in seller owns, so prefer its live store rows over
  // the seed directory (which can carry different ids/owners).
  const [serverStores, setServerStores] = useState<SellerStoreSummary[]>([]);
  const [storeId, setStoreId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let active = true;
    fetchSellerStores()
      .then((rows) => {
        if (active) setServerStores(rows);
      })
      .catch(() => {
        /* keep the seed directory as the offline fallback */
      });
    return () => {
      active = false;
    };
  }, []);
  const stores: SellerStoreSummary[] =
    serverStores.length > 0
      ? serverStores
      : localStores.map((s) => ({
          storeId: s.storeId,
          name: s.name,
          sector: s.sector,
          isLive: s.isLive,
        }));
  useEffect(() => {
    if (!storeId && stores[0]) setStoreId(stores[0].storeId);
  }, [storeId, stores]);
  const [step, setStep] = useState(0);

  // Sector is assigned at onboarding / by a super admin — a seller can never switch it here.
  const sector = seller?.category ?? "MART";
  const categories = useTaxCategories(sector);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("1 unit");
  const [images, setImages] = useState<string[]>([]);
  const [isVeg, setIsVeg] = useState(true);
  const [isPrescription, setIsPrescription] = useState(false);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("0");

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
        storeId: storeId || stores[0]?.storeId || "store-m1",
        name: name.trim(),
        description: description.trim(),
        sector,
        category: category.trim(),
        emoji: "",
        imageUrl: images[0] ?? "",
        galleryUrls: images.slice(1),
        unit,
        pricePaisa,
        // MRP is no longer collected from sellers; the listing price is the single price.
        mrpPaisa: pricePaisa,
        isVeg,
        isPrescription,
        status: "PENDING_REVIEW",
      });
      // Delivery ETA is platform-owned (not a seller promise); default 30 minutes.
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="List a new product"
        description="Submitted listings go to your district admin's approval queue."
      />

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium",
              index === step
                ? "border-primary bg-primary/10 text-primary"
                : index < step
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border text-muted-foreground",
            )}
          >
            <span className="num">{index + 1}</span> {label}
          </li>
        ))}
      </ol>

      <SectionCard
        title={STEPS[step]}
        description={`Step ${step + 1} of ${STEPS.length}`}
        actions={<ComponentHelp id="step-rail" label="About the listing steps" />}
      >
        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Sector</Label>
                <ComponentHelp id="sector-field" label="About the sector field" />
              </div>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[13px] font-medium">
                {sector}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Fixed by your registration. Contact an admin to change it.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Store</Label>
                <ComponentHelp id="store-select" label="About the store field" />
              </div>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick the store that stocks this listing" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.storeId} value={s.storeId}>
                      {s.name}
                      {s.isLive ? "" : " · offline"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Only stores your seller account owns are accepted by the gateway.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Category</Label>
                <ComponentHelp id="category-select" label="About the category field" />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick an approved category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.taxRateId} value={c.category}>
                      {c.category} · GST {c.gstRatePct}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Categories and their GST rates are controlled by the platform.
              </p>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="name">Product name</Label>
                <ComponentHelp id="name-input" label="About the product name" />
              </div>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="desc">Description</Label>
                <ComponentHelp id="description-input" label="About the description" />
              </div>
              <Textarea
                id="desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
            <div className="rounded-lg border border-border p-3 md:col-span-2">
              <ImageUploader images={images} onChange={setImages} />
              {images.length === 0 ? (
                <p className="mt-2 text-[12px] text-destructive">
                  At least one photo is required before this listing can go live.
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="veg">Vegetarian</Label>
                <ComponentHelp id="veg-switch" label="About the vegetarian flag" />
              </div>
              <Switch id="veg" checked={isVeg} onCheckedChange={setIsVeg} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="rx">Prescription required</Label>
                <ComponentHelp id="rx-switch" label="About the prescription flag" />
              </div>
              <Switch id="rx" checked={isPrescription} onCheckedChange={setIsPrescription} />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="price">Selling price (₹)</Label>
                <ComponentHelp id="price-input" label="About the selling price" />
              </div>
              <Input
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter the final price shoppers pay. GST is included, not added on top.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>GST rate</Label>
                <ComponentHelp id="gst-field" label="About the GST rate" />
              </div>
              <div className="num rounded-md border border-border px-3 py-2 text-[13px]">
                {taxRatePct}%
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="qty">Stock quantity</Label>
                <ComponentHelp id="stock-input" label="About stock quantity" />
              </div>
              <Input id="qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <>
          <div className="mb-3 flex flex-wrap gap-2">
            {images.map((src, index) => (
              <img
                key={index}
                src={src}
                alt={`${name || "Product"} photo ${index + 1}`}
                className="size-20 rounded-lg border border-border object-cover"
              />
            ))}
          </div>
          <dl className="grid gap-3 text-[13px] md:grid-cols-2">
            <Row label="Sector / category" value={`${sector} · ${category}`} />
            <Row label="Name" value={name} />
            <Row label="Unit" value={unit} />
            <Row label="Price (GST incl.)" value={formatINR(pricePaisa)} />
            <Row label="GST rate" value={`${taxRatePct}%`} />
            <Row label="Stock" value={`${quantity} units`} />
            <Row label="Prescription" value={isPrescription ? "Required" : "Not required"} />
            <Row label="Status on submit" value="PENDING_REVIEW" />
          </dl>
          </>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" disabled={!stepValid[step]} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                disabled={!stepValid[0] || pricePaisa <= 0 || submitting}
                onClick={() => void submit()}
              >
                {submitting ? "Submitting..." : "Submit for review"}
              </Button>
              <ComponentHelp id="submit-button" label="About submitting for review" />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  );
}

export default NewProduct;
