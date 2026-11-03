"use client";
import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy } from "lucide-react";
import { PageHeader, Card, TextField, EmptyState } from "@/components/sellers/kit";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const canSubmit = subject.trim().length >= 4 && body.trim().length >= 8;

  return (
    <>
      <PageHeader title="Support" sub="Help" />
      <div className="space-y-3 px-4 pt-3 pb-8">
        <Card>
          <p className="text-sm font-bold">Raise a ticket</p>
          <p className="text-[10px] text-muted-foreground">Partner support replies inside working hours.</p>
          <TextField label="Subject" value={subject} onChange={setSubject} />
          <label className="block py-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              What happened?
            </span>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-info"
            />
          </label>
          <button
            disabled={!canSubmit}
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
            className="mt-1 w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
          >
            Submit ticket
          </button>
        </Card>

        <p className="pt-2 text-sm font-bold">My tickets</p>
        {tickets.length === 0 ? (
          <EmptyState
            icon={<LifeBuoy className="h-12 w-12" strokeWidth={1.2} />}
            text="Raise a ticket and it will appear here with its status"
          />
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{ticket.id}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                    ticket.status === "NEW"
                      ? "bg-info-soft text-info"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  {ticket.status}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {formatDateTime(ticket.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold">{ticket.subject}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ticket.body}</p>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default SellerSupport;