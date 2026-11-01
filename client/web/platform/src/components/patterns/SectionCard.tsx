import type { ReactNode } from "react";
import { Children, isValidElement } from "react";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/patterns/InfoHint";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { sectionHint } from "@/lib/help/hints";

/** True when an actions tree already renders its own ComponentHelp, at any depth. */
function containsHelp(node: ReactNode): boolean {
  if (!isValidElement(node)) return false;
  if (node.type === ComponentHelp) return true;
  const kids = (node.props as { children?: ReactNode }).children;
  return Children.toArray(kids).some(containsHelp);
}

export function SectionCard({
  title,
  description,
  info,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string | undefined;
  description?: string | undefined;
  /** Overrides the shared help copy for this section title. */
  info?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  const help = info ?? sectionHint(title);
  // A page that passes its own ComponentHelp into `actions` already gives this section an "i"
  // button — rendering the title's generic hint too puts two identical affordances in one header.
  const actionsHasHelp = containsHelp(actions);
  const showHelp = Boolean(help) && !actionsHasHelp;

  return (
    <section className={cn("surface overflow-hidden", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
              {showHelp ? (
                <InfoHint title={title} label={`About ${title}`}>
                  {help}
                </InfoHint>
              ) : null}
            </div>
            {description ? (
              <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
