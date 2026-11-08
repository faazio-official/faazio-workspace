"use client";
// Seller console shells ported from the seller app vite reference. The seller layout renders
// `SellerAppShell` (RoleGate + desktop sidebar + mobile frame + floating tab bar); pages compose
// their own headers from OrdersTopBar / OutletHeader / PageHeader. Admin consoles never import
// these — the seller shell owns the frame + nav, pages are just content.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  Boxes,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Menu as MenuIcon,
  MessageSquareText,
  ScanLine,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSellerUi } from "@/lib/sellerUi";
import { useActiveStore, useStoreSwitching } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { RoleGate } from "@/components/layout/RoleGate";
import { SellerPushBridge } from "@/components/layout/SellerPushBridge";
import { SellerDesktopShell } from "@/components/sellers/desktop-shell";
import { StoreSwitcher } from "@/components/sellers/StoreSwitcher";
import { sectorLabel } from "@/lib/sector";

type NavItem = { to: string; label: string; icon: typeof ClipboardList };

/** Orders-mode tab bar (reference OrdersShell). */
const ORDERS_NAV: NavItem[] = [
  { to: "/seller/orders", label: "Orders", icon: ClipboardList },
  { to: "/seller/inventory", label: "Inventory", icon: Boxes },
  { to: "/seller/menus", label: "Menu", icon: BookOpen },
  { to: "/seller/reviews", label: "Feedback", icon: MessageSquareText },
];

/** Hub-mode tab bar (reference HubShell). Growth/Finance map onto the platform's ads/payments routes. */
const HUB_NAV: NavItem[] = [
  { to: "/seller/hub", label: "Hub", icon: LayoutGrid },
  { to: "/seller/ads", label: "Growth", icon: TrendingUp },
  { to: "/seller/menus", label: "Menu", icon: BookOpen },
  { to: "/seller/payments", label: "Finance", icon: Wallet },
];

/** Routes that render with the hub-mode tab bar.
 *  /seller/analytics, /seller/products and /seller/pricing could also be considered catalog (hub)
 *  surfaces; they share the hub bar so the catalog group feels consistent on mobile. Notifications
 *  and outlet-info are reached from the hub header (bell + shop avatar), so they keep hub mode too. */
const HUB_MODE_PATHS = [
  "/seller/hub",
  "/seller/ads",
  "/seller/promotions",
  "/seller/analytics",
  "/seller/products",
  "/seller/pricing",
  "/seller/payments",
  "/seller/menus",
  "/seller/notifications",
  "/seller/outlet-info",
  "/seller/onboarding",
];

export function sellerNavMode(pathname: string): "orders" | "hub" {
  return HUB_MODE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ? "hub" : "orders";
}

/** Full-screen transition shown while switching between the Orders and Hub modes (reference pattern). */
export function SwitchingOverlay({ to }: { to: "hub" | "orders" }) {
  return (
    <div className="fixed inset-0 z-[60] flex animate-fade flex-col items-center justify-center bg-card px-10 text-center font-seller">
      <div className="mb-4 flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-foreground text-background">
        <ArrowLeftRight className="h-5 w-5" />
      </div>
      <p className="text-lg font-bold">Switching to {to === "hub" ? "Business Hub" : "Orders"}</p>
      <p className="mt-1 text-xs text-muted-foreground">Hang tight — your shop dashboard is loading</p>
    </div>
  );
}

/**
 * Floating dark pill tab bar, fixed above the bottom edge. Renders either the orders-mode or the
 * hub-mode tab set; the round switch button (left in hub mode, right in orders mode) flips modes.
 */
export function SellerBottomNav({
  mode,
  onSwitch,
  className,
}: {
  mode: "orders" | "hub";
  onSwitch: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const items = mode === "orders" ? ORDERS_NAV : HUB_NAV;
  const switchLabel = mode === "orders" ? "To Hub" : "To Orders";
  const switchLeft = mode === "hub";
  const sw = (
    <button
      onClick={onSwitch}
      aria-label={switchLabel}
      className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-nav text-[9px] font-semibold text-nav-foreground shadow-lg"
    >
      <ArrowLeftRight className="mb-0.5 h-4 w-4" />
      {switchLabel}
    </button>
  );
  return (
    <nav
      className={cn(
        "fixed bottom-[calc(var(--seller-nav-gap)+env(safe-area-inset-bottom))] left-1/2 z-40 flex h-[var(--seller-nav-h)] w-full max-w-[430px] -translate-x-1/2 items-center gap-2 px-3",
        className,
      )}
    >
      {switchLeft && sw}
      <div className="flex flex-1 items-center justify-around rounded-full bg-nav px-2 py-1.5 shadow-lg">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.to ||
            pathname.startsWith(`${item.to}/`) ||
            (item.to === "/seller/orders" && pathname === "/seller");
          return (
            <Link
              key={item.to}
              href={item.to}
              className={cn(
                "flex flex-1 flex-col items-center rounded-full px-1 py-1.5 text-[10px] font-semibold transition-colors",
                active ? "bg-background/15 text-background" : "text-nav-foreground",
              )}
            >
              <Icon className="mb-0.5 h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
      {!switchLeft && sw}
    </nav>
  );
}

/** First 2 initials of a shop name for the header avatar (reference HubShell "BJ" badge). */
const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "S";

/** "Showing data for <name>" block used by hub/history headers.
 *  Matches the reference HubShell header actions: bell → notifications, round shop avatar → outlet-info. */
export function OutletHeader({
  showData,
  right,
}: {
  showData?: boolean;
  right?: ReactNode;
}) {
  const { activeStore } = useActiveStore();
  const name = activeStore?.name ?? "Your shop";
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <StoreSwitcher caption={showData ? "Showing data for" : undefined}>
          <span className="truncate text-[15px] font-bold">{name}</span>
        </StoreSwitcher>
        <Link
          href="/seller/notifications"
          aria-label="Notifications"
          className="rounded-full p-1.5 hover:bg-muted"
        >
          <Bell className="h-5 w-5" />
        </Link>
        <Link
          href="/seller/outlet-info"
          aria-label="Profile"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info text-[10px] font-bold text-primary-foreground"
        >
          {initialsFor(name)}
        </Link>
      </div>
      {!showData && (
        <p className="truncate text-[11px] text-muted-foreground">
          {sectorLabel(activeStore?.sector) || "Seller console"}
        </p>
      )}
      {right}
    </div>
  );
}

/** Sticky hub-mode header (reference HubShell): shop context + bell/avatar + optional actions + explore + optional tabs. */
export function HubHeader({
  actions,
  sticky,
}: {
  actions?: ReactNode;
  sticky?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-card px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        <OutletHeader showData />
        {actions}
        <Link
          href="/seller/explore"
          aria-label="Explore more"
          className="rounded-full p-1.5 hover:bg-muted"
        >
          <MenuIcon className="h-5 w-5" />
        </Link>
      </div>
      {sticky && <div className="mt-3">{sticky}</div>}
    </header>
  );
}

/** Sticky orders header: outlet name + online chip + header icons + hamburger. */
export function OrdersTopBar({ extra }: { extra?: ReactNode }) {
  const online = useSellerUi((s) => s.online);
  const { activeStore } = useActiveStore();
  const area = activeStore ? (activeStore.address ?? sectorLabel(activeStore.sector)) : "Seller console";
  return (
    <header className="sticky top-0 z-30 bg-card px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        <StoreSwitcher>
          <span className="block truncate text-[15px] font-bold">{activeStore?.name ?? "Your shop"}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{area}</span>
        </StoreSwitcher>
        <Link
          href="/seller/restaurant-status"
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            online
              ? "border-success text-success"
              : "border-border text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              online ? "bg-success" : "bg-muted-foreground",
            )}
          />
          {online ? "Online" : "Offline"} <ChevronRight className="h-3 w-3" />
        </Link>
        {extra}
        <Link
          href="/seller/explore"
          aria-label="Explore more"
          className="rounded-full p-1.5 hover:bg-muted"
        >
          <MenuIcon className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}

export const OrdersHeaderIcons = ({
  onSearch,
  onScan,
}: {
  onSearch: () => void;
  onScan: () => void;
}) => (
  <>
    <button
      aria-label="Scan"
      onClick={onScan}
      className="rounded-full p-1.5 hover:bg-muted"
    >
      <ScanLine className="h-5 w-5" />
    </button>
    <button
      aria-label="Search orders"
      onClick={onSearch}
      className="rounded-full p-1.5 hover:bg-muted"
    >
      <Search className="h-5 w-5" />
    </button>
  </>
);

/**
 * The seller console chrome: RoleGate + push bridge + Figtree + desktop sidebar (≥ md) + a mobile
 * frame with a floating tab bar. Replaces the old width-1440 SellerShell for every /seller route.
 */
export function SellerAppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [switching, setSwitching] = useState<null | "hub" | "orders">(null);
  const scopeSwitching = useStoreSwitching();

  useEffect(() => {
    if (session?.mustChange && session.role !== "SUPER_ADMIN" && pathname !== "/security") {
      router.replace("/security");
    }
  }, [pathname, router, session?.mustChange, session?.role]);

  const mode = sellerNavMode(pathname);

  const go = (to: "hub" | "orders") => {
    setSwitching(to);
    setTimeout(() => {
      router.push(to === "hub" ? "/seller/hub" : "/seller/orders");
      setSwitching(null);
    }, 900);
  };

  return (
    <RoleGate allow={["SELLER"]}>
      <SellerPushBridge />
      <div className="font-seller flex min-h-[100dvh] bg-background">
        <SellerDesktopShell />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="relative mx-auto w-full flex-1 pb-[calc(var(--seller-nav-gap)+var(--seller-nav-h)+1.5rem+env(safe-area-inset-bottom))] md:max-w-[1024px] md:pb-10">
            {scopeSwitching ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 animate-fade bg-info/70" />
            ) : null}
            {children}
          </main>
          {pathname === "/seller/explore" ? null : (
            <SellerBottomNav
              mode={mode}
              onSwitch={() => go(mode === "orders" ? "hub" : "orders")}
              className="md:hidden"
            />
          )}
        </div>
      </div>
      {switching && <SwitchingOverlay to={switching} />}
    </RoleGate>
  );
}