"use client";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { remoteConfigured } from "@/lib/config";
import { useActiveStore } from "@/lib/api/hooks";

const SECTOR_LABEL: Record<string, string> = { MART: "Mart", FOOD: "Food", PHARMA: "Pharma" };

/**
 * The seller console vendor switcher. One seller ACCOUNT owns many VENDORS across apps (Mart / Food /
 * Pharma); this selects which shop every seller page is scoped to. Hidden when the account owns exactly
 * one vendor (nothing to switch); a "create vendor" CTA when it owns none.
 */
export function VendorSwitcher() {
  const { stores, activeStore, setActiveStoreId } = useActiveStore();

  if (!remoteConfigured()) return null;

  if (stores.length === 0) {
    return (
      <Button variant="outline" size="sm" className="gap-2" asChild>
        <Link href="/seller/onboarding">
          <Plus className="size-4" /> Add a vendor
        </Link>
      </Button>
    );
  }

  if (stores.length === 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[220px] justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Store className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-[13px]">{activeStore?.name ?? "Select vendor"}</span>
            {activeStore ? (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                · {SECTOR_LABEL[activeStore.sector] ?? activeStore.sector}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">
          Your vendors
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stores.map((store) => {
          const active = store.storeId === activeStore?.storeId;
          return (
            <DropdownMenuItem
              key={store.storeId}
              onSelect={() => setActiveStoreId(store.storeId)}
              className="gap-2"
            >
              <Check className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{store.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {SECTOR_LABEL[store.sector] ?? store.sector}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/seller/onboarding" className="gap-2">
            <Plus className="size-4" /> Add a vendor
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
