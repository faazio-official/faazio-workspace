"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateStore } from "@/lib/api";
import { useMockLoading, useStores } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";


function SellerStores() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const stores = useStores({ sellerId });
  const [drafts, setDrafts] = useState<Record<string, { hours: string; deliveryTime: string }>>({});

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stores"
        description="These fields render on the store profile and self-pickup screens in the app."
      />

      <DataShell
        loading={loading}
        isEmpty={stores.length === 0}
        empty={<EmptyState title="No store yet" description="Finish onboarding to create your first store." />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {stores.map((store) => {
            const draft =
              drafts[store.storeId] ?? { hours: store.hours, deliveryTime: store.deliveryTime };
            return (
              <SectionCard
                key={store.storeId}
                title={store.name}
                description={`${store.addressLine}, ${store.city} · ${store.stateCode}`}
                actions={<SectorPill sector={store.sector} />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`hours-${store.storeId}`}>Opening hours</Label>
                    <Input
                      id={`hours-${store.storeId}`}
                      value={draft.hours}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [store.storeId]: { ...draft, hours: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`eta-${store.storeId}`}>Delivery time</Label>
                    <Input
                      id={`eta-${store.storeId}`}
                      value={draft.deliveryTime}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [store.storeId]: { ...draft, deliveryTime: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 md:col-span-2">
                    <Label htmlFor={`live-${store.storeId}`}>Store live in the app</Label>
                    <Switch
                      id={`live-${store.storeId}`}
                      checked={store.isLive}
                      onCheckedChange={(checked) => {
                        updateStore(store.storeId, { isLive: checked });
                        toast.success(checked ? "Store is live" : "Store paused");
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 md:col-span-2">
                    <Label htmlFor={`veg-${store.storeId}`}>Pure vegetarian</Label>
                    <Switch
                      id={`veg-${store.storeId}`}
                      checked={store.isVeg}
                      onCheckedChange={(checked) => updateStore(store.storeId, { isVeg: checked })}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      updateStore(store.storeId, {
                        hours: draft.hours,
                        deliveryTime: draft.deliveryTime,
                      });
                      toast.success("Store profile saved");
                    }}
                  >
                    Save profile
                  </Button>
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
