"use client";
import { useEffect, useState } from "react";
import { Store, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, TextField, Toggle, EmptyState, SectorBadge } from "@/components/sellers/kit";
import { updateSellerStore } from "@/lib/api";
import { useSellerStores } from "@/lib/api/hooks";
import { uploadPrivateDocument } from "@/lib/media/kyc";

type VendorDraft = {
  hours: string;
  drugLicenseNumber: string;
  drugLicenseFileKey: string;
  drugLicenseAssetId: string;
};

function SellerStores() {
  const { stores, loading, reload } = useSellerStores();
  const [drafts, setDrafts] = useState<Record<string, VendorDraft>>({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const store of stores) {
        if (!next[store.storeId]) {
          next[store.storeId] = {
            hours: store.hours ?? "",
            drugLicenseNumber: store.drugLicenseNumber ?? "",
            drugLicenseFileKey: store.drugLicenseCertKey ?? "",
            drugLicenseAssetId: store.drugLicenseCertAssetId ?? "",
          };
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
      isLive?: boolean;
      isVeg?: boolean;
      drugLicenseNumber?: string;
      drugLicenseFileKey?: string;
      drugLicenseAssetId?: string;
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
      <PageHeader title="Stores" sub="Account" />
      <div className="space-y-3 px-4 pt-3 pb-8">
        {loading && stores.length === 0 ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <EmptyState
            icon={<Store className="h-12 w-12" strokeWidth={1.2} />}
            text="No vendor yet — finish onboarding to create your first vendor"
          />
        ) : (
          stores.map((store) => {
            const draft = drafts[store.storeId] ?? {
              hours: store.hours ?? "",
              drugLicenseNumber: store.drugLicenseNumber ?? "",
              drugLicenseFileKey: store.drugLicenseCertKey ?? "",
              drugLicenseAssetId: store.drugLicenseCertAssetId ?? "",
            };
            return (
              <Card key={store.storeId}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{store.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {store.address || "Address not set"} · {store.platformFeePct}% platform fee
                    </p>
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
                  </div>
                  <button
                    onClick={() => void save(store.storeId, { hours: draft.hours })}
                    className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
                  >
                    Save profile
                  </button>
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