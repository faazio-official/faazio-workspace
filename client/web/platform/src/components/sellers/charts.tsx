"use client";
// Custom SVG charts ported from the seller app vite reference (charts.tsx). No recharts — the
// reference renders tiny inline svgs with brand-coral strokes and ink bars.
export function LineSpark({ data, height = 60 }: { data: number[]; height?: number }) {
  const max = Math.max(1, ...data);
  const w = 240;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * (height - 6) - 3}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={w}
          y1={height * f}
          y2={height * f}
          className="stroke-border"
          strokeDasharray="2 3"
        />
      ))}
      <polyline points={pts} fill="none" className="stroke-brand" strokeWidth="1.5" />
    </svg>
  );
}

export function Bars({ data, height = 110 }: { data: number[]; height?: number }) {
  const max = Math.max(1, ...data);
  const w = 240;
  const bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full">
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={w}
          y1={height * f}
          y2={height * f}
          className="stroke-border"
          strokeDasharray="2 3"
        />
      ))}
      {data.map((v, i) => (
        <rect
          key={i}
          x={i * bw + bw * 0.3}
          width={bw * 0.4}
          y={height - (v / max) * (height - 4)}
          height={(v / max) * (height - 4)}
          className="fill-foreground"
          rx="1"
        />
      ))}
    </svg>
  );
}

export function Gauge({ value, label }: { value: number; label: string }) {
  const r = 70;
  const c = Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <svg viewBox="0 0 180 100" className="mx-auto w-48">
      <path d="M20 90 A70 70 0 0 1 160 90" fill="none" className="stroke-muted" strokeWidth="14" strokeLinecap="round" />
      <path
        d="M20 90 A70 70 0 0 1 160 90"
        fill="none"
        className="stroke-brand"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
      />
      <text x="90" y="82" textAnchor="middle" className="fill-foreground text-[18px] font-bold">
        {label}
      </text>
    </svg>
  );
}