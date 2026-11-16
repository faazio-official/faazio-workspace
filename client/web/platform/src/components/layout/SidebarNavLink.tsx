import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/layout/nav";

/**
 * Shared left-sidebar row: quiet label + icon at rest, raised white pill with a
 * tinted icon when active. Used by the seller console, admin consoles, and the
 * admin mobile drawer so the portal's shell reads the same everywhere.
 */
export function SidebarNavLink({
  item,
  active,
  collapsed = false,
  onNavigate,
  className,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.to}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ringed group mb-1 flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[14px] transition-colors",
        active
          ? "border-sidebar-border bg-sidebar-active font-medium text-sidebar-foreground shadow-sm"
          : "border-transparent text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground",
        collapsed ? "justify-center px-2" : null,
        className,
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active
            ? "text-primary"
            : "text-sidebar-muted group-hover:text-sidebar-foreground",
        )}
      />
      {collapsed ? null : <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/** Section heading above a nav group (e.g. Usage, Billing & referrals). */
export function SidebarNavGroupLabel({
  children,
  collapsed = false,
}: {
  children: string;
  collapsed?: boolean;
}) {
  if (collapsed) return null;
  return (
    <p className="px-3 pb-1.5 text-[11px] font-medium text-sidebar-muted">{children}</p>
  );
}
