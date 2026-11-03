import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ClipboardList, Boxes, MessageSquareText, ShoppingBasket, ArrowLeftRight, LayoutGrid, TrendingUp, UtensilsCrossed, Wallet,
  Menu as MenuIcon, Search, ScanLine, Bell, ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/app-store";

export function MobileFrame({ children }: { children: ReactNode }) {
  return <div className="relative mx-auto min-h-screen w-full max-w-[430px] bg-background shadow-xl">{children}</div>;
}

function SwitchingOverlay({ to }: { to: "hub" | "orders" }) {
  return (
    <div className="fixed inset-0 z-[60] flex animate-fade flex-col items-center justify-center bg-card px-10 text-center">
      <div className="mb-4 flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-foreground text-background">
        <ArrowLeftRight className="h-5 w-5" />
      </div>
      <p className="text-lg font-bold">Switching to {to === "hub" ? "Business Hub" : "Orders"}</p>
      <p className="mt-1 text-xs text-muted-foreground">Use sturdy packaging, avoid overfilling, especially with gravies</p>
    </div>
  );
}

function useSwitch() {
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<null | "hub" | "orders">(null);
  const go = (to: "hub" | "orders") => {
    setSwitching(to);
    setTimeout(() => {
      navigate({ to: to === "hub" ? "/hub" : "/orders" });
      setSwitching(null);
    }, 900);
  };
  return { switching, go };
}

type NavItem = { to: string; label: string; icon: typeof ClipboardList };

function BottomNav({ items, switchLabel, onSwitch, switchLeft }: { items: NavItem[]; switchLabel: string; onSwitch: () => void; switchLeft?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const sw = (
    <button onClick={onSwitch} className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-nav text-[9px] font-semibold text-nav-foreground shadow-lg">
      <ArrowLeftRight className="mb-0.5 h-4 w-4" />
      {switchLabel}
    </button>
  );
  return (
    <nav className="fixed bottom-3 left-1/2 z-40 flex w-full max-w-[430px] -translate-x-1/2 items-center gap-2 px-3">
      {switchLeft && sw}
      <div className="flex flex-1 items-center justify-around rounded-full bg-nav px-2 py-1.5 shadow-lg">
        {items.map((it) => {
          const active = path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to} className={cn("flex flex-1 flex-col items-center rounded-full px-2 py-1.5 text-[10px] font-semibold", active ? "bg-background/15 text-background" : "text-nav-foreground")}>
              <Icon className="mb-0.5 h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </div>
      {!switchLeft && sw}
    </nav>
  );
}

export function OutletHeader({ showData, right }: { showData?: boolean; right?: ReactNode }) {
  const r = useApp((s) => s.restaurant);
  return (
    <div className="min-w-0 flex-1">
      {showData && <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Showing data for</p>}
      <Link to="/outlet-info" className="flex items-center gap-1">
        <span className="truncate text-[15px] font-bold">{r.name}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </Link>
      {!showData && <p className="text-[11px] text-muted-foreground">ID: {r.id} • {r.city}</p>}
      {right}
    </div>
  );
}

export function OrdersShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const { switching, go } = useSwitch();
  const items: NavItem[] = [
    { to: "/orders", label: "Orders", icon: ClipboardList },
    { to: "/inventory", label: "Inventory", icon: Boxes },
    { to: "/feedback", label: "Feedback", icon: MessageSquareText },
    { to: "/hyperpure", label: "Hyperpure", icon: ShoppingBasket },
  ];
  return (
    <MobileFrame>
      {header}
      <main className="pb-28">{children}</main>
      <BottomNav items={items} switchLabel="To Hub" onSwitch={() => go("hub")} />
      {switching && <SwitchingOverlay to={switching} />}
    </MobileFrame>
  );
}

export function OrdersTopBar({ extra }: { extra?: ReactNode }) {
  const online = useApp((s) => s.online);
  const r = useApp((s) => s.restaurant);
  return (
    <header className="sticky top-0 z-30 bg-card px-4 pb-2 pt-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{r.name}</p>
          <p className="text-[11px] text-muted-foreground">⌖ {r.area}</p>
        </div>
        <Link to="/restaurant-status" className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", online ? "border-success text-success" : "border-border text-muted-foreground")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-success" : "bg-muted-foreground")} />
          {online ? "Online" : "Offline"} <ChevronRight className="h-3 w-3" />
        </Link>
        {extra}
        <Link to="/explore" aria-label="Explore more" className="rounded-full p-1.5 hover:bg-muted"><MenuIcon className="h-5 w-5" /></Link>
      </div>
    </header>
  );
}

export const OrdersHeaderIcons = ({ onSearch, onScan }: { onSearch: () => void; onScan: () => void }) => (
  <>
    <button aria-label="Scan" onClick={onScan} className="rounded-full p-1.5 hover:bg-muted"><ScanLine className="h-5 w-5" /></button>
    <button aria-label="Search orders" onClick={onSearch} className="rounded-full p-1.5 hover:bg-muted"><Search className="h-5 w-5" /></button>
  </>
);

export function HubShell({ children, showData = true, sticky }: { children: ReactNode; showData?: boolean; sticky?: ReactNode }) {
  const { switching, go } = useSwitch();
  const items: NavItem[] = [
    { to: "/hub", label: "Hub", icon: LayoutGrid },
    { to: "/growth", label: "Growth", icon: TrendingUp },
    { to: "/menu", label: "Menu", icon: UtensilsCrossed },
    { to: "/finance", label: "Finance", icon: Wallet },
  ];
  return (
    <MobileFrame>
      <header className="sticky top-0 z-30 bg-card px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <OutletHeader showData={showData} />
          <Link to="/notifications" aria-label="Notifications" className="rounded-full p-1.5 hover:bg-muted"><Bell className="h-5 w-5" /></Link>
          <Link to="/outlet-info" aria-label="Profile" className="flex h-7 w-7 items-center justify-center rounded-full bg-info text-[10px] font-bold text-primary-foreground">BJ</Link>
          <Link to="/explore" aria-label="Explore more" className="rounded-full p-1.5 hover:bg-muted"><MenuIcon className="h-5 w-5" /></Link>
        </div>
        {sticky}
      </header>
      <main className="pb-28">{children}</main>
      <BottomNav items={items} switchLabel="To Orders" onSwitch={() => go("orders")} switchLeft />
      {switching && <SwitchingOverlay to={switching} />}
    </MobileFrame>
  );
}
