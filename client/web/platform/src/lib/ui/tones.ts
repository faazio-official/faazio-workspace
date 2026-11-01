/**
 * Legacy tone API, kept so call sites compile. The console no longer assigns a
 * hue per group or card: the chrome is one neutral ramp with a single accent,
 * and colour only carries meaning (sector, status, the one figure that matters).
 *
 * `primary` is the accent; every other tone now resolves to the neutral roles.
 */
export type Tone = "primary" | "indigo" | "grape" | "teal" | "amber" | "rose" | "cyan";

const NEUTRAL_TEXT = "text-muted-foreground";
const NEUTRAL_SOFT = "bg-secondary text-secondary-foreground";
const NEUTRAL_BORDER = "border-border";
const NEUTRAL_VAR = "var(--color-muted-foreground)";

export const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  indigo: NEUTRAL_TEXT,
  grape: NEUTRAL_TEXT,
  teal: NEUTRAL_TEXT,
  amber: NEUTRAL_TEXT,
  rose: NEUTRAL_TEXT,
  cyan: NEUTRAL_TEXT,
};

export const TONE_SOFT: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  indigo: NEUTRAL_SOFT,
  grape: NEUTRAL_SOFT,
  teal: NEUTRAL_SOFT,
  amber: NEUTRAL_SOFT,
  rose: NEUTRAL_SOFT,
  cyan: NEUTRAL_SOFT,
};

export const TONE_BORDER: Record<Tone, string> = {
  primary: "border-primary/30",
  indigo: NEUTRAL_BORDER,
  grape: NEUTRAL_BORDER,
  teal: NEUTRAL_BORDER,
  amber: NEUTRAL_BORDER,
  rose: NEUTRAL_BORDER,
  cyan: NEUTRAL_BORDER,
};

export const TONE_VAR: Record<Tone, string> = {
  primary: "var(--color-primary)",
  indigo: NEUTRAL_VAR,
  grape: NEUTRAL_VAR,
  teal: NEUTRAL_VAR,
  amber: NEUTRAL_VAR,
  rose: NEUTRAL_VAR,
  cyan: NEUTRAL_VAR,
};

/** Neutral by design: a card's colour is not derived from its title. */
export function toneFor(_key: string): Tone {
  return "primary";
}

/** Navigation groups are neutral; the active row carries the accent instead. */
export const GROUP_TONE: Record<string, Tone> = {};

export function groupTone(_group: string): Tone {
  return "primary";
}
