"use client";
import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, TextField, Toggle, EmptyState } from "@/components/sellers/kit";
import { updateSellerStore } from "@/lib/api";
import { useSellerStores } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

function SellerStores() {
  const { stores, loading, reload } = useSellerStores();
  const [drafts, setDrafts] = useState<Record<string, { hours: string }>>({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const store of stores) {
        if (!next[store.storeId]) next[store.storeId] = { hours: store.hours ?? "" };
      }
      return next;
    });
  }, [stores]);

  const save = async (storeId: string, patch: { hours?: string; isLive?: boolean; isVeg?: boolean }) => {
    try {
      await updateSellerStore(storeId, patch);
      toast.success("Vendor saved");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the vendor");
    }
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
            const draft = drafts[store.storeId] ?? { hours: store.hours ?? "" };
            return (
              <Card key={store.storeId}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{store.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {store.address || "Address not set"} · {store.platformFeePct}% platform fee
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                      store.sector === "FOOD"
                        ? "bg-brand-soft text-brand"
                        : store.sector === "PHARMA"
                          ? "bg-info-soft text-info"
                          : "bg-success-soft text-success",
                    )}
                  >
                    {store.sector}
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
                      onChange={(v) =>
                        setDrafts((d) => ({
                          ...d,
                          [store.storeId]: { hours: v },
                        }))
                      }
                    />
                  </div>
                  <button
                    onClick={() => void save(store.storeId, { hours: draft.hours })}
                    className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
                  >
                    Save profile
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}

export default SellerStores;