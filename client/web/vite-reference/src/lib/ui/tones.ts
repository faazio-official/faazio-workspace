/**
 * Six group hues used across the portal. Each surface family sticks to one
 * hue so colour carries meaning instead of decoration.
 */
export type Tone = "primary" | "indigo" | "grape" | "teal" | "amber" | "rose" | "cyan";

export const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  indigo: "text-tone-indigo",
  grape: "text-tone-grape",
  teal: "text-tone-teal",
  amber: "text-tone-amber",
  rose: "text-tone-rose",
  cyan: "text-tone-cyan",
};

export const TONE_SOFT: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  indigo: "bg-tone-indigo/10 text-tone-indigo",
  grape: "bg-tone-grape/10 text-tone-grape",
  teal: "bg-tone-teal/12 text-tone-teal",
  amber: "bg-tone-amber/15 text-tone-amber",
  rose: "bg-tone-rose/10 text-tone-rose",
  cyan: "bg-tone-cyan/12 text-tone-cyan",
};

export const TONE_BORDER: Record<Tone, string> = {
  primary: "border-primary/30",
  indigo: "border-tone-indigo/30",
  grape: "border-tone-grape/30",
  teal: "border-tone-teal/30",
  amber: "border-tone-amber/35",
  rose: "border-tone-rose/30",
  cyan: "border-tone-cyan/30",
};

export const TONE_VAR: Record<Tone, string> = {
  primary: "var(--color-primary)",
  indigo: "var(--color-tone-indigo)",
  grape: "var(--color-tone-grape)",
  teal: "var(--color-tone-teal)",
  amber: "var(--color-tone-amber)",
  rose: "var(--color-tone-rose)",
  cyan: "var(--color-tone-cyan)",
};

/** Deterministic hue for a label, so the same card keeps its colour. */
const CYCLE: Tone[] = ["primary", "teal", "amber", "grape", "cyan", "rose", "indigo"];

export function toneFor(key: string): Tone {
  let sum = 0;
  for (let i = 0; i < key.length; i += 1) sum += key.charCodeAt(i);
  return CYCLE[sum % CYCLE.length] as Tone;
}

/** Hue per navigation group, shared by the sidebar and page headers. */
export const GROUP_TONE: Record<string, Tone> = {
  Overview: "primary",
  Catalog: "grape",
  Supply: "grape",
  Operations: "teal",
  Growth: "amber",
  Account: "cyan",
  Governance: "indigo",
  Platform: "rose",
};

export function groupTone(group: string): Tone {
  return GROUP_TONE[group] ?? "primary";
}
