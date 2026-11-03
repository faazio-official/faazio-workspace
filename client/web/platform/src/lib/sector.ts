// Sector vocabulary for the seller console. Pages used to hardcode "FOOD"/"PHARMA" strings and
// inline colored chips; this is the single source of truth for display names, icons and chip colors
// so a Mart / Food / Pharmacy store renders its own language instead of a Zomato-style food app.
import { Pill, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { OrderStatus, Sector } from "@/data/types";

export const SECTOR_LABELS: Record<Sector, string> = {
  MART: "Mart",
  FOOD: "Food",
  PHARMA: "Pharmacy",
};

/** Display name for a sector ("Mart" / "Food" / "Pharmacy"). Empty string when unknown. */
export function sectorLabel(sector?: Sector | null): string {
  return sector ? SECTOR_LABELS[sector] ?? sector : "";
}

/** Per-sector icon used on sector badges and store switcher rows. */
export function sectorIcon(sector?: Sector | null): LucideIcon {
  switch (sector) {
    case "FOOD":
      return UtensilsCrossed;
    case "PHARMA":
      return Pill;
    case "MART":
      return Store;
    default:
      return Store;
  }
}

/** Tailwind chip classes for a sector — design-token only (no raw color literals). */
export function sectorChip(sector?: Sector | null): string {
  switch (sector) {
    case "FOOD":
      return "bg-brand-soft text-brand";
    case "PHARMA":
      return "bg-info-soft text-info";
    case "MART":
      return "bg-success-soft text-success";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/**
 * Order status labels conditioned on the active shop's sector. Food keeps its kitchen vocabulary
 * ("Preparing"/"Ready"); Mart and Pharmacy get neutral labels so a pharma store does not
 * look like a restaurant dashboard.
 */
export function orderStatusLabel(status: OrderStatus | string, sector?: Sector | null): string {
  switch (status) {
    case "NEW":
      return sector === "FOOD" ? "Preparing" : "New";
    case "PACKED":
      return sector === "FOOD" ? "Ready" : "Packed";
    case "SHIPPED":
      return "Out for delivery";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Cancelled";
    case "RETURNED":
      return "Returned";
    default:
      return String(status);
  }
}