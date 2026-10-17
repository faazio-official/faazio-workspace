// Hero placement taxonomy + sub-app inference for the seller campaign wizard (0027).
// Placement scope mirrors the server: CATEGORY_TOP needs a category, STORE_TOP needs a store.
import type { AdTargetType, HeroPlacement, Sector } from "@/data/types";

export interface PlacementMeta {
  label: string;
  hint: string;
  scope: "none" | "category" | "store";
}

export const HERO_PLACEMENT_META: Record<HeroPlacement, PlacementMeta> = {
  MART_HERO: {
    label: "Mart hero",
    hint: "16:9 poster at the top of the Mart home feed.",
    scope: "none",
  },
  CATEGORY_TOP: {
    label: "Category top banner",
    hint: "Above the product list on a category page you pick.",
    scope: "category",
  },
  STORE_TOP: {
    label: "Store header banner",
    hint: "At the top of the store / venue page the poster links to.",
    scope: "store",
  },
  HOME_HERO: {
    label: "App home hero",
    hint: "Top carousel on the main home hub.",
    scope: "none",
  },
  PHARMA_HERO: {
    label: "Pharma hero",
    hint: "Top of the Pharma home.",
    scope: "none",
  },
  FOOD_HERO: {
    label: "Food hero",
    hint: "Hero band on the restaurant feed.",
    scope: "none",
  },
};

/**
 * Placements shipped for each sector. Every hero host now renders in the app (Mart/Food/Pharma +
 * the shared home hub), so a seller can buy any placement that fits their item's sub-app. `HOME_HERO`
 * is the cross-app hub and is offered as an opt-in on top of the item's own sub-app surfaces.
 */
export const PLACEMENTS_BY_APP: Record<Sector, HeroPlacement[]> = {
  MART: ["MART_HERO", "CATEGORY_TOP", "STORE_TOP", "HOME_HERO"],
  FOOD: ["FOOD_HERO", "STORE_TOP", "HOME_HERO"],
  PHARMA: ["PHARMA_HERO", "CATEGORY_TOP", "STORE_TOP", "HOME_HERO"],
};

/**
 * Extra placement eligibility beyond the sub-app list: a DISH/VENUE targets a restaurant header,
 * a PRODUCT/STORE targets a store header. Returns the subset the server will accept for the target.
 */
export function eligiblePlacementsFor(app: Sector, targetType: AdTargetType): HeroPlacement[] {
  return PLACEMENTS_BY_APP[app].filter((p) => {
    if (p === "STORE_TOP") return targetType !== "PRODUCT" || app !== "FOOD";
    return true;
  });
}

/** Short "who sees this" note shown next to each placement in the wizard (no invented reach numbers). */
export const PLACEMENT_REACH_NOTE: Record<HeroPlacement, string> = {
  MART_HERO: "Everyone opening Mart.",
  CATEGORY_TOP: "Shoppers browsing the category you pick.",
  STORE_TOP: "Shoppers already on your store / restaurant page.",
  HOME_HERO: "Everyone on the main Home hub (highest reach).",
  PHARMA_HERO: "Everyone opening Pharma.",
  FOOD_HERO: "Everyone opening the Food feed.",
};

/** Category drill-in tabs (`MASTER_CATEGORIES` id) a CATEGORY_TOP hero can target. */
export const CATEGORY_OPTIONS: Record<Sector, { id: string; label: string }[]> = {
  MART: [
    { id: "cat_smart_gadgets", label: "Smart Gadgets" },
    { id: "cat_mobiles", label: "Mobiles & Tablets" },
    { id: "cat_electronics", label: "Electronics" },
    { id: "cat_fashion", label: "Fashion" },
    { id: "cat_home", label: "Home & Kitchen" },
    { id: "cat_fruits_veg", label: "Fruits & Veggies" },
    { id: "cat_dairy", label: "Dairy & Eggs" },
    { id: "cat_snacks", label: "Snacks & Beverages" },
    { id: "cat_grains", label: "Grains & Staples" },
    { id: "cat_personal_care", label: "Personal Care" },
  ],
  FOOD: [],
  PHARMA: [
    { id: "cat_medicines", label: "Medicines & Rx" },
    { id: "cat_devices", label: "Medical Devices" },
    { id: "cat_vitamins", label: "Vitamins & Supplements" },
    { id: "cat_personal_care", label: "Personal Care" },
  ],
};

/** Target tabs the picker offers (each seller item maps to a `targetType`). */
export const TARGET_TABS = [
  { key: "PRODUCT", label: "Products", app: "MART" as Sector },
  { key: "DISH", label: "Dishes", app: "FOOD" as Sector },
  { key: "STORE", label: "My Stores", app: "MART" as Sector },
] as const;

export type TargetTabKey = (typeof TARGET_TABS)[number]["key"];