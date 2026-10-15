// 'use client'
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
import { TONE_VAR, type Tone } from "@/lib/ui/tones";

const BAR_TONES: Tone[] = ["primary", "teal", "amber", "grape", "cyan", "rose", "indigo"];

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 10,
      border: "1px solid var(--color-border)",
      fontSize: 12,
      boxShadow: "var(--shadow-card)",
    },
  };
}

export function GmvTrend({ data, height = 260 }: { data: DailyPoint[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-tone-cyan)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
          <YAxis {...axis} tickFormatter={(v: number) => formatINR(v, { compact: true })} width={62} />
          <Tooltip
            {...tooltipStyle()}
            formatter={(value: number, name) =>
              name === "gmvPaisa" ? [formatINR(value), "GMV"] : [formatNumber(value), "Orders"]
            }
          />
          <Area
            type="monotone"
            dataKey="gmvPaisa"
            stroke="var(--color-primary)"
            fill="url(#gmvFill)"
            fillOpacity={1}
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OrdersTrend({ data, height = 240 }: { data: DailyPoint[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
          <YAxis {...axis} width={40} />
          <Tooltip {...tooltipStyle()} />
          <Line
            type="monotone"
            dataKey="orders"
            stroke="var(--color-tone-teal)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} tickFormatter={(v: number) => formatINR(v, { compact: true })} width={62} />
          <Tooltip {...tooltipStyle()} formatter={(v: number) => formatINR(v)} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
            {data.map((_, i) => (
              <Cell key={i} fill={TONE_VAR[BAR_TONES[i % BAR_TONES.length] as Tone]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DONUT_COLORS = [
  "var(--color-primary)",
  "var(--color-tone-teal)",
  "var(--color-tone-amber)",
  "var(--color-tone-grape)",
  "var(--color-tone-rose)",
  "var(--color-tone-cyan)",
];

export function StatusDonut({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="82%" paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Tooltip {...tooltipStyle()} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
