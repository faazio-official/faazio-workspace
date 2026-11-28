"use client";
// Admin notification console — a live, cross-user view of the notification pipeline
// (`GET /admin/notifications`) plus the seller-onboarding event feed (`GET /admin/seller-activity`).
// Rows are clickable and open the surface they refer to (seller detail / orders).
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { StatusPill } from "@/components/patterns/Pills";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { useAdminNotifications, useSellerActivity } from "@/lib/api/hooks";
import type { AdminNotification, SellerActivity } from "@/lib/api";

const STATUSES = ["ALL", "PENDING", "SENT", "FAILED"] as const;

export function AdminNotificationsConsole() {
  const [status, setStatus] = useState<string>("ALL");
  const { items, loading } = useAdminNotifications(status);
  const { items: activity } = useSellerActivity();
  const router = useRouter();
  const pathname = usePathname();
  const superView = pathname?.startsWith("/admin/super") ?? false;

  const openSeller = (sellerId: string) => {
    if (sellerId) router.push(`/admin/district/sellers/${sellerId}`);
  };

  const notificationHref = (n: AdminNotification): string | null => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const sellerId = typeof data["sellerId"] === "string" ? data["sellerId"] : undefined;
    const orderId = typeof data["orderId"] === "string" ? data["orderId"] : undefined;
    if (sellerId) return `/admin/district/sellers/${sellerId}`;
    if (orderId) return superView ? `/admin/super/orders/${orderId}` : "/admin/district/orders";
    if (n.kind.startsWith("PRODUCT_")) {
      return superView ? "/admin/super/products" : "/admin/district/products";
    }
    return null;
  };

  const openActivity = (a: SellerActivity) => openSeller(a.sellerId);

  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" />

      <SectionCard title="Seller activity">
        {activity.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No seller activity yet</p>
        ) : (
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => openActivity(a)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{a.title}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{a.body}</span>
                  </span>
                  <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {formatDateTime(a.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-3">
          {STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={option === "ALL" ? "All" : option.charAt(0) + option.slice(1).toLowerCase()}
              active={status === option}
              onClick={() => setStatus(option)}
            />
          ))}
        </div>

        <DataShell
          loading={loading && items.length === 0}
          isEmpty={items.length === 0}
          empty={<p className="p-6 text-[13px] text-muted-foreground">No notifications</p>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="hidden md:table-cell">Kind</TableHead>
                <TableHead className="hidden lg:table-cell">Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((n) => {
                const href = notificationHref(n);
                return (
                  <TableRow
                    key={n.id}
                    onClick={href ? () => router.push(href) : undefined}
                    className={href ? "cursor-pointer hover:bg-muted/50" : undefined}
                  >
                    <TableCell className="max-w-[280px]">
                      <p className="truncate font-medium">{n.title}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{n.body}</p>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-[12px] text-muted-foreground md:table-cell">
                      {n.kind}
                    </TableCell>
                    <TableCell className="hidden font-mono text-[11px] text-muted-foreground lg:table-cell">
                      {n.userId || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={n.status} />
                      {typeof n.attempts === "number" && n.attempts > 0 ? (
                        <span className="ml-1 text-[11px] text-muted-foreground">×{n.attempts}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-[12px] text-muted-foreground sm:table-cell">
                      {formatDateTime(n.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}
