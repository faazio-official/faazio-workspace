"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BadgePercent,
  BarChart3,
  Bike,
  BookOpen,
  Boxes,
  FileText,
  History,
  Hourglass,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Megaphone,
  Package,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  Star,
  Store,
  Tags,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/sellers/kit";
import { signOut } from "@/lib/api";
import { useSellerUi } from "@/lib/sellerUi";
import { useSession } from "@/lib/hooks/useSession";
import { useSellerScope } from "@/lib/api/hooks";

type Tile = { label: string; icon: typeof LayoutGrid; to: string; badge?: string };

const SECTIONS: { title: string; tiles: Tile[] }[] = [
  {
    title: "Overview",
    tiles: [
      { label: "Business Hub", icon: LayoutGrid, to: "/seller/hub" },
      { label: "Analytics", icon: BarChart3, to: "/seller/analytics" },
      { label: "Order history", icon: History, to: "/seller/order-history" },
    ],
  },
  {
    title: "Orders",
    tiles: [
      { label: "Orders", icon: ShoppingCart, to: "/seller/orders" },
      { label: "Restaurant status", icon: Bike, to: "/seller/restaurant-status" },
      { label: "Rush hour", icon: Hourglass, to: "/seller/rush-hour" },
      { label: "Returns", icon: RotateCcw, to: "/seller/returns" },
    ],
  },
  {
    title: "Catalog",
    tiles: [
      { label: "Products", icon: Package, to: "/seller/products" },
      { label: "Pricing", icon: Tags, to: "/seller/pricing" },
      { label: "Inventory", icon: Boxes, to: "/seller/inventory" },
      { label: "Menu", icon: BookOpen, to: "/seller/menus" },
      { label: "Offers", icon: BadgePercent, to: "/seller/offers" },
    ],
  },
  {
    title: "Operations",
    tiles: [
      { label: "Prescriptions", icon: FileText, to: "/seller/prescriptions" },
      { label: "Payments", icon: Receipt, to: "/seller/payments" },
      { label: "Promotions", icon: BadgePercent, to: "/seller/promotions" },
      { label: "Ads", icon: Megaphone, to: "/seller/ads" },
    ],
  },
  {
    title: "Account",
    tiles: [
      { label: "Stores", icon: Store, to: "/seller/stores" },
      { label: "Reviews", icon: Star, to: "/seller/reviews" },
      { label: "Settings", icon: Settings, to: "/seller/settings" },
      { label: "Support", icon: LifeBuoy, to: "/seller/support" },
    ],
  },
];

function Explore() {
  const session = useSession();
  const router = useRouter();
  const rush = useSellerUi((s) => s.rush);
  const { activeStore } = useSellerScope();
  const sector = activeStore?.sector;
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const ql = q.toLowerCase();

  // Sector-aware tile surface: food-only features (restaurant status, rush hour) and the pharmacy
  // prescriptions queue are hidden for shops that can't use them — but kept until the shop resolves.
  const filtered = SECTIONS.map((s) => ({
    ...s,
    tiles: s.tiles
      .map((t) => (t.label === "Rush hour" ? { ...t, badge: rush.on ? "ON" : "OFF" } : t))
      .filter((t) => sector == null || sector === "FOOD" || (t.label !== "Restaurant status" && t.label !== "Rush hour"))
      .filter((t) => sector == null || sector === "PHARMA" || t.label !== "Prescriptions")
      .filter((t) => sector == null || sector === "FOOD" || t.label !== "Menu")
      .filter((t) => sector == null || sector !== "FOOD" || t.label !== "Offers")
      .filter((t) => t.label.toLowerCase().includes(ql)),
  })).filter((s) => s.tiles.length);

  return (
    <>
      <PageHeader
        title="Explore more"
        right={
          <div className="flex items-center gap-2">
            <button
              aria-label="Search"
              onClick={() => setSearching((v) => !v)}
              className="rounded-full p-1.5 hover:bg-muted"
            >
              {searching ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
              {(session?.name ?? "S").slice(0, 1).toUpperCase()}
            </span>
          </div>
        }
      />
      {searching && (
        <div className="px-4 pt-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for a feature"
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-info"
          />
        </div>
      )}
      <div className="px-4 pb-10">
        {filtered.map((s) => (
          <section key={s.title} className="border-b border-border py-4 last:border-0">
            <h2 className="mb-3 text-sm font-bold">{s.title}</h2>
            <div className="grid grid-cols-4 gap-y-4 min-[520px]:grid-cols-6">
              {s.tiles.map((t) => (
                <Link key={t.to} href={t.to} className="flex flex-col items-center">
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                    <t.icon className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <span className="mt-1.5 text-center text-[11px] leading-tight text-muted-foreground">
                    {t.label}
                  </span>
                  {t.badge && (
                    <span
                      className={`mt-0.5 rounded px-1 text-[10px] font-bold text-primary-foreground ${
                        t.badge === "ON" ? "bg-success" : "bg-brand"
                      }`}
                    >
                      {t.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
        <button
          onClick={() => {
            void signOut().finally(() => router.push("/login"));
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left shadow-sm"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
            <LogOut className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <span className="text-xs font-medium text-muted-foreground">Sign out</span>
        </button>
      </div>
    </>
  );
}

export default Explore;