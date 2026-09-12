import { ShoppingCart, UtensilsCrossed, Pill } from 'lucide-react-native';
import type { AppBrand } from '@data/types';

export interface SectorVisual {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;
  fill: string;
  iconColor: string;
}

/** Per-sub-app visual identity (icon + tint + fill) shared by Home sectors and the My Orders rail. */
export const SECTOR_VISUALS: Record<AppBrand, SectorVisual> = {
  MART: { Icon: ShoppingCart, fill: '#FEF9E7', iconColor: '#F59E0B' },
  FOOD: { Icon: UtensilsCrossed, fill: '#FFF4E6', iconColor: '#F97316' },
  PHARMA: { Icon: Pill, fill: '#E8FBF8', iconColor: '#14B8A6' },
};
