"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Store, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, TextField, Toggle, EmptyState, SectorBadge } from "@/components/sellers/kit";
import { StorePinPicker, type PinValue } from "@/components/sellers/StorePinPicker";
import { updateSellerStore } from "@/lib/api";
import { useSellerStores } from "@/lib/api/hooks";
import { uploadPrivateDocument } from "@/lib/media/kyc";
import { tamilFieldError } from "@/lib/tamil";
import { RETURN_POLICIES } from "@/lib/productOptions";
import type { LegalMetrology } from "@/data/types";

type VendorDraft = {
  hours: string;
  nameTa: string;
  descTa: string;
  drugLicenseNumber: string;
  drugLicenseFileKey: string;
  drugLicenseAssetId: string;
  /** Restock defaults (0123) — retail only; kept as strings so a half-typed field is not a 0. */
  restockQty: string;
  restockEtaMinutes: string;
  /** Saved legal-metrology profile (0137). */
  countryOfOrigin: string;
  manufacturerName: string;
  manufacturerAddress: string;
  packerName: string;
  packerAddress: string;
  shelfLifeDays: string;
  storage: string;
  returnPolicy: string;
};

function draftFor(store: {
  hours?: string | undefined;
  nameTa?: string | undefined;
  descTa?: string | undefined;
  drugLicenseNumber?: string | undefined;
  drugLicenseCertKey?: string | undefined;
  drugLicenseCertAssetId?: string | undefined;
  restockQty: number;
  restockEtaMinutes: number;
  complianceDefaults?: LegalMetrology | undefined;
}): VendorDraft {
  const lm = store.complianceDefaults;
  return {
    hours: store.hours ?? "",
    nameTa: store.nameTa ?? "",
    descTa: store.descTa ?? "",
    drugLicenseNumber: store.drugLicenseNumber ?? "",
    drugLicenseFileKey: store.drugLicenseCertKey ?? "",
    drugLicenseAssetId: store.drugLicenseCertAssetId ?? "",
    restockQty: String(store.restockQty),
    restockEtaMinutes: String(store.restockEtaMinutes),
    countryOfOrigin: lm?.countryOfOrigin ?? "India",
    manufacturerName: lm?.manufacturerName ?? "",
    manufacturerAddress: lm?.manufacturerAddress ?? "",
    packerName: lm?.packerName ?? "",
    packerAddress: lm?.packerAddress ?? "",
    shelfLifeDays: lm?.shelfLifeDays ? String(lm.shelfLifeDays) : "",
    storage: lm?.storage ?? "",
    returnPolicy: lm?.returnPolicy ?? RETURN_POLICIES[0]!.value,
  };
}

function SellerStores() {
  const { stores, loading, reload } = useSellerStores();
  const [drafts, setDrafts] = useState<Record<string, VendorDraft>>({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const store of stores) {
        if (!next[store.storeId]) {
          next[store.storeId] = draftFor(store);
        }
      }
      return next;
    });
  }, [stores]);

  const updateDraft = (storeId: string, patch: Partial<VendorDraft>) =>
    setDrafts((d) => (d[storeId] ? { ...d, [storeId]: { ...d[storeId], ...patch } } : d));

  const save = async (
    storeId: string,
    patch: {
      hours?: string;
      nameTa?: string;
      descTa?: string;
      isLive?: boolean;
      isVeg?: boolean;
      drugLicenseNumber?: string;
      drugLicenseFileKey?: string;
      drugLicenseAssetId?: string;
      latitude?: number;
      longitude?: number;
      restockQty?: number;
      restockEtaMinutes?: number;
      complianceDefaults?: LegalMetrology;
    },
  ) => {
    try {
      await updateSellerStore(storeId, patch);
      toast.success("Vendor saved");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the vendor");
    }
  };

  async function attachDrugLicence(storeId: string, file: File) {
    try {
      const uploaded = await uploadPrivateDocument(file);
      updateDraft(storeId, {
        drugLicenseFileKey: uploaded.key,
        drugLicenseAssetId: uploaded.assetId,
      });
      toast.success("Drug licence document uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the document");
    }
  }

  const saveDrugLicence = async (storeId: string) => {
    const draft = drafts[storeId];
    if (!draft) return;
    if (draft.drugLicenseNumber.trim() === "" && draft.drugLicenseFileKey === "") return;
    if (draft.drugLicenseNumber.trim() === "" || draft.drugLicenseFileKey === "") {
      toast.error("Enter both the licence number and the document before saving");
      return;
    }
    await save(storeId, {
      drugLicenseNumber: draft.drugLicenseNumber.trim(),
      drugLicenseFileKey: draft.drugLicenseFileKey,
      drugLicenseAssetId: draft.drugLicenseAssetId,
    });
  };

  return (
    <>
      <PageHeader
        title="Stores"
        sub="Account"
        right={
          <Link
            href="/seller/onboarding"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Add shop
          </Link>
        }
      />
      <div className="space-y-3 px-4 pt-3 pb-8">
        {loading && stores.length === 0 ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Store className="h-12 w-12" strokeWidth={1.2} />}
              text="No vendor yet — create your first shop to start selling."
            />
            <Link
              href="/seller/onboarding"
              className="block rounded-xl bg-foreground py-3 text-center text-sm font-semibold text-background"
            >
              Create a shop
            </Link>
          </Card>
        ) : (
          stores.map((store) => {
            const draft = drafts[store.storeId] ?? draftFor(store);
            return (
              <Card key={store.storeId}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{store.name}</p>
                    {store.nameTa ? (
                      <p lang="ta" className="truncate text-[11px] text-muted-foreground">
                        {store.nameTa}
                      </p>
                    ) : null}
                    <p className="truncate text-[11px] text-muted-foreground">
                      {store.address || "Address not set"} · {store.platformFeePct}% platform fee
                    </p>
                    {store.latitude === undefined || store.longitude === undefined ? (
                      <p className="mt-1 text-[11px] font-semibold text-destructive">
                        No location pin — this shop cannot be auto-assigned a rider and quotes the
                        base delivery fee. Set it below.
                      </p>
                    ) : null}
                    <Link
                      href="/seller/fee-change-request"
                      className="mt-1 inline-block text-[11px] font-semibold text-info"
                    >
                      Request a fee change
                    </Link>
                  </div>
                  <span className="shrink-0">
                    <SectorBadge sector={store.sector} />
                  </span>
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between border-b border-border py-3">
                    <span className="text-sm font-medium">Vendor live in the app</span>
                    <Toggle
                      label="Vendor live"
                      checked={store.isLive}
                      onChange={(v) => void save(store.storeId, { isLive: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between border-b border-border py-3">
                    <span className="text-sm font-medium">Pure vegetarian</span>
                    <Toggle
                      label="Pure vegetarian"
                      checked={store.isVeg}
                      onChange={(v) => void save(store.storeId, { isVeg: v })}
                    />
                  </div>
                  <div className="pt-2">
                    <TextField
                      label="Opening hours"
                      value={draft.hours}
                      onChange={(v) => updateDraft(store.storeId, { hours: v })}
                    />
                    <TextField
                      label="Tamil shop name (optional)"
                      value={draft.nameTa}
                      lang="ta"
                      placeholder="தமிழில் கடை பெயர்"
                      onChange={(v) => updateDraft(store.storeId, { nameTa: v })}
                    />
                    <TextField
                      label="Tamil description (optional)"
                      value={draft.descTa}
                      lang="ta"
                      placeholder="தமிழில் விவரம்"
                      onChange={(v) => updateDraft(store.storeId, { descTa: v })}
                    />
                  </div>
                  {store.sector !== "FOOD" && (
                    <div className="border-t border-border pt-3">
                      <p className="text-[11px] font-semibold">Restock defaults</p>
                      <p className="mb-2 text-[11px] text-muted-foreground">
                        What Inventory applies when you turn a SKU back on.
                      </p>
                      <div className="flex gap-2">
                        <TextField
                          label="Units"
                          value={draft.restockQty}
                          onChange={(v) =>
                            updateDraft(store.storeId, { restockQty: v.replace(/[^0-9]/g, "") })
                          }
                        />
                        <TextField
                          label="ETA (min)"
                          value={draft.restockEtaMinutes}
                          onChange={(v) =>
                            updateDraft(store.storeId, {
                              restockEtaMinutes: v.replace(/[^0-9]/g, ""),
                            })
                          }
                        />
                      </div>
                      <button
                        onClick={() => {
                          const qty = Number(draft.restockQty);
                          const eta = Number(draft.restockEtaMinutes);
                          if (!Number.isInteger(qty) || qty < 1 || qty > 100000) {
                            toast.error("Units must be between 1 and 100000");
                            return;
                          }
                          if (!Number.isInteger(eta) || eta < 0 || eta > 600) {
                            toast.error("ETA must be between 0 and 600 minutes");
                            return;
                          }
                          void save(store.storeId, { restockQty: qty, restockEtaMinutes: eta });
                        }}
                        className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold"
                      >
                        Save restock defaults
                      </button>
                    </div>
                  )}
                  <div className="border-t border-border pt-3">
                    <p className="text-[11px] font-semibold">Compliance defaults</p>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      Prefilled into every new listing so you are not retyping legal metrology.
                    </p>
                    <TextField
                      label="Country of origin"
                      value={draft.countryOfOrigin}
                      onChange={(v) => updateDraft(store.storeId, { countryOfOrigin: v })}
                    />
                    <TextField
                      label="Manufacturer name"
                      value={draft.manufacturerName}
                      onChange={(v) => updateDraft(store.storeId, { manufacturerName: v })}
                    />
                    <TextField
                      label="Manufacturer address"
                      value={draft.manufacturerAddress}
                      onChange={(v) => updateDraft(store.storeId, { manufacturerAddress: v })}
                    />
                    <TextField
                      label="Packer name"
                      value={draft.packerName}
                      onChange={(v) => updateDraft(store.storeId, { packerName: v })}
                    />
                    <TextField
                      label="Packer address"
                      value={draft.packerAddress}
                      onChange={(v) => updateDraft(store.storeId, { packerAddress: v })}
                    />
                    <div className="flex gap-2">
                      <TextField
                        label="Shelf life (days)"
                        value={draft.shelfLifeDays}
                        onChange={(v) => updateDraft(store.storeId, { shelfLifeDays: v.replace(/[^0-9]/g, "") })}
                      />
                      <TextField
                        label="Return policy"
                        value={draft.returnPolicy}
                        onChange={(v) => updateDraft(store.storeId, { returnPolicy: v })}
                      />
                    </div>
                    <TextField
                      label="Storage instructions"
                      value={draft.storage}
                      onChange={(v) => updateDraft(store.storeId, { storage: v })}
                    />
                    <button
                      onClick={() => {
                        const days = draft.shelfLifeDays ? Number(draft.shelfLifeDays) : undefined;
                        if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 3650)) {
                          toast.error("Shelf life must be between 1 and 3650 days");
                          return;
                        }
                        void save(store.storeId, {
                          complianceDefaults: {
                            countryOfOrigin: draft.countryOfOrigin.trim(),
                            ...(draft.manufacturerName.trim() ? { manufacturerName: draft.manufacturerName.trim() } : {}),
                            ...(draft.manufacturerAddress.trim() ? { manufacturerAddress: draft.manufacturerAddress.trim() } : {}),
                            ...(draft.packerName.trim() ? { packerName: draft.packerName.trim() } : {}),
                            ...(draft.packerAddress.trim() ? { packerAddress: draft.packerAddress.trim() } : {}),
                            ...(days ? { shelfLifeDays: days } : {}),
                            ...(draft.storage.trim() ? { storage: draft.storage.trim() } : {}),
                            returnPolicy: draft.returnPolicy,
                          },
                        });
                      }}
                      className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold"
                    >
                      Save compliance defaults
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      const nameTaError = tamilFieldError(draft.nameTa, 160, "Tamil shop name");
                      if (nameTaError) {
                        toast.error(nameTaError);
                        return;
                      }
                      const descTaError = tamilFieldError(draft.descTa, 2000, "Tamil description");
                      if (descTaError) {
                        toast.error(descTaError);
                        return;
                      }
                      void save(store.storeId, {
                        hours: draft.hours,
                        nameTa: draft.nameTa.trim(),
                        descTa: draft.descTa.trim(),
                      });
                    }}
                    className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
                  >
                    Save profile
                  </button>
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <StorePinPicker
                    value={
                      store.latitude !== undefined && store.longitude !== undefined
                        ? { latitude: store.latitude, longitude: store.longitude }
                        : {}
                    }
                    onChange={(next: PinValue) => {
                      if (next.latitude === undefined || next.longitude === undefined) return;
                      void save(store.storeId, {
                        latitude: next.latitude,
                        longitude: next.longitude,
                      });
                    }}
                    hint="Riders navigate to this point. Update it if the shop moves."
                    allowClear={false}
                  />
                </div>
                {store.sector === "PHARMA" && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-sm font-bold">Drug licence</p>
                    <p className="mb-1 text-[10px] text-muted-foreground">
                      Pharmacy shops can add or update their drug-selling licence here.
                    </p>
                    <TextField
                      label="Drug licence number"
                      value={draft.drugLicenseNumber}
                      onChange={(v) => updateDraft(store.storeId, { drugLicenseNumber: v.toUpperCase() })}
                    />
                    <label className="block py-2">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">
                        Licence document
                      </span>
                      <span className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-4 text-xs font-semibold text-muted-foreground">
                        <Upload className="h-4 w-4" />
                        {draft.drugLicenseFileKey
                          ? "Document uploaded ✓"
                          : "Tap to upload (JPG / PNG / WEBP)"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void attachDrugLicence(store.storeId, file);
                        }}
                      />
                    </label>
                    <button
                      disabled={!draft.drugLicenseNumber.trim() && !draft.drugLicenseFileKey}
                      onClick={() => void saveDrugLicence(store.storeId)}
                      className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
                    >
                      Save licence
                    </button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}

export default SellerStores;