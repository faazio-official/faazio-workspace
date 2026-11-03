import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader } from "@/components/app/kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Restaurant Partner" }, { name: "description", content: "Updates about your outlet." }, { property: "og:title", content: "Notifications" }, { property: "og:description", content: "Updates about your outlet." }] }),
  component: Notifications,
});

const initial = [
  { id: 1, title: "Payout of ₹2,305.50 processed", sub: "For 19 - 25 Oct'26", to: "/finance", read: false },
  { id: 2, title: "New 5★ review from NAFILSHAHA", sub: "Reply to keep customers coming back", to: "/feedback", read: false },
  { id: 3, title: "Add images to boost orders", sub: "Your menu score is Poor", to: "/growth", read: true },
];

function Notifications() {
  const [list, setList] = useState(initial);
  return (
    <MobileFrame>
      <PageHeader title="Notifications" right={<button onClick={() => setList(list.map((n) => ({ ...n, read: true })))} className="text-xs font-semibold text-info">Mark all read</button>} />
      {list.map((n) => (
        <Link key={n.id} to={n.to} onClick={() => setList(list.map((x) => (x.id === n.id ? { ...x, read: true } : x)))} className={cn("flex gap-3 border-b border-border px-4 py-3", !n.read && "bg-info-soft")}>
          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-info")} />
          <span className="text-sm"><b>{n.title}</b><br /><span className="text-xs text-muted-foreground">{n.sub}</span></span>
        </Link>
      ))}
    </MobileFrame>
  );
}
