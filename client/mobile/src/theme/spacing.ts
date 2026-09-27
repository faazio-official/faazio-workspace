import { vs } from '@/utils/responsive';

/**
 * Canonical vertical-rhythm scale. Single source of truth for the gap that
 * separates two major sections, a section header from its own content, and
 * rows inside a block — so the tightened rhythm cannot drift back into
 * per-screen magic numbers.
 *
 * Ownership rule: a boundary has exactly ONE owner of its gap. A section
 * header owns its top gap (SPACE.SECTION); its parent must not also add
 * paddingTop/marginTop for the same boundary.
 */
export const SPACE = {
  /** Gap between two major sections (the ONE owner of the gap). */
  SECTION: vs(14),
  /** Section header → its own content. */
  BLOCK: vs(8),
  /** Rows/cards inside a block. */
  ITEM: vs(6),
  /** Scroll tail at the bottom of a list. */
  LIST_BOTTOM: vs(24),
} as const;
