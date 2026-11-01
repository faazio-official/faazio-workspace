"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { InfoHint } from "@/components/patterns/InfoHint";
import { PageHelpBody } from "@/components/patterns/ComponentHelp";
import { routeHint } from "@/lib/help/hints";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  const pathname = usePathname();
  const hint = routeHint(pathname);

  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h1 className="text-[20px] font-medium tracking-tight text-foreground">{title}</h1>
          {hint ? (
            <InfoHint title={title} label={`How to use ${title}`}>
              <PageHelpBody hint={hint} />
            </InfoHint>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
