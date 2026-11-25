import { hs, SCREEN_W } from '@/utils/responsive';

/**
 * One product-card size for every feed surface: the 3-up grid width.
 * Horizontal product rails reuse the same width and a 1:1 image so grid and
 * rail cards stay visually identical.
 */
export const PRODUCT_CARD_COLUMNS = 3;
export const PRODUCT_CARD_GAP = hs(8);
export const PRODUCT_CARD_WIDTH =
  (SCREEN_W - hs(16) * 2 - PRODUCT_CARD_GAP * (PRODUCT_CARD_COLUMNS - 1)) / PRODUCT_CARD_COLUMNS;
