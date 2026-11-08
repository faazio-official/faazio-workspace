"use client";
// Multi-shop switcher for the seller console. One component consumed by the hub header, the orders
// header and the desktop sidebar: clicking the active shop name opens a popover listing every shop
// the seller owns; picking one calls `setActiveStoreId`, which re-scopes every data hook to that
// shop and persists the choice to localStorage (Zustand persist).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const { stores, activeStore, setActiveStoreId } = useActiveStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative min-w-0 flex-1" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch shop"
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 items-center gap-1 text-left"
      >
        <span className="min-w-0 flex-1">
          {caption && (
            <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {caption}
            </span>
          )}
          {children}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 mt-2 w-72 max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-card p-2 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Switch shop
          </p>
          <div className="max-h-[min(20rem,45dvh)] overflow-y-auto">
            {stores.map((store) => {
              const active = store.storeId === activeStore?.storeId;
              return (
                <button
                  key={store.storeId}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setActiveStoreId(store.storeId);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors",
                    active ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-sm font-semibold">{store.name}</span>
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
          {stores.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No shops yet — add one from Stores
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Tiny fallback so a shop without an address still shows something under its name. */
function sectorFallback(_name: string): string {
  return "Faazio shop";
}