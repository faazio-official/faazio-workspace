import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/patterns/InfoHint";
import { sectionHint } from "@/lib/help/hints";
import { toneFor, TONE_TEXT, TONE_VAR, type Tone } from "@/lib/ui/tones";

export function SectionCard({
  title,
  description,
  info,
  tone,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string | undefined;
  description?: string | undefined;
  /** Overrides the shared help copy for this section title. */
  info?: string | undefined;
  tone?: Tone | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  const hue = tone ?? toneFor(title ?? "section");
  const help = info ?? sectionHint(title);

  return (
    <section className={cn("surface overflow-hidden", className)}>
      {title ? (
        <div
          className={cn(
            "wash flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3",
            TONE_TEXT[hue],
          )}
        >
          <div className="flex min-w-0 items-start gap-2">
            <span
              aria-hidden
              className="mt-1 h-4 w-1 shrink-0 rounded-full"
              style={{ background: TONE_VAR[hue] }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
                {help ? (
                  <InfoHint title={title} tone={hue} label={`About ${title}`}>
                    {help}
                  </InfoHint>
                ) : null}
              </div>
              {description ? (
                <p className="text-[12px] text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
