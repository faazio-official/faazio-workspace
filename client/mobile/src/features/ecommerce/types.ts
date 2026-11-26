export interface MartEssential {
  id: string;
  brand: string;
  name: string;
  /** Tamil display name (server translation). Empty → fall back to `name`. */
  nameTa?: string;
  size: string;
  price: number;
  originalPrice: number;
  discountTag: string;
  rating?: number;
  imageUrl: string;
  emoji: string;
}

export type { MartDeal } from '@data/types';