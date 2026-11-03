"use client";
// Shop profile (reference `outlet-info` route) — the avatar + shop-name destination in the hub
// header. Read-only summary of the active store from `GET /seller/stores`; links out to the
// management surfaces that already exist rather than duplicating an edit flow.
import Link from "next/link";
import { ChevronRight, Clock, MapPin, Phone, Store, Bike } from "lucide-react";
import { PageHeader, Card, EmptyState, SectorBadge } from "@/components/sellers/kit";
import { useActiveStore } from "@/lib/api/hooks";

function OutletInfo() {
  const { activeStore } = useActiveStore();

  if (!activeStore) {
    return (
      <>
        <PageHeader title="Outlet info" />
        <EmptyState
          icon={<Store className="h-12 w-12" strokeWidth={1.2} />}
          text="No shop selected — pick one from Stores to see its profile"
        />
      </>
    );
  }

  const rows = [
    { label: "Opening hours", value: activeStore.hours || "Not set", icon: Clock },
    { label: "Delivery time", value: activeStore.deliveryTime || "Not set", icon: Bike },
    { label: "Phone", value: activeStore.phone || "Not set", icon: Phone },
  ];

  const links = [
    { label: "Stores", to: "/seller/stores" },
    { label: "View all reviews", to: "/seller/reviews" },
    { label: "Settings", to: "/seller/settings" },
  ];

  return (
    <>
      <PageHeader title="Outlet info" right={<span className="text-[10px] text-muted-foreground">ID: {activeStore.storeId}</span>} />
      <div className="space-y-3 px-4 pt-3 pb-10">
        <Card>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{activeStore.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {activeStore.platformFeePct}% platform fee
              </p>
            </div>
            <SectorBadge sector={activeStore.sector} />
          </div>
          <div className="mt-3 flex gap-1.5">
            {(activeStore.isLive ? ["Live in the app"] : [])
              .concat(activeStore.isVeg ? ["Pure vegetarian"] : [])
              .map((chip) => (
                <span key={chip} className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold">
                  {chip}
                </span>
              ))}
          </div>
          <div className="mt-4 space-y-3 border-t border-border pt-3">
            {activeStore.address && (
              <>
                <p className="flex items-start gap-1.5 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  {activeStore.address}
                </p>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(activeStore.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs font-semibold text-info"
                >
                  View on map
                </a>
              </>
            )}
            {rows.map((r) => (
              <p key={r.label} className="flex items-center gap-1.5 text-sm">
                <r.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <span className="ml-auto text-right text-sm font-medium">{r.value}</span>
              </p>
            ))}
          </div>
        </Card>

        {links.map((l) => (
          <Link
            key={l.to}
            href={l.to}
            className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm"
          >
            {l.label}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </>
  );
}

export default OutletInfo;