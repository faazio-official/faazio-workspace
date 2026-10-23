"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { validatePrice } from "@/lib/pricing/rules";
import { createProduct, updateStock } from "@/lib/api";
import { useStores } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import type { Sector } from "@/data/types";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/patterns/ImageUploader";


const STEPS = ["Category", "Details", "Pricing", "Inventory", "Review"];

function NewProduct() {
  const router = useRouter();
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const stores = useStores({ sellerId });
  const [step, setStep] = useState(0);

  const [sector, setSector] = useState<Sector>("MART");
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("1 unit");
  const [images, setImages] = useState<string[]>([]);
  const [isVeg, setIsVeg] = useState(true);
  const [isPrescription, setIsPrescription] = useState(false);
  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [eta, setEta] = useState("30");

  const mrpPaisa = parseRupeesToPaisa(mrp);
  const pricePaisa = parseRupeesToPaisa(price);
  const priceCheck = validatePrice(mrpPaisa, pricePaisa);

  const stepValid = [
    Boolean(sector && category.trim()),
    name.trim().length > 2 && description.trim().length > 5 && images.length > 0,
    mrpPaisa > 0 && priceCheck.ok,
    Number(quantity) >= 0 && Number(eta) > 0,
    true,
  ];

  function submit() {
    const productId = `${sector.slice(0, 2).toLowerCase()}-${Date.now().toString().slice(-5)}`;
    createProduct({
      productId,
      sellerId,
      storeId: stores[0]?.storeId ?? "store-m1",
      name: name.trim(),
      description: description.trim(),
      sector,
      category: category.trim(),
      emoji: "",
      imageUrl: images[0] ?? "",
      galleryUrls: images.slice(1),
      unit,
      pricePaisa,
      mrpPaisa,
      isVeg,
      isPrescription,
      status: "PENDING_REVIEW",
    });
    updateStock(productId, Number(quantity), Number(eta));
    toast.success("Product submitted for review");
    router.push("/seller/products");
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
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold",
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

      <SectionCard title={STEPS[step]} description={`Step ${step + 1} of ${STEPS.length}`}>
        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sector</Label>
              <Select value={sector} onValueChange={(v) => setSector(v as Sector)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MART">MART</SelectItem>
                  <SelectItem value="FOOD">FOOD</SelectItem>
                  <SelectItem value="PHARMA">PHARMA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Audio, Grocery, Thali, Devices…"
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="name">Product name</Label>
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
              <Label htmlFor="veg">Vegetarian</Label>
              <Switch id="veg" checked={isVeg} onCheckedChange={setIsVeg} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="rx">Prescription required</Label>
              <Switch id="rx" checked={isPrescription} onCheckedChange={setIsPrescription} />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="mrp">MRP (₹)</Label>
              <Input id="mrp" value={mrp} onChange={(e) => setMrp(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Selling price (₹)</Label>
              <Input
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Discount</Label>
              <p className="num rounded-md border border-border px-3 py-2 text-[13px]">
                {priceCheck.discountPercent}%
              </p>
            </div>
            {!priceCheck.ok && (mrp || price) ? (
              <p className="text-[12px] text-destructive md:col-span-3">{priceCheck.message}</p>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Stock quantity</Label>
              <Input id="qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eta">Delivery ETA (minutes)</Label>
              <Input id="eta" value={eta} onChange={(e) => setEta(e.target.value)} inputMode="numeric" />
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
            <Row label="Price" value={`${formatINR(pricePaisa)} (MRP ${formatINR(mrpPaisa)})`} />
            <Row label="Discount" value={`${priceCheck.discountPercent}%`} />
            <Row label="Stock / ETA" value={`${quantity} units · ${eta} min`} />
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
            <Button size="sm" onClick={submit}>
              Submit for review
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="num mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  );
}

export default NewProduct;
