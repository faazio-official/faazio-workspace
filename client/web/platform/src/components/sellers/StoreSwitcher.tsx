"use client";
// Multi-shop switcher for the seller console. One component consumed by the hub header, the orders
// header and the desktop sidebar: clicking the active shop name opens a popover listing every shop
// the seller owns; picking one calls `setActiveStoreId`, which re-scopes every data hook to that
// shop and persists the choice to localStorage (Zustand persist).
//
// Every row is treated as untrusted input: a store row can arrive without an id/name (a gateway
// projection change, a partially hydrated row), and a switch can be requested while the list is
// still empty. Rendering such a row as a clickable option would let the console scope itself to a
// shop that does not exist, so invalid rows are dropped and a switch outside the list is refused
// with a real message instead of a crash.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DURATION, EASE } from "@/lib/motion";
import { useActiveStore } from "@/lib/api/hooks";
import { SectorBadge } from "@/components/sellers/kit";

export function StoreSwitcher({
  caption,
  children,
  align = "start",
}: {
  /** Optional small uppercase label stacked above the trigger name. */
  caption?: ReactNode;
  /** The trigger content (the active shop name block). */
  children: ReactNode;
  align?: "start" | "end";
}) {
  const { stores, loading, activeStore, setActiveStoreId } = useActiveStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Guard against a list that is present but unusable (a row without an id cannot be switched to).
  const options = stores.filter((store) => Boolean(store?.storeId));
  const canSwitch = options.length > 1;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Nothing to list while the seller's shops are still loading, or when they own none: show the
  // trigger content as plain text instead of an affordance that opens an empty popover.
  if (!loading && options.length === 0) {
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

  function switchTo(storeId: string) {
    if (storeId === activeStore?.storeId) {
      setOpen(false);
      return;
    }
    if (!options.some((store) => store.storeId === storeId)) {
      toast.error("That shop is no longer available", {
        description: "Reload the console to pick up your current shops.",
      });
      setOpen(false);
      return;
    }
    try {
      setActiveStoreId(storeId);
      setOpen(false);
    } catch {
      toast.error("Could not switch shop", { description: "Please try again." });
    }
  }

  return (
    <div className="relative min-w-0 flex-1" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={canSwitch ? "Switch shop" : "Current shop"}
        onClick={() => {
          if (!canSwitch) {
            // One shop is not an error — say so plainly rather than opening a one-row menu.
            if (!loading) toast.info("You have one shop", { description: "Add another from Stores." });
            return;
          }
          setOpen((v) => !v);
        }}
        className="flex w-full min-w-0 items-center gap-1 text-left"
      >
        <span className="min-w-0 flex-1">
          {caption && (
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {caption}
            </span>
          )}
          {children}
        </span>
        {canSwitch ? (
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        ) : null}
      </button>

      <AnimatePresence>
        {open && canSwitch ? (
          <m.div
            role="listbox"
            className={cn(
              "absolute z-50 mt-2 w-72 max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-card p-2 shadow-lg",
              align === "end" ? "right-0" : "left-0",
            )}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: DURATION.exit, ease: EASE.entrance } }}
            transition={{ duration: DURATION.menu, ease: EASE.entrance }}
          >
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Switch shop
          </p>
          <div className="max-h-[min(20rem,45dvh)] overflow-y-auto">
            {options.map((store) => {
              const active = store.storeId === activeStore?.storeId;
              return (
                <button
                  key={store.storeId}
                  role="option"
                  aria-selected={active}
                  onClick={() => switchTo(store.storeId)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors",
                    active ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-sm font-semibold">
                        {store.name || store.storeId}
                      </span>
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          store.isLive ? "bg-success" : "bg-muted-foreground",
                        )}
                        aria-label={store.isLive ? "Live" : "Offline"}
                      />
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {store.address || sectorFallback(store.name)}
                    </span>
                  </span>
                  <SectorBadge sector={store.sector} />
                  {active && <Check className="h-4 w-4 shrink-0 text-info" />}
                </button>
              );
            })}
          </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Tiny fallback so a shop without an address still shows something under its name. */
function sectorFallback(_name: string): string {
  return "Faazio shop";
}
