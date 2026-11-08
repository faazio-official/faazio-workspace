"use client";
// Business Hub — the reference HubShell concept bound to the platform's live analytics hooks.
// Absorbs the former /seller dashboard (KPIs, GMV trend, shop health, setup checklist, top
// products, dispatch alerts) so nothing is lost when /seller redirects to /seller/orders.
import Link from "next/link";
import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  MoreVertical,
  TriangleAlert,
} from "lucide-react";
import { HubHeader } from "@/components/sellers/shells";
import { Card, EmptyState, PillTabs, Sheet } from "@/components/sellers/kit";
import { LineSpark, Bars } from "@/components/sellers/charts";
import {
  useAnalyticsSeries,
  useOrders,
  useProducts,
  useSellerScope,
} from "@/lib/api/hooks";
import { useSellerUi } from "@/lib/sellerUi";
import { formatINR, formatNumber } from "@/lib/format";
import { orderStatusLabel } from "@/lib/sector";
import {
  listingQuality,
  periodDelta,
  sellerHealth,
  sumGmv,
  sumOrders,
} from "@/lib/analytics/derive";
import { cn } from "@/lib/utils";

type Tab = "feed" | "sales" | "funnel" | "quality" | "kitchen";

const TABS: { key: Tab; label: string }[] = [
  { key: "feed", label: "My Feed" },
  { key: "sales", label: "Sales" },
  { key: "funnel", label: "Funnel" },
  { key: "quality", label: "Service quality" },
  { key: "kitchen", label: "Kitchen" },
];

const STATUS_KEYS = ["NEW", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];

const TASKS = [
  { label: "Business KYC verified", done: true },
  { label: "Bank account added", done: true },
  { label: "First 5 products listed", done: false },
  { label: "Store hours confirmed", done: true },
  { label: "Festival opt-in submitted", done: false },
];

function Hub() {
  const { sellerId, storeId, activeStore } = useSellerScope();
  const sector = activeStore?.sector;
  const orders = useOrders({ sellerId, storeId });
  const products = useProducts({ sellerId, storeId });
  const series = useAnalyticsSeries("seller", sellerId, 30);
  const rush = useSellerUi((s) => s.rush);
  const [tab, setTab] = useState<Tab>("feed");
  const [dateOpen, setDateOpen] = useState(false);

  // The kitchen tab is food vocabulary; non-food shops see "Operations".
  const hubTabs = TABS.map((t) =>
    t.key === "kitchen" && sector !== "FOOD" ? { ...t, label: "Operations" } : t,
  );
  const statusRows = STATUS_KEYS.map((key) => ({ key, label: orderStatusLabel(key, sector) }));

  const gmv = sumGmv(series);
  const orderCount = sumOrders(series);
  const aov = orderCount > 0 ? gmv / orderCount : 0;
  const gmvSerie = series.map((p) => p.gmvPaisa);
  const orderSerie = series.map((p) => p.orders);

  const today = new Date().toDateString();
  const todayOrders = orders.filter((o) => new Date(o.placedAt).toDateString() === today);
  const todaySales = todayOrders.reduce((t, o) => t + o.amountPaisa, 0);

  const delivered = orders.filter((o) => o.status === "DELIVERED").length;
  const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
  const pending = orders.filter((o) => o.status === "NEW" || o.status === "PACKED");
  const outForDelivery = orders.filter((o) => o.status === "SHIPPED");
  const health = sellerHealth({
    slaPercent: orders.length ? (delivered / orders.length) * 100 : 0,
    cancellationPercent: orders.length ? (cancelled / orders.length) * 100 : 0,
    rating: 4.4,
    listingQuality: listingQuality(products),
  });
  const doneCount = TASKS.filter((t) => t.done).length;
  const maxStatus = Math.max(1, ...statusRows.map((s) => orders.filter((o) => o.status === s.key).length));

  const DateBar = (
    <button
      onClick={() => setDateOpen(true)}
      className="w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-xs"
    >
      <b>Last 30 days</b> <span className="text-muted-foreground">• vs previous 30 days</span>
    </button>
  );

  const header = <HubHeader sticky={<PillTabs tabs={hubTabs} value={tab} onChange={setTab} />} />;

  return (
    <>
      {header}
      <div className="space-y-3 px-4 pt-3">
        {tab === "feed" && (
          <>
            <Card>
              <p className="text-sm font-bold">Today so far</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Total sales</p>
                  <p className="text-lg font-bold">{formatINR(todaySales)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    Total orders{" "}
                    <span className="ml-1 rounded bg-success-soft px-1 text-[9px] font-bold text-success">
                      ● Live
                    </span>
                  </p>
                  <p className="text-lg font-bold">{todayOrders.length}</p>
                </div>
              </div>
              {todayOrders.length === 0 && (
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Orders will be coming your way soon
                </p>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Shop health</p>
                  <p className="text-[10px] text-muted-foreground">
                    Weighted score · <b>{health.band}</b>
                  </p>
                </div>
                <p className="text-lg font-bold">
                  {health.score} <span className="text-xs text-muted-foreground">/100</span>
                </p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-info" style={{ width: `${health.score}%` }} />
              </div>
              <ul className="mt-3 space-y-2">
                {health.parts.map((part) => (
                  <li key={part.label} className="flex items-center gap-2 text-xs">
                    {part.pass ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <TriangleAlert className="h-3.5 w-3.5 text-warning" />
                    )}
                    <span className="flex-1 text-muted-foreground">{part.label}</span>
                    <b>{part.value}</b>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <p className="text-sm font-bold">Setup checklist</p>
              <p className="text-[10px] text-muted-foreground">
                {doneCount} of {TASKS.length} done
              </p>
              <ul className="mt-3 space-y-2">
                {TASKS.map((task) => (
                  <li key={task.label} className="flex items-center gap-2 text-xs">
                    {task.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className={cn(task.done && "text-muted-foreground")}>{task.label}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {tab === "sales" && (
          <>
            {DateBar}
            <Card>
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-bold">Sales</p>
                  <p className="text-[10px] text-muted-foreground">Last 30 days</p>
                </div>
                <MoreVertical className="h-4 w-4" />
              </div>
              {[
                {
                  label: "Net sales",
                  value: formatINR(gmv, { compact: true }),
                  delta: periodDelta(series, (p) => p.gmvPaisa),
                  data: gmvSerie,
                },
                {
                  label: "Orders",
                  value: formatNumber(orderCount),
                  delta: periodDelta(series, (p) => p.orders),
                  data: orderSerie,
                },
                {
                  label: "Avg. order value",
                  value: formatINR(Math.round(aov), { compact: true }),
                  delta: 0,
                  data: gmvSerie,
                },
              ].map((m) => (
                <div key={m.label} className="mt-3 flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-bold">
                      {m.value}{" "}
                      {m.delta !== 0 && (
                        <span className="text-[10px] font-medium text-brand">
                          {m.delta > 0 ? "+" : ""}
                          {Math.round(m.delta)}%
                        </span>
                      )}
                    </p>
                  </div>
                  <LineSpark data={m.data.length > 1 ? m.data : [0, 0]} height={34} />
                </div>
              ))}
            </Card>
            <Card>
              <p className="text-sm font-bold">Sales &amp; orders</p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Net sales</p>
                  <b>{formatINR(gmv, { compact: true })}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">Orders</p>
                  <b>{formatNumber(orderCount)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg. order</p>
                  <b>{formatINR(Math.round(aov), { compact: true })}</b>
                </div>
              </div>
              {gmvSerie.length > 1 ? (
                <Bars data={gmvSerie} />
              ) : (
                <EmptyState text="Not enough data yet to plot sales" />
              )}
            </Card>
            <Card>
              <p className="text-sm font-bold">Top products</p>
              <p className="text-[10px] text-muted-foreground">By listing quality and price band</p>
              {products.length === 0 ? (
                <EmptyState text="Your catalog is empty — add products to start selling" />
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {products.slice(0, 5).map((p) => (
                    <li key={p.productId} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{p.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {formatINR(p.pricePaisa)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}

        {tab === "funnel" && (
          <>
            {DateBar}
            <Card>
              <p className="text-sm font-bold">Orders by status</p>
              <p className="text-[10px] text-muted-foreground">Current week, all orders</p>
              {orders.length === 0 ? (
                <EmptyState text="No orders yet to build a funnel" />
              ) : (
                statusRows.map((s) => {
                  const count = orders.filter((o) => o.status === s.key).length;
                  return (
                    <div key={s.key} className="mt-3">
                      <div className="flex justify-between text-xs">
                        <span>{s.label}</span>
                        <b>{count}</b>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-info"
                          style={{ width: `${Math.max(4, (count / maxStatus) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
            <Card>
              <p className="text-sm font-bold">How can we help you?</p>
              <ul className="mt-1 divide-y divide-border">
                {[
                  {
                    label: sector === "FOOD" ? "Manage your menu" : "Manage your catalog",
                    to: sector === "FOOD" ? "/seller/menus" : "/seller/products",
                  },
                  { label: "Offers and ads", to: "/seller/promotions" },
                  { label: "Payouts", to: "/seller/payments" },
                ].map((t) => (
                  <li key={t.label}>
                    <Link
                      href={t.to}
                      className="flex items-center justify-between py-3 text-xs last:pb-0"
                    >
                      {t.label}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {tab === "quality" && (
          <>
            {DateBar}
            {health.parts.map((s) => (
              <Card key={s.label} className="flex items-center justify-between">
                <span className="text-sm">{s.label}</span>
                <span className={s.pass ? "font-bold text-success" : "font-bold text-brand"}>
                  {s.value}
                </span>
              </Card>
            ))}
            <Link
              href="/seller/reviews"
              className="block text-center text-xs font-semibold text-info"
            >
              View reviews &amp; complaints →
            </Link>
          </>
        )}

        {tab === "kitchen" && (
          <>
            {DateBar}
            <Card className="flex justify-between">
              <span className="text-sm">Awaiting dispatch</span>
              <b>{pending.length}</b>
            </Card>
            <Card className="flex justify-between">
              <span className="text-sm">Out for delivery</span>
              <b>{outForDelivery.length}</b>
            </Card>
            <Card className="flex justify-between">
              <span className="text-sm">Completed (all time)</span>
              <b>{delivered}</b>
            </Card>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-bold">Pending orders</p>
              <ul className="mt-2 space-y-2">
                {pending.slice(0, 3).map((o) => (
                  <li key={o.orderId}>
                    <Link
                      href={`/seller/orders/${encodeURIComponent(o.orderId)}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-warning" />
                      <span className="min-w-0 truncate">
                        <b>#{o.orderId}</b> is pending
                      </span>
                      <ChevronRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
                {pending.length === 0 && (
                  <li className="text-xs text-muted-foreground">No pending orders — you&apos;re all set</li>
                )}
              </ul>
            </div>
            {sector === "FOOD" && (
              <Link
                href="/seller/rush-hour"
                className="block rounded-xl bg-info-soft p-3 text-xs text-info"
              >
                Kitchen getting busy?{" "}
                <b>{rush.on ? `Rush mode ON till ${rush.until}` : "Turn on rush hour →"}</b>
              </Link>
            )}
          </>
        )}
      </div>

      <Sheet open={dateOpen} onClose={() => setDateOpen(false)} title="Select date range">
        <button
          onClick={() => setDateOpen(false)}
          className="block w-full border-b border-border py-3 text-left text-sm last:border-0"
        >
          Last 30 days
        </button>
      </Sheet>
    </>
  );
}

export default Hub;