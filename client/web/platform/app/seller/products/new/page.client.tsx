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
import { createProduct, updateStock } from "@/lib/api";
import { useSeller, useStores, useTaxCategories } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/patterns/ImageUploader";

const STEPS = ["Category", "Details", "Pricing", "Inventory", "Review"];

/** Fixed platform delivery fee, mirroring tax.platform_settings.delivery_fee_paisa. */
const DELIVERY_FEE_PAISA = 5000;
const PLATFORM_GST_PCT = 18;
const TCS_PCT = 1;
const TDS_PCT = 0.1;

function NewProduct() {
  const router = useRouter();
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const seller = useSeller(sellerId);
  const stores = useStores({ sellerId });
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
  const feePct = seller?.platformFeePct ?? 10;

  // Seller-facing breakdown of what will be withheld from this listing's price. The gateway is the
  // authority at settlement; this is a transparency preview using the same integer formulas.
  const taxablePaisa =
    taxRatePct > 0 ? Math.round((pricePaisa * 100) / (100 + taxRatePct)) : pricePaisa;
  const productTaxPaisa = pricePaisa - taxablePaisa;
  const commissionPaisa = Math.round((pricePaisa * feePct) / 100);
  const platformGstPaisa = Math.round((commissionPaisa * PLATFORM_GST_PCT) / 100);
  const tcsPaisa = Math.round((pricePaisa * TCS_PCT) / 100);
  const tdsPaisa = Math.round((pricePaisa * TDS_PCT) / 100);
  const sellerNetPaisa = pricePaisa - commissionPaisa - tcsPaisa - tdsPaisa;

  const stepValid = [
    Boolean(sector && category.trim()),
    name.trim().length > 2 && description.trim().length > 5 && images.length > 0,
    pricePaisa > 0,
    Number(quantity) >= 0,
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
      // MRP is no longer collected from sellers; the listing price is the single price.
      mrpPaisa: pricePaisa,
      isVeg,
      isPrescription,
      status: "PENDING_REVIEW",
    });
    // Delivery ETA is platform-owned (not a seller promise); default 30 minutes.
    updateStock(productId, Number(quantity), 30);
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
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[13px] font-medium">
                {sector}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Fixed by your registration. Contact an admin to change it.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="price">Selling price (₹)</Label>
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
              <Label>GST rate</Label>
              <div className="num rounded-md border border-border px-3 py-2 text-[13px]">
                {taxRatePct}%
              </div>
            </div>
            {pricePaisa > 0 ? <DeductionsCard
              pricePaisa={pricePaisa}
              taxablePaisa={taxablePaisa}
              productTaxPaisa={productTaxPaisa}
              commissionPaisa={commissionPaisa}
              platformGstPaisa={platformGstPaisa}
              tcsPaisa={tcsPaisa}
              tdsPaisa={tdsPaisa}
              sellerNetPaisa={sellerNetPaisa}
              feePct={feePct}
            /> : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Stock quantity</Label>
              <Input id="qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery</Label>
              <div className="num rounded-md border border-border px-3 py-2 text-[13px]">
                Platform-managed · {formatINR(DELIVERY_FEE_PAISA)} customer delivery fee
              </div>
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
          {pricePaisa > 0 ? (
            <div className="mt-3">
              <DeductionsCard
                pricePaisa={pricePaisa}
                taxablePaisa={taxablePaisa}
                productTaxPaisa={productTaxPaisa}
                commissionPaisa={commissionPaisa}
                platformGstPaisa={platformGstPaisa}
                tcsPaisa={tcsPaisa}
                tdsPaisa={tdsPaisa}
                sellerNetPaisa={sellerNetPaisa}
                feePct={feePct}
              />
            </div>
          ) : null}
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
            <Button size="sm" disabled={!stepValid[0] || pricePaisa <= 0} onClick={submit}>
              Submit for review
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

interface DeductionsProps {
  pricePaisa: number;
  taxablePaisa: number;
  productTaxPaisa: number;
  commissionPaisa: number;
  platformGstPaisa: number;
  tcsPaisa: number;
  tdsPaisa: number;
  sellerNetPaisa: number;
  feePct: number;
}

function DeductionsCard(props: DeductionsProps) {
  const rows: Array<[string, string, string?]> = [
    ["Taxable value", formatINR(props.taxablePaisa)],
    ["Product GST (customer pays)", formatINR(props.productTaxPaisa)],
    [`Platform fee (${props.feePct}%)`, `− ${formatINR(props.commissionPaisa)}`, "deducted"],
    ["GST on platform fee (18%)", formatINR(props.platformGstPaisa), "platform liability"],
    ["TCS (1%)", `− ${formatINR(props.tcsPaisa)}`, "deducted"],
    ["TDS (0.1%)", `− ${formatINR(props.tdsPaisa)}`, "deducted"],
  ];
  return (
    <div className="rounded-xl border border-border md:col-span-2">
      <div className="border-b border-border px-3 py-2">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          What you keep
        </p>
      </div>
      <dl className="divide-y divide-border">
        {rows.map(([label, value, hint]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
            <dt>
              {label}
              {hint ? (
                <span className="ml-1 text-[11px] text-muted-foreground">({hint})</span>
              ) : null}
            </dt>
            <dd className="num font-medium">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-3 py-2 text-[13px] font-semibold">
          <dt>Net seller payout per unit</dt>
          <dd className="num">{formatINR(props.sellerNetPaisa)}</dd>
        </div>
      </dl>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">
        Product GST is included in your price and is remitted by you. TCS/TDS are withheld from your
        payout; the platform files them against your GSTIN/PAN.
      </p>
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
