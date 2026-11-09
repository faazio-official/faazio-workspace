export interface MartEssential {
  id: string;
  brand: string;
  name: string;
  size: string;
  price: number;
  originalPrice: number;
  discountTag: string;
  rating?: number;
  priceNote?: string;
  imageUrl: string;
  emoji: string;
}

export type { MartDeal } from '@data/types';