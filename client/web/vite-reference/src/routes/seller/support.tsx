// 'use client'
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { StatusPill } from "@/components/patterns/Pills";
import { EmptyState } from "@/components/patterns/DataState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { pageMeta } from "@/lib/seo";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/seller/support")({
  head: () => pageMeta("Support", "Raise a ticket with the Faazio partner team and track replies."),
  component: SellerSupport,
});

interface Ticket {
  id: string;
  subject: string;
  body: string;
  status: "NEW" | "PENDING";
  createdAt: string;
}

function SellerSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="space-y-4">
      <PageHeader title="Support" description="Partner support replies inside working hours." />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Raise a ticket">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">What happened?</Label>
              <Textarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <Button
              size="sm"
              disabled={subject.trim().length < 4 || body.trim().length < 8}
              onClick={() => {
                setTickets((list) => [
                  {
                    id: `TCK-${list.length + 1}`,
                    subject: subject.trim(),
                    body: body.trim(),
                    status: "NEW",
                    createdAt: new Date().toISOString(),
                  },
                  ...list,
                ]);
                setSubject("");
                setBody("");
                toast.success("Ticket raised");
              }}
            >
              Submit ticket
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="My tickets" bodyClassName="p-0">
          {tickets.length === 0 ? (
            <EmptyState
              title="No tickets"
              description="Raise a ticket on the left and it will appear here with its status."
            />
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="num text-[12px] font-semibold">{ticket.id}</span>
                    <StatusPill status={ticket.status} />
                    <span className="num ml-auto text-[11px] text-muted-foreground">
                      {formatDateTime(ticket.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] font-medium">{ticket.subject}</p>
                  <p className="text-[12px] text-muted-foreground">{ticket.body}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
