import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgePercent,
  BarChart3,
  Boxes,
  ClipboardList,
  Coins,
  Droplet,
  FileSearch,
  FileText,
  Gauge,
  Grid2x2,
  LayoutGrid,
  LayoutTemplate,
  KeyRound,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Package,
  PartyPopper,
  Receipt,
  RotateCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  ShoppingCart,
  Store,
  Tags,
  Ticket,
  Truck,
  UserCog,
  Users,
  UtensilsCrossed,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  group: string;
  /** Match only this exact path (used by each console's root dashboard). */
  exact?: boolean;
}

export function normalizeNavPath(value: string) {
  return value.replace(/\/+$/, "") || "/";
}

/**
 * Longest matching nav prefix wins, so a base route (e.g. `/admin/district`)
 * is not marked active on a child page (`/admin/district/sellers`).
 */
export function activeNavHref(pathname: string, nav: NavItem[]) {
  const current = normalizeNavPath(pathname);
  let best = "";
  for (const item of nav) {
    const href = normalizeNavPath(item.to);
    const matches = current === href || (!item.exact && current.startsWith(`${href}/`));
    if (matches && href.length > best.length) {
      best = href;
    }
  }
  return best;
}

export const SELLER_NAV: NavItem[] = [
  { label: "Dashboard", to: "/seller", icon: Gauge, group: "Overview", exact: true },
  { label: "Products", to: "/seller/products", icon: Package, group: "Catalog" },
  { label: "Pricing", to: "/seller/pricing", icon: Tags, group: "Catalog" },
  { label: "Inventory", to: "/seller/inventory", icon: Boxes, group: "Catalog" },
  { label: "Menu", to: "/seller/menus", icon: UtensilsCrossed, group: "Catalog" },
  { label: "Orders", to: "/seller/orders", icon: ShoppingCart, group: "Operations" },
  { label: "Returns", to: "/seller/returns", icon: RotateCcw, group: "Operations" },
  { label: "Prescriptions", to: "/seller/prescriptions", icon: FileText, group: "Operations" },
  { label: "Payments", to: "/seller/payments", icon: Receipt, group: "Operations" },
  { label: "Promotions", to: "/seller/promotions", icon: BadgePercent, group: "Growth" },
  { label: "Ads", to: "/seller/ads", icon: Megaphone, group: "Growth" },
  { label: "Analytics", to: "/seller/analytics", icon: BarChart3, group: "Growth" },
  { label: "Stores", to: "/seller/stores", icon: Store, group: "Account" },
  { label: "Reviews", to: "/seller/reviews", icon: MessageSquare, group: "Account" },
  { label: "Settings", to: "/seller/settings", icon: Settings, group: "Account" },
  { label: "Support", to: "/seller/support", icon: LifeBuoy, group: "Account" },
];

export const DISTRICT_ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", to: "/admin/district", icon: Gauge, group: "Overview", exact: true },
  { label: "Sellers", to: "/admin/district/sellers", icon: Users, group: "Supply" },
  { label: "Customers", to: "/admin/district/customers", icon: Users, group: "Supply" },
  { label: "Delivery partners", to: "/admin/district/delivery-boys", icon: Truck, group: "Supply" },
  { label: "Products", to: "/admin/district/products", icon: Package, group: "Supply" },
  { label: "Listing queue", to: "/admin/district/products/queue", icon: ClipboardList, group: "Supply" },
  { label: "Fee change requests", to: "/admin/district/fee-change-requests", icon: Receipt, group: "Supply" },
  { label: "Pricing audit", to: "/admin/district/pricing-audit", icon: FileSearch, group: "Supply" },
  { label: "Festival", to: "/admin/district/festival", icon: PartyPopper, group: "Growth" },
  { label: "Content", to: "/admin/district/content", icon: LayoutGrid, group: "Growth" },
  { label: "Coupons", to: "/admin/district/coupons", icon: Ticket, group: "Growth" },
  { label: "Orders monitor", to: "/admin/district/orders", icon: Activity, group: "Operations" },
  { label: "Manual allocation", to: "/admin/district/delivery/manual-allocation", icon: Truck, group: "Operations" },
  { label: "Delivery payouts", to: "/admin/district/delivery/payouts", icon: Receipt, group: "Operations" },
  { label: "Blood bank", to: "/admin/district/blood", icon: Droplet, group: "Operations" },
  { label: "Support", to: "/admin/district/support", icon: LifeBuoy, group: "Operations" },
  { label: "Analytics", to: "/admin/district/analytics", icon: BarChart3, group: "Operations" },
  { label: "Audit log", to: "/admin/district/audit", icon: ShieldCheck, group: "Operations" },
];

export const SUPER_ADMIN_NAV: NavItem[] = [
  { label: "Command center", to: "/admin/super", icon: Gauge, group: "Overview", exact: true },
  { label: "District admins", to: "/admin/super/district-admins", icon: UserCog, group: "Governance" },
  { label: "Credentials", to: "/admin/super/credentials", icon: KeyRound, group: "Governance" },
  { label: "App config", to: "/admin/super/app-config", icon: SlidersHorizontal, group: "Governance" },
  { label: "Users", to: "/admin/super/users", icon: Users, group: "Governance" },
  { label: "Districts", to: "/admin/super/districts", icon: Grid2x2, group: "Governance" },
  { label: "Security", to: "/admin/super/security", icon: ShieldCheck, group: "Governance" },
  { label: "Sellers", to: "/admin/super/sellers", icon: Users, group: "Supply" },
  { label: "Fee change requests", to: "/admin/super/fee-change-requests", icon: Receipt, group: "Supply" },
  { label: "Delivery partners", to: "/admin/super/delivery-boys", icon: Truck, group: "Supply" },
  { label: "Products", to: "/admin/super/products", icon: Package, group: "Supply" },
  { label: "Sectors", to: "/admin/super/sectors", icon: Tags, group: "Supply" },
  { label: "Categories", to: "/admin/super/categories", icon: Tags, group: "Supply" },
  { label: "Festival", to: "/admin/super/festival", icon: PartyPopper, group: "Growth" },
  { label: "Coupons", to: "/admin/super/coupons", icon: Ticket, group: "Growth" },
  { label: "Ads", to: "/admin/super/ads", icon: Megaphone, group: "Growth" },
  { label: "App content (SDUI)", to: "/admin/super/sdui", icon: LayoutTemplate, group: "Growth" },
  { label: "Analytics", to: "/admin/super/analytics", icon: BarChart3, group: "Operations" },
  { label: "Manual allocation", to: "/admin/super/delivery/manual-allocation", icon: Truck, group: "Operations" },
  { label: "Delivery payouts", to: "/admin/super/delivery/payouts", icon: Receipt, group: "Operations" },
  { label: "Audit log", to: "/admin/super/audit", icon: ShieldCheck, group: "Operations" },
  { label: "Coverage", to: "/admin/super/coverage", icon: LayoutGrid, group: "Operations" },
  { label: "Rewards", to: "/admin/super/rewards", icon: Coins, group: "Operations" },
  { label: "Settings", to: "/admin/super/settings", icon: Settings, group: "Operations" },
];
