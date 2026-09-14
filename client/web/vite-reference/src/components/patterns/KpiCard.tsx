// 'use client'
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/patterns/InfoHint";
import { metricHint } from "@/lib/help/hints";
import { toneFor, TONE_SOFT, TONE_TEXT, TONE_VAR, type Tone } from "@/lib/ui/tones";

export interface KpiCardProps {
  label: string;
  value: string;
  deltaPercent?: number | undefined;
  hint?: string | undefined;
  /** Longer explanation shown behind the "i" button. */
  info?: string | undefined;
  tone?: Tone | undefined;
  spark?: { value: number }[] | undefined;
}

export function KpiCard({ label, value, deltaPercent, hint, info, tone, spark }: KpiCardProps) {
  const positive = (deltaPercent ?? 0) >= 0;
  const hue = tone ?? toneFor(label);
  const help = info ?? metricHint(label);
  return (
    <div className={cn("surface lift rail wash p-4", TONE_TEXT[hue])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {help ? (
          <InfoHint title={label} tone={hue} label={`About ${label}`}>
            {help}
          </InfoHint>
        ) : null}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="num text-[22px] font-semibold leading-none text-foreground">{value}</p>
        {spark && spark.length > 1 ? (
          <div className="h-9 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={TONE_VAR[hue]}
                  fill={TONE_VAR[hue]}
                  fillOpacity={0.16}
                  strokeWidth={1.8}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {typeof deltaPercent === "number" ? (
          <span
            className={cn(
              "num inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12px] font-semibold",
              positive ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {Math.abs(deltaPercent).toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span className="text-[12px] text-muted-foreground">{hint}</span> : null}
      </div>
      <span className={cn("sr-only", TONE_SOFT[hue])} />
    </div>
  );
}

export function KpiStrip({ items }: { items: KpiCardProps[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}
