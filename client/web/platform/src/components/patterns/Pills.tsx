import { cn } from "@/lib/utils";
import type { Sector } from "@/data/types";

const SECTOR_DOT: Record<Sector, string> = {
  MART: "bg-mart",
  FOOD: "bg-food",
  PHARMA: "bg-pharma",
};

/** Sector is an acronym; it stays uppercase with a small colour dot. */
export function SectorPill({ sector }: { sector: Sector }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <span aria-hidden className={cn("size-1.5 rounded-full", SECTOR_DOT[sector])} />
      {sector}
    </span>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

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
  HEALTHY: "success",
  READY: "success",
  FULFILLED: "success",
  PUBLISHED: "success",
  confirmed: "success",
  PENDING: "warning",
  PENDING_REVIEW: "warning",
  REQUESTED: "warning",
  AT_RISK: "warning",
  UNASSIGNED: "warning",
  MANUAL: "warning",
  ON_HOLD: "warning",
  APPLIED: "warning",
  REUPLOAD_REQUESTED: "warning",
  PROCESSING: "warning",
  pending: "warning",
  urgent: "warning",
  SCHEDULED: "info",
  NEW: "info",
  PACKED: "info",
  ASSIGNED: "info",
  AUTOMATED: "info",
  SHIPPED: "info",
  VERIFIED: "info",
  RECEIVED: "info",
  QUOTED: "info",
  DRAFT: "neutral",
  ENDED: "neutral",
  DELISTED: "neutral",
  completed: "neutral",
  normal: "neutral",
  SUSPENDED: "danger",
  BLACKLISTED: "danger",
  REJECTED: "danger",
  CANCELLED: "danger",
  RETURNED: "danger",
  rejected: "danger",
  cancelled: "danger",
  critical: "danger",
};

/** Humanises a raw enum value: PENDING_REVIEW → Pending review. */
function humanize(status: string): string {
  const spaced = status.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Status is meta: a toned dot and quiet text, never a glowing pill. */
export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted-foreground">
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} />
      {humanize(status)}
    </span>
  );
}
