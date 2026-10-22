import { cn } from "@/lib/utils";
import type { Sector } from "@/data/types";

const SECTOR_CLASS: Record<Sector, string> = {
  MART: "bg-mart/12 text-mart ring-mart/25",
  FOOD: "bg-food/12 text-food ring-food/25",
  PHARMA: "bg-pharma/15 text-pharma ring-pharma/25",
};

const SECTOR_DOT: Record<Sector, string> = {
  MART: "bg-mart",
  FOOD: "bg-food",
  PHARMA: "bg-pharma",
};

export function SectorPill({ sector }: { sector: Sector }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1",
        SECTOR_CLASS[sector],
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", SECTOR_DOT[sector])} />
      {sector}
    </span>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-secondary text-muted-foreground ring-border",
  success: "bg-success/12 text-success ring-success/25",
  warning: "bg-warning/15 text-warning ring-warning/30",
  danger: "bg-destructive/10 text-destructive ring-destructive/25",
  info: "bg-primary/10 text-primary ring-primary/25",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-primary",
};

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "success",
  APPROVED: "success",
  DELIVERED: "success",
  PAID: "success",
  LIVE: "success",
  PENDING: "warning",
  PENDING_REVIEW: "warning",
  REQUESTED: "warning",
  SCHEDULED: "info",
  NEW: "info",
  PACKED: "info",
  SHIPPED: "info",
  DRAFT: "neutral",
  ENDED: "neutral",
  DELISTED: "neutral",
  ON_HOLD: "warning",
  SUSPENDED: "danger",
  BLACKLISTED: "danger",
  VERIFIED: "info",
  APPLIED: "warning",
  REUPLOAD_REQUESTED: "warning",
  REJECTED: "danger",
  CANCELLED: "danger",
  RETURNED: "danger",
  RECEIVED: "info",
  PROCESSING: "warning",
  QUOTED: "info",
  READY: "success",
  FULFILLED: "success",
  PUBLISHED: "success",
  pending: "warning",
  confirmed: "success",
  rejected: "danger",
  completed: "neutral",
  cancelled: "danger",
  normal: "neutral",
  urgent: "warning",
  critical: "danger",
};

export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        TONE_CLASS[tone],
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
      {status.replace(/_/g, " ")}
    </span>
  );
}
