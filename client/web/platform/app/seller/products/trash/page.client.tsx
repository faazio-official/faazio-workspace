"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Clock, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/sellers/kit";
import { formatINR } from "@/lib/format";
import { fetchProductTrash, restoreDeletedProduct, type TrashProduct } from "@/lib/api";
import { hydrateFromGateway } from "@/lib/api/sync";
import { remoteConfigured } from "@/lib/config";
import { sectorLabel } from "@/lib/sector";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left before the row is purged; 0 means it is removed today. */
function daysLeft(purgeAt: string): number {
  const remaining = new Date(purgeAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / DAY_MS));
}

function deletedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function ProductTrash() {
  const [rows, setRows] = useState<TrashProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!remoteConfigured()) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchProductTrash());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(id: string) {
    setBusyId(id);
    try {
      await restoreDeletedProduct(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Listing restored");
      void hydrateFromGateway();
    } catch {
      toast.error("Restore failed", {
        description: "This listing may have passed the 7-day window or is no longer available.",
      });
      void load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Trash"
        sub="Deleted listings · permanently removed after 7 days"
        right={
          <Link
            href="/seller/products"
            className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Products
          </Link>
        }
      />

      <div className="space-y-3 px-4 pt-3 pb-6">
        {loading && rows.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Trash2 className="h-12 w-12" strokeWidth={1.2} />}
            text="No deleted listings — items you delete stay here for a week before they are removed"
          />
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => {
              const remaining = daysLeft(row.purgeAt);
              return (
                <Card key={row.id} className="space-y-3 p-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="min-w-0 truncate text-sm font-semibold">{row.name}</p>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {row.app}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {sectorLabel(row.app)} · {row.category} · {row.id}
                      </p>
                      <p className="mt-1 text-xs">
                        <b>{formatINR(row.price * 100)}</b>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                        remaining <= 1
                          ? "bg-brand-soft text-brand"
                          : "bg-warning-soft text-warning",
                      )}
                    >
                      <Clock className="h-3 w-3" />
                      {remaining === 0 ? "Today" : `${remaining}d left`}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                    <p>
                      Deleted {deletedLabel(row.deletedAt)}
                      {row.deleteReason ? ` · ${row.deleteReason}` : ""}
                    </p>
                    <p className="mt-0.5">Auto-deletes on {deletedLabel(row.purgeAt)}.</p>
                  </div>

                  <button
                    disabled={busyId === row.id}
                    onClick={() => restore(row.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {busyId === row.id ? "Restoring…" : "Restore listing"}
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
