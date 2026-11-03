"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateSellerStore } from "@/lib/api";
import { useSellerStores } from "@/lib/api/hooks";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

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
    <div className="space-y-4">
      <PageHeader
        title="Vendors"
        description="Each vendor is one shop in one app (Mart, Food or Pharma). Switch the active vendor in the top bar."
      />

      <DataShell
        loading={loading}
        isEmpty={stores.length === 0}
        empty={
          <EmptyState
            title="No vendor yet"
            description="Finish onboarding to create your first vendor."
          />
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {stores.map((store) => {
            const draft = drafts[store.storeId] ?? { hours: store.hours ?? "" };
            return (
              <SectionCard
                key={store.storeId}
                title={store.name}
                description={`${store.address || "Address not set"} · ${store.platformFeePct}% platform fee`}
                actions={<SectorPill sector={store.sector} />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor={`hours-${store.storeId}`}>Opening hours</Label>
                      <ComponentHelp id="hours-input" />
                    </div>
                    <Input
                      id={`hours-${store.storeId}`}
                      value={draft.hours}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [store.storeId]: { ...draft, hours: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor={`live-${store.storeId}`}>Vendor live in the app</Label>
                      <ComponentHelp id="live-switch" />
                    </div>
                    <Switch
                      id={`live-${store.storeId}`}
                      checked={store.isLive}
                      onCheckedChange={(checked) => void save(store.storeId, { isLive: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor={`veg-${store.storeId}`}>Pure vegetarian</Label>
                      <ComponentHelp id="veg-switch" />
                    </div>
                    <Switch
                      id={`veg-${store.storeId}`}
                      checked={store.isVeg}
                      onCheckedChange={(checked) => void save(store.storeId, { isVeg: checked })}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => void save(store.storeId, { hours: draft.hours })}
                    >
                      Save profile
                    </Button>
                    <ComponentHelp id="save-store-button" />
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      </DataShell>
    </div>
  );
}

export default SellerStores;
