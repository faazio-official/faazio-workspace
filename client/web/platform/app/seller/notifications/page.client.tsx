"use client";
// Seller notifications (reference `notifications` route). Pure client list with a mark-all-read
// action; rows deep-link into the seller surfaces they describe.
import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/sellers/kit";
import { cn } from "@/lib/utils";

type Notice = { id: number; title: string; sub: string; to: string; read: boolean };

const INITIAL: Notice[] = [
  { id: 1, title: "Payout of ₹2,305.50 processed", sub: "Settlement for your latest cycle", to: "/seller/payments", read: false },
  { id: 2, title: "New 5-star review from NAFIL SHAHA", sub: "Reply to keep customers coming back", to: "/seller/reviews", read: false },
  { id: 3, title: "Add images to boost orders", sub: "Your menu score could be better", to: "/seller/ads", read: true },
];

function Notifications() {
  const [list, setList] = useState<Notice[]>(INITIAL);
  const markAll = () => setList((current) => current.map((n) => ({ ...n, read: true })));
  const markRead = (id: number) =>
    setList((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));

  return (
    <>
      <PageHeader
        title="Notifications"
        right={
          <button onClick={markAll} className="text-xs font-semibold text-info">
            Mark all read
          </button>
        }
      />
      {list.length === 0 ? (
        <EmptyState icon={<Bell className="h-12 w-12" strokeWidth={1.2} />} text="You're all caught up — no new notifications" />
      ) : (
        list.map((n) => (
          <Link
            key={n.id}
            href={n.to}
            onClick={() => markRead(n.id)}
            className={cn("flex gap-3 border-b border-border px-4 py-3", !n.read && "bg-info-soft")}
          >
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-info")}
            />
            <span className="text-sm">
              <b>{n.title}</b>
              <br />
              <span className="text-xs text-muted-foreground">{n.sub}</span>
            </span>
          </Link>
        ))
      )}
    </>
  );
}

export default Notifications;