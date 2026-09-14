// 'use client'
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { GripVertical, X } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageMeta } from "@/lib/seo";
import { formatINR } from "@/lib/format";
import { useMockLoading, useProducts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ProductThumb } from "@/components/patterns/ProductThumb";

export const Route = createFileRoute("/admin/state/content")({
  head: () =>
    pageMeta("State content curation", "Curate the rails and banners shoppers see on the home screen in your state."),
  component: StateContent,
});

function StateContent() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const products = useProducts({ stateCode, status: "ACTIVE" });
  const [railTitle, setRailTitle] = useState("Today's picks");
  const [picks, setPicks] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  const candidates = products.filter((p) =>
    query ? p.name.toLowerCase().includes(query.toLowerCase()) : true,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Content curation"
        description="Rails store product ids only, exactly like the consumer app's layout records."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Rail being edited">
          <div className="space-y-1.5">
            <Label htmlFor="rail">Rail title</Label>
            <Input id="rail" value={railTitle} onChange={(e) => setRailTitle(e.target.value)} />
          </div>
          <div className="mt-4 space-y-2">
            {picks.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Pick products on the right to build this rail.
              </p>
            ) : (
              picks.map((id, index) => {
                const product = products.find((p) => p.productId === id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <GripVertical className="size-4 text-muted-foreground" />
                    <span className="num text-[11px] text-muted-foreground">{index + 1}</span>
                    <span className="text-[13px] font-medium">{product?.name ?? id}</span>
                    <span className="num ml-auto text-[11px] text-muted-foreground">{id}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${product?.name ?? id}`}
                      onClick={() => setPicks((list) => list.filter((p) => p !== id))}
                    >
                      <X className="size-4 text-muted-foreground" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              disabled={picks.length === 0 || railTitle.trim().length < 3}
              onClick={() => toast.success(`Rail "${railTitle}" published for ${stateCode}`)}
            >
              Publish rail
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Catalog" description="Active listings in your state" bodyClassName="p-0">
          <div className="border-b border-border p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search catalog"
              className="h-9"
            />
          </div>
          <DataShell
            loading={loading}
            isEmpty={candidates.length === 0}
            empty={<EmptyState title="No active listings" description="Approve listings first, then curate rails." />}
          >
            <ul className="divide-y divide-border">
              {candidates.map((product) => (
                <li key={product.productId} className="flex items-center gap-3 px-4 py-2.5">
                  <ProductThumb product={product} />
                  <SectorPill sector={product.sector} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{product.name}</p>
                    <p className="num text-[11px] text-muted-foreground">
                      {product.productId} · {formatINR(product.pricePaisa)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={picks.includes(product.productId)}
                    onClick={() => setPicks((list) => [...list, product.productId])}
                  >
                    {picks.includes(product.productId) ? "Added" : "Add"}
                  </Button>
                </li>
              ))}
            </ul>
          </DataShell>
        </SectionCard>
      </div>
    </div>
  );
}
