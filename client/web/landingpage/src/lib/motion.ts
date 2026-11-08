/**
 * Motion constants for the landing page. Mirrors the CSS tokens in
 * `src/styles.css` so JS and CSS never drift. The rules live in
 * `docs/UI_DESIGN_SYSTEM.md` §3 Pass 9.
 *
 * Two curves: entrances ease out, on-screen movement eases in and out. Springs
 * are reserved for drag / interruptible gestures — never discrete UI.
 */
export const DURATION = {
  press: 0.12,
  menu: 0.18,
  enter: 0.24,
  exit: 0.192,
  move: 0.28,
} as const;

/** Per-row delay for list / settling-detail staggering. */
export const STAGGER = 0.03;

/** `[x1, y1, x2, y2]` cubic-bezier control points. */
export const EASE = {
  entrance: [0.22, 1, 0.36, 1] as [number, number, number, number],
  move: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

export const SCALE = {
  press: 0.97,
  popover: 0.95,
  knob: 1.12,
} as const;

/** Exits are always 20% shorter than their entrance. */
export const EXIT_RATIO = 0.8;

/** Transition presets for `motion/react`. */
export const TRANSITION = {
  entrance: { duration: DURATION.enter, ease: EASE.entrance },
  exit: { duration: DURATION.exit, ease: EASE.entrance },
  menu: { duration: DURATION.menu, ease: EASE.entrance },
  move: { duration: DURATION.move, ease: EASE.move },
  press: { duration: DURATION.press, ease: EASE.entrance },
} as const;
