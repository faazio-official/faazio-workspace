"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSellerVendor } from "@/lib/api";
import { useSellerScope, useStates } from "@/lib/api/hooks";
import { uploadPrivateDocument } from "@/lib/media/kyc";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import type { Sector } from "@/data/types";

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
    isLive: false,
  });
  const [busy, setBusy] = useState(false);

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

  const valid =
    sellerId !== "" &&
    form.name.trim().length > 2 &&
    (form.app !== "FOOD" || (form.fssaiNumber.trim() !== "" && form.fssaiFileKey !== ""));

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
        ...(form.app === "FOOD"
          ? {
              fssaiNumber: form.fssaiNumber.trim(),
              fssaiFileKey: form.fssaiFileKey,
              fssaiAssetId: form.fssaiAssetId,
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Add a vendor"
        description="A vendor is one shop in one app. Your account can own several vendors (Mart, Food, Pharma)."
      />

      <SectionCard title="Vendor details" description="The brand, fee and compliance fields belong to this shop.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="vendor-name">Vendor name</Label>
              <ComponentHelp id="store-name-input" />
            </div>
            <Input id="vendor-name" value={form.name} onChange={(e) => field("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>App</Label>
            <Select value={form.app} onValueChange={(v) => field("app", v as Sector)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MART">Mart</SelectItem>
                <SelectItem value="FOOD">Food</SelectItem>
                <SelectItem value="PHARMA">Pharma</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Select value={form.stateCode} onValueChange={(v) => field("stateCode", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {states.map((s) => (
                  <SelectItem key={s.stateCode} value={s.stateCode}>
                    {s.stateCode} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-address">Address</Label>
            <Input
              id="vendor-address"
              value={form.address}
              onChange={(e) => field("address", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-phone">Phone</Label>
            <Input id="vendor-phone" value={form.phone} onChange={(e) => field("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-hours">Opening hours</Label>
            <Input id="vendor-hours" value={form.hours} onChange={(e) => field("hours", e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 md:col-span-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="live">Publish this vendor now</Label>
              <ComponentHelp id="live-switch" />
            </div>
            <Switch id="live" checked={form.isLive} onCheckedChange={(v) => field("isLive", v)} />
          </div>
        </div>

        {form.app === "FOOD" ? (
          <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fssai">FSSAI number</Label>
              <Input
                id="fssai"
                value={form.fssaiNumber}
                onChange={(e) => field("fssaiNumber", e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label>FSSAI certificate</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void attachCertificate(file);
                  }}
                />
                <Upload className="size-4 text-muted-foreground" />
              </div>
              {form.fssaiFileKey ? (
                <p className="num text-[11px] text-muted-foreground">{form.fssaiFileKey}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end border-t border-border pt-4">
          <div className="flex items-center gap-1.5">
            <Button size="sm" disabled={!valid || busy} onClick={() => void submit()}>
              Create vendor
            </Button>
            <ComponentHelp id="submit-button" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export default AddVendor;
