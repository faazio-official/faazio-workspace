import { Easing } from 'react-native';

/**
 * Motion tokens. One easing curve and a few durations for the whole app so
 * screens do not each invent their own timing. Motion that explains a change is
 * kept; looping decoration is not.
 */
export const DURATION = {
  /** Press / hover feedback. */
  fast: 140,
  /** Menus, sheets, small transitions. */
  base: 200,
  /** Screen entrances. */
  slow: 320,
} as const;

/** `cubic-bezier(0.22, 1, 0.36, 1)` — the single easing curve. */
export const EASING = Easing.bezier(0.22, 1, 0.36, 1);