"use client";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/patterns/InfoHint";
import { metricHint } from "@/lib/help/hints";

export interface KpiCardProps {
  label: string;
  value: string;
  deltaPercent?: number | undefined;
  /** What the change is measured against, e.g. "vs previous 30 days". */
  compare?: string | undefined;
  hint?: string | undefined;
  /** Longer explanation shown behind the "i" button. */
  info?: string | undefined;
}

/** A single figure: label, value, and its change. No sparklines, no tallies. */
export function KpiCard({ label, value, deltaPercent, compare, hint, info }: KpiCardProps) {
  const help = info ?? metricHint(label);
  const hasDelta = typeof deltaPercent === "number";
  const positive = (deltaPercent ?? 0) >= 0;
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-1">
        <p className="text-[12px] text-muted-foreground">{label}</p>
        {help ? (
          <InfoHint title={label} label={`About ${label}`}>
            {help}
          </InfoHint>
        ) : null}
      </div>
      <p className="num mt-3 text-[28px] font-medium leading-none text-foreground">{value}</p>
      {hasDelta || hint ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]">
          {hasDelta ? (
            <span
              className={cn(
                "num inline-flex items-center gap-0.5 font-medium",
                positive ? "text-success" : "text-destructive",
              )}
            >
              {positive ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {Math.abs(deltaPercent ?? 0).toFixed(1)}%
            </span>
          ) : null}
          {hasDelta ? (
            <span className="text-muted-foreground">{compare ?? "vs previous period"}</span>
          ) : null}
          {hint ? <span className="text-muted-foreground">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One row when the strip is small enough to read as a single band; otherwise 4 across so no card
 * is ever stranded alone on its own row. Literal class strings only — Tailwind scans source text.
 */
const STRIP_COLS: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

function stripCols(count: number): string {
  return STRIP_COLS[count] ?? (count % 4 === 1 ? "xl:grid-cols-3" : "xl:grid-cols-4");
}

export function KpiStrip({ items }: { items: KpiCardProps[] }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${stripCols(items.length)}`}>
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}
