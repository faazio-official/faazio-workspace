import { ShoppingCart, UtensilsCrossed, Pill } from 'lucide-react-native';
import type { AppBrand } from '@data/types';
import { brandRamp } from './brandTokens';

export interface SectorVisual {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;
  fill: string;
  iconColor: string;
}

/**
 * Per-sub-app visual identity (icon + tint + fill) shared by Home sectors and the
 * My Orders rail.
 *
 * Colours come from `brandRamp` so there is one source of truth per sub-app.
 * `fill` is the ramp tint; `iconColor` is the ramp `deep`, not the bright `base`.
 * The base is too light to read on its own tint (Mart 1.55, Pharma 2.33,
 * Food 2.37 against a 3:1 non-text minimum); `deep` clears it at 8.1 / 10.3 / 9.5
 * while staying inside the same hue.
 */
export const SECTOR_VISUALS: Record<AppBrand, SectorVisual> = {
  MART: { Icon: ShoppingCart, fill: brandRamp.MART.tint, iconColor: brandRamp.MART.deep },
  FOOD: { Icon: UtensilsCrossed, fill: brandRamp.FOOD.tint, iconColor: brandRamp.FOOD.deep },
  PHARMA: { Icon: Pill, fill: brandRamp.PHARMA.tint, iconColor: brandRamp.PHARMA.deep },
};
