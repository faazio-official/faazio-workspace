"use client";
// Fixed shop label for the seller console. Faazio is one-account-one-vendor (0149): an account
// owns exactly one shop, so there is nothing to switch. This used to be a multi-shop popover; it
// is now a presentational wrapper that keeps the hub, orders and desktop-shell headers identical
// while the active shop comes from `useActiveStore` in each shell.
import type { ReactNode } from "react";

export function StoreSwitcher({
  caption,
  children,
}: {
  /** Optional small uppercase label stacked above the shop name. */
  caption?: ReactNode;
  /** The shop name block. */
  children: ReactNode;
  /** Retained for call-site compatibility; alignment is irrelevant without a popover. */
  align?: "start" | "end";
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <div className="min-w-0">
        {caption && (
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {caption}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
