import { Easing } from 'react-native';

/**
 * Motion tokens — the single source of truth for timing across the app, so
 * screens do not each invent their own. See `docs/UI_DESIGN_SYSTEM.md` §3
 * Pass 9 for the authoritative rules.
 *
 * Two curves, not one:
 * - `EASE_ENTRANCE` (ease-out) for anything entering: popovers, sheets, rows,
 *   screen arrivals.
 * - `EASE_MOVE` (ease-in-out) for something already on screen that changes
 *   position or settles into place.
 *
 * Springs are reserved for drag / interruptible gestures (`SPRING`) and are
 * never used to tween discrete UI. Motion that explains a change is kept;
 * looping decoration is not.
 */
export const DURATION = {
  /** Press / hover feedback. */
  fast: 140,
  /** Menus, sheets, small transitions. */
  base: 200,
  /** Screen entrances. */
  slow: 320,
  /** Button press-scale feedback. */
  press: 120,
  /** Dropdowns, popovers, selects (the 150–250ms band). */
  menu: 180,
  /** Anything entering the screen. */
  enter: 240,
  /** Anything leaving — always 80% of `enter`. */
  exit: 192,
  /** An element already on screen moving or settling. */
  move: 280,
} as const;

/** Per-row delay for list / settling-detail staggering. */
export const STAGGER = 30;

/** `cubic-bezier(0.22, 1, 0.36, 1)` — ease-out. Entrances. */
export const EASE_ENTRANCE = Easing.bezier(0.22, 1, 0.36, 1);
/** `cubic-bezier(0.65, 0, 0.35, 1)` — ease-in-out. On-screen movement. */
export const EASE_MOVE = Easing.bezier(0.65, 0, 0.35, 1);

/** @deprecated Use `EASE_ENTRANCE`. Kept so existing callers keep working. */
export const EASING = EASE_ENTRANCE;

/** Scale constants shared by press feedback and overlays. */
export const SCALE = {
  /** Press feedback on buttons and rows. */
  press: 0.97,
  /** Popover / menu entrance. */
  popover: 0.95,
  /** Switch/slider thumb while it is being moved. */
  knob: 1.12,
} as const;

/** Exits are always 20% shorter than their entrance. */
export const EXIT_RATIO = 0.8;

/**
 * Springs are allowed only for drag / interruptible gestures — critically
 * damped, so they never overshoot. Never use for everyday UI transitions.
 */
export const SPRING = {
  damping: 30,
  stiffness: 400,
  mass: 0.8,
} as const;
