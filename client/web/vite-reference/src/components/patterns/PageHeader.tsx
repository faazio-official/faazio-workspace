// 'use client'
import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { InfoHint } from "@/components/patterns/InfoHint";
import { routeHint } from "@/lib/help/hints";
import { toneFor, TONE_VAR } from "@/lib/ui/tones";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hint = routeHint(pathname);
  const tone = toneFor(title);

  return (
    <header className="relative mb-5 overflow-hidden rounded-xl border border-border bg-card px-4 py-3.5 shadow-card">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: TONE_VAR[tone] }}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-5 w-1.5 rounded-full"
              style={{ background: TONE_VAR[tone] }}
            />
            <h1 className="text-[19px] font-semibold text-foreground">{title}</h1>
            {hint ? (
              <InfoHint title={title} tone={tone} label={`How to use ${title}`}>
                <p>{hint.what}</p>
                <p className="mt-1.5 font-medium text-ink-foreground">Tip: {hint.how}</p>
              </InfoHint>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
