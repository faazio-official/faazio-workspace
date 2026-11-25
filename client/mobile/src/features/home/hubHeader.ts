import { hs, vs } from '@/utils/responsive';

export const HEADER_TOP_GAP = vs(16);
/** 24px logo/location row + its 6px paddingBottom (the row's real flow height). */
export const HEADER_ROW_H = vs(30);
export const HEADER_ROW_GAP = vs(12);
export const HEADER_SEARCH_H = Math.max(44, vs(44));
export const HEADER_BOTTOM_PAD = vs(16);
/** Real measured height of the sectors row (buttons are vs(44) tall). */
export const HEADER_SECTORS_H = vs(44);
/** Height of the pinned header category rail (Home hub only — below the search bar). */
export const HEADER_RAIL_H = vs(30);

/** Vertical space above the top content row, incl. the OS status-bar inset. */
export const headerTopInset = (topInset: number) => topInset + HEADER_TOP_GAP;
/** Full expanded height of the Home hub header, incl. the inset. Pass `hasRail`
 *  false when the superadmin category rail has no curated chips to drop its slot. */
export const expandedHeaderH = (topInset: number, hasRail = true) =>
  headerTopInset(topInset) +
  HEADER_ROW_H +
  HEADER_ROW_GAP +
  HEADER_SECTORS_H +
  HEADER_ROW_GAP +
  HEADER_SEARCH_H +
  (hasRail ? HEADER_ROW_GAP + HEADER_RAIL_H : 0) +
  HEADER_BOTTOM_PAD;
/**
 * Height of the collapsed header (the sector row rests at the status-bar inset).
 * The Mart/Food/Pharma sectors, the search bar and the category rail all stay
 * pinned; only the logo/location row above them slides away. Pass `hasRail` false
 * when the rail has no curated chips so its slot is not reserved.
 */
export const collapsedVisibleHeaderH = (topInset: number, hasRail = true) =>
  topInset +
  HEADER_SECTORS_H +
  HEADER_ROW_GAP +
  HEADER_SEARCH_H +
  (hasRail ? HEADER_ROW_GAP + HEADER_RAIL_H : 0) +
  HEADER_BOTTOM_PAD;
