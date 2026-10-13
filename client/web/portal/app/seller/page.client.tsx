"use client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { SectionCard } from "@/components/patterns/SectionCard";
import { GmvTrend } from "@/components/patterns/Charts";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatINR, formatNumber } from "@/lib/format";
import { periodDelta, sellerHealth, sparkline, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { sellerMetrics } from "@/lib/api";
import { useMockLoading, useOrders, useProducts, useCampaigns } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { cn } from "@/lib/utils";
import { ProductThumb } from "@/components/patterns/ProductThumb";


function SellerDashboard() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const orders = useOrders({ sellerId });
  const products = useProducts({ sellerId });
  const campaigns = useCampaigns({ stateCode: session?.stateCode });
  const series = sellerMetrics(sellerId, 30);

  const delivered = orders.filter((o) => o.status === "DELIVERED").length;
  const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
  const pendingDispatch = orders.filter((o) => o.status === "NEW" || o.status === "PACKED");
  const returns = orders.filter((o) => o.status === "RETURNED").length;
  const avgQuality =
    products.length > 0
      ? products.reduce((t, p) => t + p.qualityScore, 0) / products.length
      : 0;

  const health = sellerHealth({
    slaPercent: orders.length ? (delivered / Math.max(1, orders.length)) * 100 + 62 : 0,
    cancellationPercent: orders.length ? (cancelled / orders.length) * 100 : 0,
    rating: 4.4,
    qualityScore: avgQuality,
  });

  const liveCampaign = campaigns.find((c) => c.status === "LIVE");

  const tasks = [
    { label: "Business KYC verified", done: true },
    { label: "Bank account added", done: true },
    { label: "First 5 products listed", done: products.length >= 5 },
    { label: "Store hours confirmed", done: true },
    { label: "Festival opt-in submitted", done: false },
  ];
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Good day, ${session?.name ?? "Partner"}`}
        description="Your shop at a glance — supply, dispatch and growth in one screen."
        actions={
          <Button asChild size="sm">
            <Link href="/seller/products/new">Add product</Link>
          </Button>
        }
      />

      {liveCampaign ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <StatusPill status="LIVE" />
          <p className="text-[13px] font-semibold">{liveCampaign.name} is running</p>
          <p className="text-[12px] text-muted-foreground">
            Opt products in at or below the sector cap to appear in festival rails.
          </p>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <Link href="/seller/promotions">Opt in products</Link>
          </Button>
        </div>
      ) : null}

      <DataShell loading={loading}>
        <KpiStrip
          items={[
            {
              label: "GMV (30d)",
              value: formatINR(sumGmv(series), { compact: true }),
              deltaPercent: periodDelta(series, (p) => p.gmvPaisa),
              spark: sparkline(series, (p) => p.gmvPaisa),
            },
            {
              label: "Orders (30d)",
              value: formatNumber(sumOrders(series)),
              deltaPercent: periodDelta(series, (p) => p.orders),
              spark: sparkline(series, (p) => p.orders),
            },
            {
              label: "Pending dispatch",
              value: formatNumber(pendingDispatch.length),
              hint: "SLA 4h per order",
            },
            { label: "Returns", value: formatNumber(returns), hint: "Last 30 days" },
          ]}
        />
      </DataShell>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="GMV trend"
          description="Last 30 days, settled order value"
          className="lg:col-span-2"
        >
          <DataShell loading={loading} skeletonRows={4}>
            <GmvTrend data={series} />
          </DataShell>
        </SectionCard>

        <SectionCard title="Shop health" description={`Weighted score · ${health.band}`}>
          <DataShell loading={loading} skeletonRows={4}>
            <div className="space-y-3">
              <div className="flex items-end gap-2">
                <p className="num text-[28px] font-semibold leading-none">{health.score}</p>
                <span className="text-[12px] text-muted-foreground">/ 100</span>
              </div>
              <Progress value={health.score} className="h-1.5" />
              <ul className="space-y-2">
                {health.parts.map((part) => (
                  <li key={part.label} className="flex items-center gap-2 text-[12px]">
                    {part.pass ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <TriangleAlert className="size-4 text-warning" />
                    )}
                    <span className="flex-1 text-muted-foreground">{part.label}</span>
                    <span className="num font-semibold">{part.value}</span>
                    <span className="num text-muted-foreground">w{part.weight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </DataShell>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Setup checklist" description={`${doneCount} of ${tasks.length} done`}>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.label} className="flex items-center gap-2 text-[13px]">
                {task.done ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
                <span className={cn(task.done && "text-muted-foreground")}>{task.label}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Top products" description="By listing quality and price band" className="lg:col-span-2">
          <DataShell
            loading={loading}
            isEmpty={products.length === 0}
            empty={
              <EmptyState
                title="No products yet"
                description="Your catalog is empty, so nothing of yours is sellable in the app."
                action={
                  <Button asChild size="sm">
                    <Link href="/seller/products/new">Add your first product</Link>
                  </Button>
                }
              />
            }
          >
            <ul className="divide-y divide-border">
              {products.slice(0, 5).map((product) => (
                <li key={product.productId} className="flex items-center gap-3 py-2.5">
                  <ProductThumb product={product} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{product.name}</p>
                    <p className="num text-[12px] text-muted-foreground">
                      {formatINR(product.pricePaisa)} · MRP {formatINR(product.mrpPaisa)} ·{" "}
                      {product.discountPercent}% off
                    </p>
                  </div>
                  <StatusPill status={product.status} />
                </li>
              ))}
            </ul>
          </DataShell>
        </SectionCard>
      </div>

      <SectionCard title="Alerts" description="Every alert links to the entity that raised it">
        <ul className="space-y-2">
          {pendingDispatch.slice(0, 3).map((order) => (
            <li key={order.orderId} className="flex items-center gap-2 text-[13px]">
              <AlertTriangle className="size-4 text-warning" />
              <span className="num">{order.orderId}</span>
              <span className="text-muted-foreground">awaits dispatch</span>
              <Button asChild size="sm" variant="ghost" className="ml-auto">
                <Link href={`/seller/orders/${order.orderId}`}>
                  Open
                </Link>
              </Button>
            </li>
          ))}
          {pendingDispatch.length === 0 ? (
            <li className="text-[13px] text-muted-foreground">Dispatch queue is clear.</li>
          ) : null}
        </ul>
      </SectionCard>
    </div>
  );
}

export default SellerDashboard;
