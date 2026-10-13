import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgePercent,
  BarChart3,
  Boxes,
  ClipboardList,
  Coins,
  FileSearch,
  Gauge,
  Grid2x2,
  LayoutGrid,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Package,
  PartyPopper,
  Receipt,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  group: string;
}

export const SELLER_NAV: NavItem[] = [
  { label: "Dashboard", to: "/seller", icon: Gauge, group: "Overview" },
  { label: "Products", to: "/seller/products", icon: Package, group: "Catalog" },
  { label: "Pricing", to: "/seller/pricing", icon: Tags, group: "Catalog" },
  { label: "Inventory", to: "/seller/inventory", icon: Boxes, group: "Catalog" },
  { label: "Orders", to: "/seller/orders", icon: ShoppingCart, group: "Operations" },
  { label: "Returns", to: "/seller/returns", icon: RotateCcw, group: "Operations" },
  { label: "Payments", to: "/seller/payments", icon: Receipt, group: "Operations" },
  { label: "Promotions", to: "/seller/promotions", icon: BadgePercent, group: "Growth" },
  { label: "Ads", to: "/seller/ads", icon: Megaphone, group: "Growth" },
  { label: "Analytics", to: "/seller/analytics", icon: BarChart3, group: "Growth" },
  { label: "Stores", to: "/seller/stores", icon: Store, group: "Account" },
  { label: "Reviews", to: "/seller/reviews", icon: MessageSquare, group: "Account" },
  { label: "Settings", to: "/seller/settings", icon: Settings, group: "Account" },
  { label: "Support", to: "/seller/support", icon: LifeBuoy, group: "Account" },
];

export const STATE_ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", to: "/admin/state", icon: Gauge, group: "Overview" },
  { label: "Sellers", to: "/admin/state/sellers", icon: Users, group: "Supply" },
  { label: "Products", to: "/admin/state/products", icon: Package, group: "Supply" },
  { label: "Listing queue", to: "/admin/state/products/queue", icon: ClipboardList, group: "Supply" },
  { label: "Pricing audit", to: "/admin/state/pricing-audit", icon: FileSearch, group: "Supply" },
  { label: "Festival", to: "/admin/state/festival", icon: PartyPopper, group: "Growth" },
  { label: "Content", to: "/admin/state/content", icon: LayoutGrid, group: "Growth" },
  { label: "Coupons", to: "/admin/state/coupons", icon: Ticket, group: "Growth" },
  { label: "Orders monitor", to: "/admin/state/orders", icon: Activity, group: "Operations" },
  { label: "Analytics", to: "/admin/state/analytics", icon: BarChart3, group: "Operations" },
  { label: "Audit log", to: "/admin/state/audit", icon: ShieldCheck, group: "Operations" },
];

export const SUPER_ADMIN_NAV: NavItem[] = [
  { label: "Command center", to: "/admin/super", icon: Gauge, group: "Overview" },
  { label: "State admins", to: "/admin/super/state-admins", icon: UserCog, group: "Governance" },
  { label: "States", to: "/admin/super/states", icon: Grid2x2, group: "Governance" },
  { label: "Sellers", to: "/admin/super/sellers", icon: Users, group: "Supply" },
  { label: "Products", to: "/admin/super/products", icon: Package, group: "Supply" },
  { label: "Sectors", to: "/admin/super/sectors", icon: Tags, group: "Supply" },
  { label: "Festival", to: "/admin/super/festival", icon: PartyPopper, group: "Growth" },
  { label: "Coupons", to: "/admin/super/coupons", icon: Ticket, group: "Growth" },
  { label: "Ads", to: "/admin/super/ads", icon: Megaphone, group: "Growth" },
  { label: "Analytics", to: "/admin/super/analytics", icon: BarChart3, group: "Operations" },
  { label: "Audit log", to: "/admin/super/audit", icon: ShieldCheck, group: "Operations" },
  { label: "Coverage", to: "/admin/super/coverage", icon: LayoutGrid, group: "Operations" },
  { label: "Settings", to: "/admin/super/settings", icon: Coins, group: "Operations" },
];
