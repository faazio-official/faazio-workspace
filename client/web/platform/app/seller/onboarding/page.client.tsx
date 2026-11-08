"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { PageHeader, Card, TextField, Toggle, Sheet, RadioRow, EmptyState, FixedActionBar } from "@/components/sellers/kit";
import { createSellerVendor } from "@/lib/api";
import { useSellerScope, useStates } from "@/lib/api/hooks";
import { uploadPrivateDocument } from "@/lib/media/kyc";
import { cn } from "@/lib/utils";
import type { Sector } from "@/data/types";

const APPS: Sector[] = ["MART", "FOOD", "PHARMA"];

function AddVendor() {
  const router = useRouter();
  const { sellerId, setActiveStoreId } = useSellerScope();
  const states = useStates();
  const [form, setForm] = useState({
    name: "",
    app: "MART" as Sector,
    address: "",
    phone: "",
    hours: "10:00 AM - 9:30 PM",
    stateCode: "TN",
    fssaiNumber: "",
    fssaiFileKey: "",
    fssaiAssetId: "",
    drugLicenseNumber: "",
    drugLicenseFileKey: "",
    drugLicenseAssetId: "",
    isLive: false,
  });
  const [busy, setBusy] = useState(false);
  const [statePicker, setStatePicker] = useState(false);

  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function attachCertificate(file: File) {
    try {
      const uploaded = await uploadPrivateDocument(file);
      setForm((f) => ({ ...f, fssaiFileKey: uploaded.key, fssaiAssetId: uploaded.assetId }));
      toast.success("FSSAI certificate uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the certificate");
    }
  }

  async function attachDrugLicense(file: File) {
    try {
      const uploaded = await uploadPrivateDocument(file);
      setForm((f) => ({
        ...f,
        drugLicenseFileKey: uploaded.key,
        drugLicenseAssetId: uploaded.assetId,
      }));
      toast.success("Drug licence document uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the document");
    }
  }

  const hasFssai = form.fssaiNumber.trim() !== "" && form.fssaiFileKey !== "";
  const valid = sellerId !== "" && form.name.trim().length > 2;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const vendor = await createSellerVendor({
        name: form.name.trim(),
        app: form.app,
        address: form.address.trim(),
        phone: form.phone.trim(),
        hours: form.hours.trim(),
        isLive: form.isLive,
        ...(form.app === "FOOD" && hasFssai
          ? {
              fssaiNumber: form.fssaiNumber.trim(),
              fssaiFileKey: form.fssaiFileKey,
              fssaiAssetId: form.fssaiAssetId,
            }
          : {}),
        ...(form.app === "PHARMA" &&
        form.drugLicenseNumber.trim() !== "" &&
        form.drugLicenseFileKey !== ""
          ? {
              drugLicenseNumber: form.drugLicenseNumber.trim(),
              drugLicenseFileKey: form.drugLicenseFileKey,
              drugLicenseAssetId: form.drugLicenseAssetId,
            }
          : {}),
      });
      setActiveStoreId(vendor.storeId);
      toast.success("Vendor created");
      router.push("/seller");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the vendor");
    } finally {
      setBusy(false);
    }
  }

  const state = states.find((s) => s.stateCode === form.stateCode);

  return (
    <>
      <PageHeader title="Add a vendor" sub="Onboarding" />

      <div className="space-y-3 px-4 pt-3 pb-36">
        <Card>
          <p className="text-sm font-bold">Vendor details</p>
          <p className="mb-1 text-[10px] text-muted-foreground">
            A vendor is one shop in one app. Your account can own several vendors.
          </p>
          <TextField label="Vendor name" value={form.name} onChange={(v) => field("name", v)} />

          <p className="mt-2 mb-1 text-xs font-medium text-muted-foreground">App</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {APPS.map((a) => (
              <button
                key={a}
                onClick={() => field("app", a)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold",
                  form.app === a
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card",
                )}
              >
                {a === "MART" ? "Mart" : a === "FOOD" ? "Food" : "Pharma"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStatePicker(true)}
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-left text-sm"
          >
            <span className="block text-[10px] font-medium text-muted-foreground">State</span>
            <span className="font-semibold">
              {form.stateCode}
              {state ? ` · ${state.name}` : ""}
            </span>
          </button>

          <TextField label="Address" value={form.address} onChange={(v) => field("address", v)} />
          <TextField label="Phone" value={form.phone} onChange={(v) => field("phone", v)} />
          <TextField label="Opening hours" value={form.hours} onChange={(v) => field("hours", v)} />

          <div className="flex items-center justify-between border-t border-border py-3">
            <span className="text-sm font-medium">Publish this vendor now</span>
            <Toggle label="Publish now" checked={form.isLive} onChange={(v) => field("isLive", v)} />
          </div>
        </Card>

        {form.app === "FOOD" && (
          <Card>
            <p className="text-sm font-bold">FSSAI compliance (optional)</p>
            <p className="mb-1 text-[10px] text-muted-foreground">
              Add both now or later; an admin verifies compliance during review.
            </p>
            <TextField
              label="FSSAI number"
              value={form.fssaiNumber}
              onChange={(v) => field("fssaiNumber", v.toUpperCase())}
            />
            <label className="block py-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                FSSAI certificate
              </span>
              <span className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-4 text-xs font-semibold text-muted-foreground">
                <Upload className="h-4 w-4" />
                {form.fssaiFileKey ? "Certificate uploaded ✓" : "Tap to upload (JPG / PNG / WEBP)"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void attachCertificate(file);
                }}
              />
            </label>
          </Card>
        )}

        {/* PHARMA licences persist to directory.stores (0076). Optional at creation — the uploaded
            file goes to the seller's private Storage and the shop can attach/change the licence later
            from Stores. An empty licence never sends the trio (the gateway keeps them paired). */}
        {form.app === "PHARMA" && (
          <Card>
            <p className="text-sm font-bold">Drug licence (optional)</p>
            <p className="mb-1 text-[10px] text-muted-foreground">
              Add both now or later; an admin verifies the licence during review.
            </p>
            <TextField
              label="Drug licence number"
              value={form.drugLicenseNumber}
              onChange={(v) => field("drugLicenseNumber", v.toUpperCase())}
            />
            <label className="block py-2">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Licence document
              </span>
              <span className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-4 text-xs font-semibold text-muted-foreground">
                <Upload className="h-4 w-4" />
                {form.drugLicenseFileKey ? "Document uploaded ✓" : "Tap to upload (JPG / PNG / WEBP)"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void attachDrugLicense(file);
                }}
              />
            </label>
          </Card>
        )}
      </div>

      <FixedActionBar>
        <button
          disabled={!valid || busy}
          onClick={() => void submit()}
          className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
        >
          {busy ? "Creating..." : "Create vendor"}
        </button>
      </FixedActionBar>

      <Sheet open={statePicker} onClose={() => setStatePicker(false)} title="Select state">
        {states.length === 0 ? (
          <EmptyState text="No states loaded" />
        ) : (
          states.map((s) => (
            <RadioRow
              key={s.stateCode}
              label={`${s.stateCode} · ${s.name}`}
              checked={form.stateCode === s.stateCode}
              onClick={() => {
                field("stateCode", s.stateCode);
                setStatePicker(false);
              }}
            />
          ))
        )}
      </Sheet>
    </>
  );
}

export default AddVendor;