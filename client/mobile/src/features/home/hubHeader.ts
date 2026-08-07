import { StatusBar } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';

export const HEADER_NOTCH_INSET = StatusBar.currentHeight ?? 0;
export const HEADER_TOP_GAP = vs(16);
export const HEADER_ROW_H = vs(24);
export const HEADER_ROW_GAP = vs(12);
export const HEADER_SEARCH_H = Math.max(44, vs(44));
export const HEADER_BOTTOM_PAD = vs(10);
export const HEADER_SECTORS_H = ms(52) + vs(8) + ms(13);

export const HEADER_TOPINSET = HEADER_NOTCH_INSET + HEADER_TOP_GAP;
export const COLLAPSE_H = HEADER_ROW_H + HEADER_ROW_GAP + HEADER_SECTORS_H;
export const EXPANDED_H = HEADER_TOPINSET + COLLAPSE_H + HEADER_ROW_GAP + HEADER_SEARCH_H + HEADER_BOTTOM_PAD;
export const NONHOME_H = HEADER_TOPINSET + HEADER_ROW_H + HEADER_ROW_GAP + HEADER_SEARCH_H + HEADER_BOTTOM_PAD;
export const SHRINK_H = COLLAPSE_H + HEADER_ROW_GAP;
