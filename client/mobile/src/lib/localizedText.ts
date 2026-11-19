/**
 * Tamil-aware display helpers. The catalog carries an English canonical name/description plus an
 * optional Tamil translation authored by the seller (products, dishes, add-ons, stores, venues) or
 * super admin (categories). When the shopper's selected language is Tamil AND a translation exists,
 * that copy wins; otherwise the English value is shown — a missing translation must never leave a
 * blank label.
 *
 * Cart/order identity stays English by design: these helpers are display-only.
 */
export const TAMIL_LANGUAGE = 'ta';

interface Named {
  name: string;
  nameTa?: string;
}

interface Described {
  desc?: string;
  descTa?: string;
}

/** Display name for the given language, falling back to the English canonical name. */
export function localizedName(item: Named, language: string): string {
  if (language === TAMIL_LANGUAGE && item.nameTa) return item.nameTa;
  return item.name;
}

/** Display description for the given language, falling back to the English copy. */
export function localizedDesc(item: Described, language: string): string {
  if (language === TAMIL_LANGUAGE && item.descTa) return item.descTa;
  return item.desc ?? '';
}

interface DishNamed {
  dishName: string;
  dishNameTa?: string;
  description?: string;
  descriptionTa?: string;
}

/** Display dish name (Food menu rows / specials) for the given language. */
export function localizedDishName(dish: DishNamed, language: string): string {
  if (language === TAMIL_LANGUAGE && dish.dishNameTa) return dish.dishNameTa;
  return dish.dishName;
}

/** Display dish description for the given language, falling back to the English copy. */
export function localizedDishDesc(dish: DishNamed, language: string): string {
  if (language === TAMIL_LANGUAGE && dish.descriptionTa) return dish.descriptionTa;
  return dish.description ?? '';
}

interface AddonNamed {
  name: string;
  nameTa?: string;
  groupName: string;
  groupNameTa?: string;
}

/** Display add-on name for the given language. */
export function localizedAddonName(addon: AddonNamed, language: string): string {
  if (language === TAMIL_LANGUAGE && addon.nameTa) return addon.nameTa;
  return addon.name;
}

/** Display add-on group label for the given language. */
export function localizedAddonGroup(addon: AddonNamed, language: string): string {
  if (language === TAMIL_LANGUAGE && addon.groupNameTa) return addon.groupNameTa;
  return addon.groupName;
}
