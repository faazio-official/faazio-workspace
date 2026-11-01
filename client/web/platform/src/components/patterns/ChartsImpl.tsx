"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/data/types";
import { formatINR, formatNumber } from "@/lib/format";

const ACCENT = "var(--color-primary)";
const NEUTRAL = "var(--color-chart-2)";
const NEUTRAL_STEPS = [
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  tickLine: false,
  axisLine: false,
};

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 8,
      border: "1px solid var(--color-border)",
      background: "var(--color-card)",
      fontSize: 12,
      fontFamily: "var(--font-mono)",
      boxShadow: "var(--shadow-card)",
    },
    labelStyle: { color: "var(--color-muted-foreground)" },
  };
}

/** Quiet placeholder when a series has no rows yet — never an empty axis frame. */
function EmptyChart({ height, message = "No data for this period" }: { height: number; message?: string }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-md border border-dashed border-border"
    >
      <p className="text-[12px] text-muted-foreground">{message}</p>
    </div>
  );
}

/** A high, thin area with a soft single-hue fill — the screen's one rich moment. */
export function GmvTrend({ data, height = 260 }: { data: DailyPoint[]; height?: number }) {
  if (!data.length || !data.some((d) => d.gmvPaisa > 0)) return <EmptyChart height={height} />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.16} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            {...axis}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={24}
          />
          <YAxis
            {...axis}
            tickFormatter={(v: number) => formatINR(v, { compact: true })}
            width={62}
          />
          <Tooltip
            {...tooltipStyle()}
            formatter={(value: number, name) =>
              name === "gmvPaisa" ? [formatINR(value), "GMV"] : [formatNumber(value), "Orders"]
            }
          />
          <Area
            type="monotone"
            dataKey="gmvPaisa"
            stroke={ACCENT}
            fill="url(#gmvFill)"
            fillOpacity={1}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Secondary trend: a quiet neutral line so the GMV chart clearly leads. */
export function OrdersTrend({ data, height = 240 }: { data: DailyPoint[]; height?: number }) {
  if (!data.length || !data.some((d) => d.orders > 0)) return <EmptyChart height={height} />;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            {...axis}
            tickFormatter={(d: string) => d.slice(5)}
            minTickGap={24}
          />
          <YAxis {...axis} width={40} />
          <Tooltip {...tooltipStyle()} />
          <Line
            type="monotone"
            dataKey="orders"
            stroke={NEUTRAL}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One series: the leader bar carries the accent, the rest stay neutral. */
export function CategoryBars({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  if (!data.length || !data.some((d) => d.value > 0)) return <EmptyChart height={height} />;
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" {...axis} />
          <YAxis
            {...axis}
            tickFormatter={(v: number) => formatINR(v, { compact: true })}
            width={62}
          />
          <Tooltip {...tooltipStyle()} formatter={(v: number) => formatINR(v)} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value === max && max > 0 ? ACCENT : NEUTRAL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DONUT_NEUTRAL = [NEUTRAL, ...NEUTRAL_STEPS, "var(--color-chart-3)"];

export function StatusDonut({
  data,
  height = 240,
  colors,
}: {
  data: { label: string; value: number }[];
  height?: number;
  /** Optional per-label colours (e.g. sector colours). Defaults to neutral steps with the lead slice accented. */
  colors?: Record<string, string> | undefined;
}) {
  if (!data.length || !data.some((d) => d.value > 0)) return <EmptyChart height={height} />;
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  colors?.[d.label] ??
                  (d.value === max && max > 0 ? ACCENT : (DONUT_NEUTRAL[i % DONUT_NEUTRAL.length] as string))
                }
              />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }}
          />
          <Tooltip {...tooltipStyle()} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
