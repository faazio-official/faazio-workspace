"use client";
import { usePathname } from "next/navigation";
import { InfoHint } from "@/components/patterns/InfoHint";
import { useSession } from "@/lib/hooks/useSession";
import type { Tone } from "@/lib/ui/tones";
import { TONE_SOFT } from "@/lib/ui/tones";
import {
  APP_LABEL,
  APP_TONE,
  componentHint,
  scopedKey,
  type ComponentHint,
  type FaazioApp,
  type PageHint,
} from "@/lib/help/hints";
import type { Role } from "@/data/types";

/** Small chips showing which Faazio apps a change reaches. */
function AppChips({ app }: { app: FaazioApp[] }) {
  if (!app.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span className="text-[11px] text-ink-foreground/70">Reaches</span>
      {app.map((a) => (
        <span
          key={a}
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TONE_SOFT[APP_TONE[a]]}`}
        >
          {APP_LABEL[a]}
        </span>
      ))}
    </div>
  );
}

/** Structured body for a component-level hint: what → workflow → change → example → app. */
export function ComponentHelpBody({ hint }: { hint: ComponentHint }) {
  return (
    <div className="space-y-1">
      <p>{hint.what}</p>
      <p className="text-ink-foreground/80">
        <span className="font-semibold">Workflow: </span>
        {hint.workflow}
      </p>
      <p className="text-ink-foreground/80">
        <span className="font-semibold">What it changes: </span>
        {hint.changes}
      </p>
      <p className="text-ink-foreground/80">
        <span className="font-semibold">Example: </span>
        {hint.example}
      </p>
      <AppChips app={hint.app} />
    </div>
  );
}

/** Structured body for a page-level hint: what → why → workflow → change → tip → app. */
export function PageHelpBody({ hint }: { hint: PageHint }) {
  return (
    <div className="space-y-1">
      <p>{hint.what}</p>
      <p className="text-ink-foreground/80">
        <span className="font-semibold">Why it exists: </span>
        {hint.whyCreated}
      </p>
      <p className="text-ink-foreground/80">
        <span className="font-semibold">Bounded to: </span>
        {hint.boundedWorkflow}
      </p>
      <p className="text-ink-foreground/80">
        <span className="font-semibold">What it changes: </span>
        {hint.changesMade}
      </p>
      <p className="font-medium text-ink-foreground">Tip: {hint.how}</p>
      <AppChips app={hint.app} />
    </div>
  );
}

interface ComponentHelpProps {
  /** Component id, scoped to the current page path with `scopedKey`. */
  id?: string | undefined;
  /** Explicit global key (e.g. "shell:seller-search"); wins over `id`. */
  helpKey?: string | undefined;
  /** Overrides the session role used for role-specific lookups/shown hint. */
  role?: Role | undefined;
  title?: string | undefined;
  tone?: Tone | undefined;
  side?: "top" | "right" | "bottom" | "left" | undefined;
  label?: string | undefined;
  className?: string | undefined;
}

/**
 * Role-aware "i" button for a single control. Looks up COMPONENT_HINTS by a
 * page-scoped or global key, filters by the session role, and renders nothing
 * when no copy exists (so it is always safe to drop next to any control).
 */
export function ComponentHelp({
  id,
  helpKey,
  role,
  title,
  tone,
  side,
  label,
  className,
}: ComponentHelpProps) {
  const pathname = usePathname();
  const session = useSession();
  const activeRole = role ?? session?.role;
  const key = helpKey ?? (id ? scopedKey(pathname, id) : undefined);
  if (!key) return null;
  const hint = componentHint(key, activeRole);
  if (!hint) return null;
  if (hint.role && activeRole && hint.role !== activeRole) return null;
  return (
    <InfoHint
      title={title}
      tone={tone}
      side={side}
      label={label ?? "What is this?"}
      {...(className ? { className } : {})}
    >
      <ComponentHelpBody hint={hint} />
    </InfoHint>
  );
}
