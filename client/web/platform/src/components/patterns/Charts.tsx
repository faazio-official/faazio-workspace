"use client";
import dynamic from "next/dynamic";

// Recharts touches `window` during render, which crashes `next build`'s
// prerender pass even inside a client component. Each chart is loaded
// client-side only behind a fixed-height skeleton so pages stay untouched and
// the layout does not jump. Implementations live in ChartsImpl.tsx.
function ChartSkeleton({ height }: { height: number }) {
  return <div aria-hidden className="animate-pulse rounded-lg bg-muted" style={{ height }} />;
}

const loading = (height: number) => () => <ChartSkeleton height={height} />;

export const GmvTrend = dynamic(
  () => import("./ChartsImpl").then((m) => m.GmvTrend),
  { ssr: false, loading: loading(260) },
);

export const OrdersTrend = dynamic(
  () => import("./ChartsImpl").then((m) => m.OrdersTrend),
  { ssr: false, loading: loading(240) },
);

export const CategoryBars = dynamic(
  () => import("./ChartsImpl").then((m) => m.CategoryBars),
  { ssr: false, loading: loading(240) },
);

export const StatusDonut = dynamic(
  () => import("./ChartsImpl").then((m) => m.StatusDonut),
  { ssr: false, loading: loading(240) },
);