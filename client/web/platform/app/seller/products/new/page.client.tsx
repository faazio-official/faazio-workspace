"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Card, Sheet, RadioRow, TextField, Toggle, EmptyState, FixedActionBar } from "@/components/sellers/kit";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { createProduct, updateStock } from "@/lib/api";
import { useCategoryTree, useProduct, useSellerScope } from "@/lib/api/hooks";
import { sectorLabel } from "@/lib/sector";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/patterns/ImageUploader";
import { tamilFieldError } from "@/lib/tamil";
import {
  NET_UNITS,
  PACK_TYPES,
  RETURN_POLICIES,
  complianceFromStore,
  deriveUnit,
  lockedNetUnit,
} from "@/lib/productOptions";
import type { NetUnit, PackType, Sector } from "@/data/types";

const STEPS = ["Category", "Basics", "Pack & price", "Compliance", "Review"];

/** Statutory rates mirrored from tax.platform_settings; the gateway remains authoritative. */
const PLATFORM_GST_PCT = 18;
const TCS_PCT = 1;
const TDS_PCT = 0.1;

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NewProduct() {
  const router = useRouter();
  const { sellerId, stores, activeStore, loading } = useSellerScope();
  const [storeId, setStoreId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!storeId && activeStore) setStoreId(activeStore.storeId);
  }, [storeId, activeStore]);
  const [step, setStep] = useState(0);
  const [taxonomyCategoryId, setTaxonomyCategoryId] = useState("");
  const [taxonomyName, setTaxonomyName] = useState("");

  const pickedStore = storeId ? stores.find((s) => s.storeId === storeId) : undefined;
  const sector: Sector = pickedStore?.sector ?? activeStore?.sector ?? "MART";
  const tree = useCategoryTree(sector);
  const leaves = useMemo(() => {
    const parents = new Set(tree.map((c) => c.parentId).filter((id): id is string => Boolean(id)));
    return tree.filter((c) => !parents.has(c.id));
  }, [tree]);
  const taxonomyParentName = (id: string | null) =>
    id ? tree.find((c) => c.id === id)?.name ?? "" : "";

  const [sectorForCategory, setSectorForCategory] = useState("");
  useEffect(() => {
    if (sectorForCategory && sectorForCategory !== sector) {
      setTaxonomyCategoryId("");
      setTaxonomyName("");
    }
    setSectorForCategory(sector);
  }, [sector, sectorForCategory]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameTa, setNameTa] = useState("");
  const [descriptionTa, setDescriptionTa] = useState("");
  const nameTaError = tamilFieldError(nameTa, 200);
  const descriptionTaError = tamilFieldError(descriptionTa, 4000);
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("1 unit");
  const [images, setImages] = useState<string[]>([]);
  const [isVeg, setIsVeg] = useState(true);
  const [isPrescription, setIsPrescription] = useState(false);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("0");

  const [packType, setPackType] = useState<PackType | "">("");
  const [netQty, setNetQty] = useState("");
  const [netUnit, setNetUnit] = useState<NetUnit | "">("");
  const locked = lockedNetUnit(packType);
  useEffect(() => {
    if (locked) setNetUnit(locked);
  }, [locked]);
  const derivedUnit = deriveUnit(packType, Number(netQty) || undefined, netUnit);

  const [sameAsPrice, setSameAsPrice] = useState(true);
  const [mrp, setMrp] = useState("");

  const [countryOfOrigin, setCountryOfOrigin] = useState("India");
  const [manufacturerName, setManufacturerName] = useState("");
  const [manufacturerAddress, setManufacturerAddress] = useState("");
  const [packerName, setPackerName] = useState("");
  const [packerAddress, setPackerAddress] = useState("");
  const [shelfLifeDays, setShelfLifeDays] = useState("");
  const [storage, setStorage] = useState("");
  const [returnPolicy, setReturnPolicy] = useState(RETURN_POLICIES[0]!.value);
  const [highlights, setHighlights] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [saltComposition, setSaltComposition] = useState("");

  const [variantOf, setVariantOf] = useState("");
  const [variantLabel, setVariantLabel] = useState("");
  const sourceProduct = useProduct(variantOf);
  const prefilledStore = useRef(false);
  const prefilledVariant = useRef(false);

  // Read `?variantOf=` without useSearchParams (keeps this page a plain client component).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("variantOf") ?? "";
    setVariantOf(id);
  }, []);

  // Prefill the shop's saved compliance profile once.
  useEffect(() => {
    if (!activeStore || prefilledStore.current) return;
    prefilledStore.current = true;
    const defaults = complianceFromStore(
      activeStore.name,
      activeStore.address ?? "",
      activeStore.complianceDefaults,
    );
    setCountryOfOrigin(defaults.countryOfOrigin ?? "India");
    setManufacturerName(defaults.manufacturerName ?? "");
    setManufacturerAddress(defaults.manufacturerAddress ?? "");
    setPackerName(defaults.packerName ?? "");
    setPackerAddress(defaults.packerAddress ?? "");
    setReturnPolicy(defaults.returnPolicy ?? RETURN_POLICIES[0]!.value);
    if (defaults.shelfLifeDays) setShelfLifeDays(String(defaults.shelfLifeDays));
    if (defaults.storage) setStorage(defaults.storage);
    if (activeStore.sector === "MART") setBrand((b) => b || activeStore.name);
  }, [activeStore]);

  // Prefill from the product the seller chose to duplicate as a variant.
  useEffect(() => {
    if (!sourceProduct || prefilledVariant.current) return;
    prefilledVariant.current = true;
    setStoreId(sourceProduct.storeId || storeId);
    setTaxonomyCategoryId(sourceProduct.taxonomyCategoryId ?? "");
    setTaxonomyName(sourceProduct.category ?? "");
    setName(sourceProduct.name);
    setDescription(sourceProduct.description ?? "");
    setBrand(sourceProduct.brand ?? "");
    setPackType(sourceProduct.packType ?? "");
    setNetQty(sourceProduct.netQty ? String(sourceProduct.netQty) : "");
    setNetUnit(sourceProduct.netUnit ?? "");
    setSameAsPrice(!sourceProduct.mrpPaisa);
    setMrp(sourceProduct.mrpPaisa ? String(sourceProduct.mrpPaisa / 100) : "");
    setIsVeg(sourceProduct.isVeg);
    setIsPrescription(sourceProduct.isPrescription);
    setVariantLabel(sourceProduct.variantLabel ?? "");
    setUnit(sourceProduct.unit);
  }, [sourceProduct, storeId]);

  const [storePicker, setStorePicker] = useState(false);
  const [taxPicker, setTaxPicker] = useState(false);
  const [packPicker, setPackPicker] = useState(false);
  const [unitPicker, setUnitPicker] = useState(false);
  const [returnPicker, setReturnPicker] = useState(false);

  const pricePaisa = parseRupeesToPaisa(price);
  const mrpPaisa = sameAsPrice ? pricePaisa : parseRupeesToPaisa(mrp);
  const taxRatePct = leaves.find((c) => c.id === taxonomyCategoryId)?.gstRatePct ?? 5;
  const feePct = pickedStore?.platformFeePct ?? 0;

  const taxablePaisa =
    taxRatePct > 0 ? Math.round((pricePaisa * 100) / (100 + taxRatePct)) : pricePaisa;
  const productTaxPaisa = pricePaisa - taxablePaisa;
  const commissionPaisa = Math.round((pricePaisa * feePct) / 100);
  const platformGstPaisa = Math.round((commissionPaisa * PLATFORM_GST_PCT) / 100);
  const tcsPaisa = Math.round((pricePaisa * TCS_PCT) / 100);
  const tdsPaisa = Math.round((pricePaisa * TDS_PCT) / 100);
  const sellerNetPaisa = pricePaisa - commissionPaisa - tcsPaisa - tdsPaisa;
  const discountPct = mrpPaisa > pricePaisa ? Math.round(((mrpPaisa - pricePaisa) / mrpPaisa) * 100) : 0;
  const complianceReady = Boolean(countryOfOrigin.trim() && (manufacturerName.trim() || packerName.trim()));

  const stepValid = [
    Boolean(sector && storeId && taxonomyCategoryId),
    name.trim().length > 2 && description.trim().length > 5 && images.length > 0 && !nameTaError && !descriptionTaError,
    pricePaisa > 0 && mrpPaisa >= pricePaisa && (!packType || Number(netQty) > 0),
    complianceReady && Number(quantity) >= 0,
    true,
  ];

  async function submit() {
    if (submitting) return;
    if (mrpPaisa < pricePaisa) {
      toast.error("MRP cannot be lower than the selling price");
      return;
    }
    setSubmitting(true);
    try {
      const variantGroupId = variantOf ? sourceProduct?.variantGroupId || variantOf : undefined;
      const created = await createProduct({
        sellerId,
        storeId,
        name: name.trim(),
        description: description.trim(),
        nameTa: nameTa.trim(),
        descriptionTa: descriptionTa.trim(),
        sector,
        category: taxonomyName.trim(),
        taxonomyCategoryId,
        emoji: "",
        imageUrl: images[0] ?? "",
        galleryUrls: images.slice(1),
        unit: derivedUnit || unit,
        pricePaisa,
        mrpPaisa,
        brand: brand.trim(),
        ...(packType ? { packType, netQty: Number(netQty), netUnit: (netUnit || "piece") as NetUnit } : {}),
        ...(variantGroupId ? { variantGroupId, variantLabel: variantLabel.trim() || derivedUnit } : {}),
        attributes: {
          highlights: highlights
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          ...(ingredients.trim() ? { ingredients: ingredients.trim() } : {}),
          ...(sector === "PHARMA" && saltComposition.trim() ? { saltComposition: saltComposition.trim() } : {}),
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
        },
        isVeg: sector === "PHARMA" ? false : isVeg,
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
              <div className={cn("h-1.5 rounded-full", index <= step ? "bg-foreground" : "bg-muted")} />
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
        {variantOf ? (
          <p className="px-1 pt-1 text-[11px] text-info">Adding a variant of {sourceProduct?.name ?? "an existing listing"}</p>
        ) : null}
      </div>

      <div className="space-y-3 px-4 pt-3 pb-36">
        {step === 0 && (
          <>
            <Card>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sector</p>
              <p className="mt-1 text-sm">
                {sectorLabel(sector)}
                <span className="ml-2 text-[11px] text-muted-foreground">Fixed by your registration.</span>
              </p>
            </Card>
            <Card onClick={() => setStorePicker(true)} className="cursor-pointer">
              <p className="text-xs font-medium text-muted-foreground">Store</p>
              <p className="mt-1 text-sm font-semibold">
                {stores.find((s) => s.storeId === storeId)?.name ?? "Pick the store that stocks this listing"}
              </p>
            </Card>
            <Card onClick={() => setTaxPicker(true)} className="cursor-pointer">
              <p className="text-xs font-medium text-muted-foreground">Category</p>
              <p className="mt-1 text-sm font-semibold">{taxonomyName || "Pick an approved category"}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Sets the home rail / drill-in leaf and its mandatory GST ({taxRatePct}%).
              </p>
            </Card>
          </>
        )}

        {step === 1 && (
          <Card>
            <TextField label="Product name" value={name} onChange={setName} />
            <TextField label="Brand" value={brand} onChange={setBrand} placeholder="e.g. Clinique" />
            <TextField label="Description" value={description} onChange={setDescription} />
            <TextField label="Product name (Tamil)" lang="ta" value={nameTa} onChange={setNameTa} placeholder="தமிழில் மட்டும்" />
            {nameTaError ? <p className="text-[11px] text-destructive">{nameTaError}</p> : null}
            <TextField
              label="Description (Tamil)"
              lang="ta"
              value={descriptionTa}
              onChange={setDescriptionTa}
              placeholder="தமிழில் மட்டும்"
            />
            {descriptionTaError ? <p className="text-[11px] text-destructive">{descriptionTaError}</p> : null}
            <div className="rounded-xl border border-dashed border-border p-3">
              <ImageUploader images={images} onChange={setImages} />
              {images.length === 0 && (
                <p className="mt-2 text-[11px] text-brand">At least one photo is required before this listing can go live.</p>
              )}
              {images.length === 1 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Add 1–4 more photos so shoppers can see the product from every side.
                </p>
              )}
            </div>
            {sector !== "PHARMA" && (
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
          <>
            <Card>
              <p className="mb-2 text-sm font-bold">Pack size</p>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Pick the form, then the amount. This is what shoppers see as “500 g”, “1 kg” or “Pack of 6”.
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip active={packType === ""} onClick={() => { setPackType(""); setNetQty(""); setNetUnit(""); }}>
                  No pack size
                </Chip>
                {PACK_TYPES.map((p) => (
                  <Chip
                    key={p.value}
                    active={packType === p.value}
                    onClick={() => {
                      setPackType(p.value);
                      const lock = lockedNetUnit(p.value);
                      setNetUnit(lock ?? "piece");
                    }}
                  >
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
                    placeholder={packType === "G" ? "500" : packType === "ML" ? "30" : "1"}
                  />
                  {locked ? (
                    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
                      Net unit: <b>{locked}</b>
                      <span className="ml-2 text-[11px] text-muted-foreground">Fixed by the pack type.</span>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Each item is a</p>
                      <div className="flex flex-wrap gap-2">
                        {NET_UNITS.slice(0, 4).map((u) => (
                          <Chip key={u.value} active={netUnit === u.value} onClick={() => setNetUnit(u.value)}>
                            {u.label}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                  {derivedUnit ? (
                    <p className="text-[12px] font-semibold text-success">Shoppers see: {derivedUnit}</p>
                  ) : null}
                  <TextField
                    label="Variant label (optional)"
                    value={variantLabel}
                    onChange={setVariantLabel}
                    placeholder={derivedUnit || "e.g. Shade 04"}
                  />
                </div>
              ) : null}
            </Card>

            <Card>
              <TextField label="Selling price (₹, GST included)" type="number" value={price} onChange={setPrice} />
              <p className="text-[11px] text-muted-foreground">Shoppers pay this final price. GST is included, not added on top.</p>
              <div className="mt-3 flex items-center justify-between border-t border-border py-3">
                <div>
                  <p className="text-sm font-medium">Same as selling price</p>
                  <p className="text-[11px] text-muted-foreground">Turn off to declare a higher MRP and show a discount.</p>
                </div>
                <Toggle label="Same as selling price" checked={sameAsPrice} onChange={setSameAsPrice} />
              </div>
              {!sameAsPrice && (
                <>
                  <TextField label="MRP (₹)" type="number" value={mrp} onChange={setMrp} />
                  {mrpPaisa > 0 && pricePaisa > 0 && mrpPaisa < pricePaisa ? (
                    <p className="text-[11px] text-brand">MRP cannot be lower than the selling price.</p>
                  ) : null}
                  {discountPct > 0 ? (
                    <p className="text-[12px] font-semibold text-success">
                      Shoppers see ₹{mrpPaisa / 100} struck through, ₹{pricePaisa / 100} and {discountPct}% OFF.
                    </p>
                  ) : null}
                </>
              )}
              <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">GST rate</p>
                <p className="mt-1 text-sm font-bold">{taxRatePct}%</p>
              </div>
              {pricePaisa > 0 && (
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
              )}
            </Card>
          </>
        )}

        {step === 3 && (
          <>
            <Card>
              <p className="mb-2 text-sm font-bold">Compliance profile</p>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Required for Indian e-commerce. We prefill your shop defaults — edit only when this product differs.
              </p>
              <TextField label="Country of origin" value={countryOfOrigin} onChange={setCountryOfOrigin} />
              <TextField label="Manufacturer name" value={manufacturerName} onChange={setManufacturerName} />
              <TextField label="Manufacturer address" value={manufacturerAddress} onChange={setManufacturerAddress} />
              <TextField label="Packer name" value={packerName} onChange={setPackerName} />
              <TextField label="Packer address" value={packerAddress} onChange={setPackerAddress} />
              <TextField label="Shelf life (days)" type="number" value={shelfLifeDays} onChange={setShelfLifeDays} />
              <TextField label="Storage instructions" value={storage} onChange={setStorage} />
              <Card onClick={() => setReturnPicker(true)} className="mt-1 cursor-pointer border-border shadow-none">
                <p className="text-xs font-medium text-muted-foreground">Return policy</p>
                <p className="mt-1 text-sm font-semibold">
                  {RETURN_POLICIES.find((p) => p.value === returnPolicy)?.label ?? "Pick a policy"}
                </p>
              </Card>
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Highlights (one per line)</p>
                <textarea
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                  rows={3}
                  placeholder={"Dermatologist tested\nFragrance free"}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Ingredients</p>
                <textarea
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              {sector === "PHARMA" && (
                <TextField label="Salt composition" value={saltComposition} onChange={setSaltComposition} />
              )}
            </Card>
            <Card>
              <TextField label="Stock quantity" type="number" value={quantity} onChange={setQuantity} />
              <p className="text-[11px] text-muted-foreground">Delivery ETA is platform-owned (30 minutes by default).</p>
            </Card>
          </>
        )}

        {step === 4 && (
          <Card>
            <div className="mb-3 flex flex-wrap gap-2">
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
              <Row label="Sector / category" value={`${sectorLabel(sector)} · ${taxonomyName}`} />
              <Row label="Name" value={name} />
              <Row label="Brand" value={brand} />
              <Row label="Pack size" value={derivedUnit || unit} />
              <Row label="MRP" value={formatINR(mrpPaisa)} />
              <Row label="Price (GST incl.)" value={formatINR(pricePaisa)} />
              <Row label="Discount" value={discountPct > 0 ? `${discountPct}% OFF` : "None"} />
              <Row label="GST rate" value={`${taxRatePct}%`} />
              <Row label="Stock" value={`${quantity} units`} />
              <Row label="Country of origin" value={countryOfOrigin} />
              <Row label="Manufacturer" value={manufacturerName || "—"} />
              <Row label="Return policy" value={RETURN_POLICIES.find((p) => p.value === returnPolicy)?.label ?? "—"} />
              {sector === "PHARMA" && <Row label="Prescription" value={isPrescription ? "Required" : "Not required"} />}
              <Row label="Status on submit" value="PENDING_REVIEW" />
            </dl>
            {pricePaisa > 0 && (
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
            )}
          </Card>
        )}
      </div>

      <FixedActionBar>
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
      </FixedActionBar>

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

      <Sheet open={taxPicker} onClose={() => setTaxPicker(false)} title="Category">
        {leaves.length === 0 ? (
          <p className="px-1 py-3 text-[12px] text-muted-foreground">
            No categories are configured for {sectorLabel(sector)} yet. Ask an admin to add one.
          </p>
        ) : (
          leaves.map((c) => (
            <RadioRow
              key={c.id}
              label={c.name}
              sub={`${taxonomyParentName(c.parentId) || "Top level"} · GST ${c.gstRatePct ?? 5}%`}
              checked={taxonomyCategoryId === c.id}
              onClick={() => {
                setTaxonomyCategoryId(c.id);
                setTaxonomyName(c.name);
                setTaxPicker(false);
              }}
            />
          ))
        )}
      </Sheet>

      <Sheet open={returnPicker} onClose={() => setReturnPicker(false)} title="Return policy">
        {RETURN_POLICIES.map((p) => (
          <RadioRow
            key={p.value}
            label={p.label}
            checked={returnPolicy === p.value}
            onClick={() => {
              setReturnPolicy(p.value);
              setReturnPicker(false);
            }}
          />
        ))}
      </Sheet>
    </>
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

function DeductionsCard({
  pricePaisa,
  taxablePaisa,
  productTaxPaisa,
  commissionPaisa,
  platformGstPaisa,
  tcsPaisa,
  tdsPaisa,
  sellerNetPaisa,
  feePct,
}: DeductionsProps) {
  const rows: Array<[string, string, string?]> = [
    ["Customer pays (GST incl.)", formatINR(pricePaisa)],
    ["Taxable value", formatINR(taxablePaisa)],
    ["Product GST (remitted by you)", formatINR(productTaxPaisa)],
    [`Platform fee (${feePct}%)`, `− ${formatINR(commissionPaisa)}`, "withheld"],
    ["GST on platform fee (18%)", formatINR(platformGstPaisa), "platform liability"],
    ["TCS (1%)", `− ${formatINR(tcsPaisa)}`, "withheld"],
    ["TDS (0.1%)", `− ${formatINR(tdsPaisa)}`, "withheld"],
  ];
  return (
    <div className="mt-3 rounded-xl border border-border">
      <div className="border-b border-border px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">What you keep (per unit)</p>
      </div>
      <dl className="divide-y divide-border">
        {rows.map(([label, value, hint]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
            <dt>
              {label}
              {hint ? <span className="ml-1 text-[11px] text-muted-foreground">({hint})</span> : null}
            </dt>
            <dd className="num font-medium">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-3 py-2 text-[13px] font-semibold">
          <dt>Net seller payout per unit</dt>
          <dd className="num">{formatINR(sellerNetPaisa)}</dd>
        </div>
      </dl>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">
        Estimate using your shop&apos;s fee and the approved GST rate. The gateway recomputes the final split at settlement.
      </p>
    </div>
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
