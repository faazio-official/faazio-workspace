import { hs, vs } from '@/utils/responsive';

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
  SECTION: vs(16),
  /** Section header → its own content. */
  BLOCK: vs(8),
  /** Rows/cards inside a block. */
  ITEM: vs(8),
  /** Scroll tail at the bottom of a list. */
  LIST_BOTTOM: vs(24),
  /** Bottom offset for floating menu pill. */
  FLOATING_PILL_BOTTOM: vs(12),
  /** Right offset for floating menu pill. */
  FLOATING_PILL_RIGHT: hs(16),
} as const;

/**
 * Floating bottom-navigation dock. Every customer bottom navbar is a detached
 * capsule: inset from both screen edges by `MARGIN` and lifted `GAP` above the
 * bottom edge, so the bar never touches the screen sides or bottom. Consumers
 * must add `GAP` to the content clearance they reserve for the bar.
 */
export const FLOATING_NAV = {
  /** Screen-edge inset of the capsule (left and right). */
  MARGIN: hs(14),
  /** Clear space between the capsule and the bottom edge of the screen. */
  GAP: vs(10),
} as const;
