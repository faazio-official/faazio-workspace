"use client";
// Seller console shells ported from the seller app vite reference. The seller layout renders
// `SellerAppShell` (RoleGate + desktop sidebar + mobile frame + floating tab bar); pages compose
// their own headers from OrdersTopBar / OutletHeader / PageHeader. Admin consoles never import
// these — the seller shell owns the frame + nav, pages are just content.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Menu as MenuIcon,
  MessageSquareText,
  ScanLine,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSellerUi } from "@/lib/sellerUi";
import { useActiveStore } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { RoleGate } from "@/components/layout/RoleGate";
import { SellerPushBridge } from "@/components/layout/SellerPushBridge";
import { SellerDesktopShell } from "@/components/sellers/desktop-shell";

/** Centered app column. Mobile = 430px; desktop = wider so the expanded view can use side-by-side grids. */
export function MobileFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto min-h-[100dvh] w-full max-w-[430px] bg-background shadow-xl md:max-w-[1024px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const BOTTOM_NAV = [
  { to: "/seller/orders", label: "Orders", icon: ClipboardList },
  { to: "/seller/inventory", label: "Inventory", icon: Boxes },
  { to: "/seller/menus", label: "Menu", icon: UtensilsCrossed },
  { to: "/seller/reviews", label: "Feedback", icon: MessageSquareText },
];

/** Floating dark pill tab bar, fixed above the bottom edge (orders mode). */
export function SellerBottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "fixed bottom-3 left-1/2 z-40 flex w-full max-w-[430px] -translate-x-1/2 items-center px-3",
        className,
      )}
    >
      <div className="flex flex-1 items-center justify-around rounded-full bg-nav px-2 py-1.5 shadow-lg">
        {BOTTOM_NAV.map((item) => {
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
                "flex flex-1 flex-col items-center rounded-full px-2 py-1.5 text-[10px] font-semibold transition-colors",
                active ? "bg-background/15 text-background" : "text-nav-foreground",
              )}
            >
              <Icon className="mb-0.5 h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** "Showing data for <name>" block used by hub/history headers. */
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
      {showData && (
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Showing data for
        </p>
      )}
      <Link href="/seller/explore" className="flex items-center gap-1">
        <span className="truncate text-[15px] font-bold">{name}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </Link>
      {!showData && (
        <p className="truncate text-[11px] text-muted-foreground">
          {activeStore?.sector ?? "Seller console"}
        </p>
      )}
      {right}
    </div>
  );
}

/** Sticky orders header: outlet name + online chip + header icons + hamburger. */
export function OrdersTopBar({ extra }: { extra?: ReactNode }) {
  const online = useSellerUi((s) => s.online);
  const { activeStore } = useActiveStore();
  const area = activeStore ? (activeStore.address ?? activeStore.sector) : "Seller console";
  return (
    <header className="sticky top-0 z-30 bg-card px-4 pb-2 pt-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{activeStore?.name ?? "Your shop"}</p>
          <p className="truncate text-[11px] text-muted-foreground">{area}</p>
        </div>
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

  useEffect(() => {
    if (session?.mustChange && session.role !== "SUPER_ADMIN" && pathname !== "/security") {
      router.replace("/security");
    }
  }, [pathname, router, session?.mustChange, session?.role]);

  return (
    <RoleGate allow={["SELLER"]}>
      <SellerPushBridge />
      <div className="font-seller flex min-h-[100dvh] bg-background">
        <SellerDesktopShell />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="relative mx-auto w-full max-w-[430px] flex-1 pb-28 md:max-w-[1024px] md:pb-10">
            {children}
          </main>
          <SellerBottomNav className="md:hidden" />
        </div>
      </div>
    </RoleGate>
  );
}