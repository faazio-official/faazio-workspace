"use client";
// Seller notifications — live inbox over `GET /notifications` (notifications.outbox). Rows deep-link
// into the seller surface they describe; read state persists through the gateway. No local fixtures.
import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/sellers/kit";
import { useNotifications } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

const KIND_ROUTE: Record<string, string> = {
  PRODUCT_APPROVED: "/seller/products",
  PRODUCT_REJECTED: "/seller/products",
  SELLER_ORDER_NEW: "/seller/orders",
  RX_READY: "/seller/prescriptions",
};

/** Internal deep link from the row payload, else a kind-based seller route. */
function routeFor(kind: string, data?: Record<string, unknown>): string | null {
  const link = data?.["deepLink"];
  if (typeof link === "string" && link.startsWith("/")) return link;
  return KIND_ROUTE[kind] ?? null;
}

function stamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function Notifications() {
  const { items, loading, markRead, markAllRead } = useNotifications();
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        {...(unread > 0 ? { sub: `${unread} unread` } : {})}
        right={
          <button
            onClick={markAllRead}
            disabled={unread === 0}
            className="text-xs font-semibold text-info disabled:text-muted-foreground"
          >
            Mark all read
          </button>
        }
      />
      {loading && items.length === 0 ? (
        <div className="space-y-3 p-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell className="h-12 w-12" strokeWidth={1.2} />} text="You're all caught up — no new notifications" />
      ) : (
        items.map((n) => {
          const href = routeFor(n.kind, n.data);
          const unreadRow = !n.readAt;
          const inner = (
            <>
              <span
                className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", unreadRow ? "bg-info" : "bg-transparent")}
              />
              <span className="min-w-0 flex-1 text-sm">
                <b className="block">{n.title}</b>
                {n.body ? <span className="block text-xs text-muted-foreground">{n.body}</span> : null}
                {n.createdAt ? (
                  <time className="mt-1 block text-[10px] text-muted-foreground">{stamp(n.createdAt)}</time>
                ) : null}
              </span>
            </>
          );
          const rowClass = cn(
            "flex gap-3 border-b border-border px-4 py-3",
            unreadRow && "bg-info-soft",
            href && "hover:bg-muted",
          );
          return href ? (
            <Link key={n.id} href={href} onClick={() => markRead(n.id)} className={rowClass}>
              {inner}
            </Link>
          ) : (
            <div key={n.id} onClick={() => markRead(n.id)} className={rowClass}>
              {inner}
            </div>
          );
        })
      )}
    </>
  );
}

export default Notifications;
