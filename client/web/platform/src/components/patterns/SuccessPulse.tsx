import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A single, short scale pulse that confirms success (docs/UI_DESIGN_SYSTEM.md §3
 * Pass 9). One pulse on mount, never a loop; reduced motion removes it via the
 * global guard in `styles.css`.
 */
export function SuccessPulse({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("inline-flex animate-success-pulse", className)}>{children}</span>;
}
