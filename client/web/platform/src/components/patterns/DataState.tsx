"use client";
import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Inbox className="size-5" />
      </div>
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-[14px] font-medium text-foreground">Something didn’t load</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Standard loading -> error -> empty -> content ladder used by every page. */
export function DataShell({
  loading,
  error,
  isEmpty,
  empty,
  children,
  skeletonRows,
}: {
  loading: boolean;
  error?: string | null | undefined;
  isEmpty?: boolean | undefined;
  empty?: ReactNode | undefined;
  children: ReactNode;
  skeletonRows?: number | undefined;
}) {
  if (loading) return <TableSkeleton rows={skeletonRows ?? 6} />;
  if (error) return <ErrorState message={error} />;
  if (isEmpty && empty) return <>{empty}</>;
  return <>{children}</>;
}
