"use client";
import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { HubHeader } from "@/components/sellers/shells";
import { PillTabs, EmptyState, Sheet } from "@/components/sellers/kit";
import { useMockLoading, useReviews, useSellerScope } from "@/lib/api/hooks";
import { flagReview, replyToReview } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReviewRecord } from "@/data/types";

type Tab = "reviews" | "complaints";

function SellerReviews() {
  const { sellerId } = useSellerScope();
  const loading = useMockLoading();
  const reviews = useReviews({ sellerId });
  const [tab, setTab] = useState<Tab>("reviews");
  const [q, setQ] = useState("");
  const [stars, setStars] = useState<number | null>(null);
  const [replyFor, setReplyFor] = useState<ReviewRecord | null>(null);
  const [reply, setReply] = useState("");

  const average = reviews.length ? reviews.reduce((t, r) => t + r.rating, 0) / reviews.length : 0;
  const list = reviews
    .filter((r) => !stars || r.rating === stars)
    .filter((r) => r.customerName.toLowerCase().includes(q.toLowerCase()));
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <>
      <HubHeader
        sticky={
          <PillTabs
            tabs={[
              { key: "reviews", label: "Reviews", count: reviews.length },
              { key: "complaints", label: "Complaints" },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      {tab === "complaints" ? (
        <div className="px-4 pt-8">
          <EmptyState
            icon={<Star className="h-12 w-12" strokeWidth={1.2} />}
            text="No complaints. Keep up the great service!"
          />
        </div>
      ) : (
        <div className="space-y-3 px-4 pt-3 pb-8">
          <Link
            href="/seller/analytics"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <span className="rounded-md bg-success px-1.5 py-0.5 text-xs font-bold text-primary-foreground">
              {average.toFixed(1)}★
            </span>
            <span className="flex-1 text-xs">
              <b>
                {average.toFixed(1)} average {reviews.length > 0 && `• ${reviews.length} ratings`}
              </b>
              <br />
              <span className="text-muted-foreground">From shop ratings and reviews</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {breakdown.map((row) => (
                <span key={row.star} className="flex items-center gap-0.5">
                  {row.star}
                  <Star className="h-2.5 w-2.5 fill-warning text-warning" />
                </span>
              ))}
            </span>
          </Link>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reviews"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {[5, 4, 3, 2, 1].map((n) => (
              <button
                key={n}
                onClick={() => setStars(stars === n ? null : n)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs",
                  stars === n ? "border-foreground bg-foreground text-background" : "border-border bg-card",
                )}
              >
                {n}
                <Star className="h-3 w-3" />
              </button>
            ))}
          </div>

          <p className="pt-1 text-sm font-bold">Reviews ({list.length})</p>
          {loading && reviews.length === 0 ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState text="No reviews found" />
          ) : (
            list.map((rv) => (
              <div key={rv.reviewId} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {rv.customerName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{rv.customerName}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDateTime(rv.createdAt)}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground",
                      rv.rating >= 4 ? "bg-success" : "bg-warning",
                    )}
                  >
                    {rv.rating}★
                  </span>
                </div>
                {rv.body && <p className="mt-2 text-sm">{rv.body}</p>}
                {rv.flagged && (
                  <p className="mt-2 text-[10px] font-semibold text-brand">Sent to admin for review</p>
                )}
                {rv.sellerReply ? (
                  <p className="mt-2 rounded-lg bg-muted p-2 text-xs">
                    <b>Your reply:</b> {rv.sellerReply}
                  </p>
                ) : (
                  <div className="mt-2 flex items-center gap-3 text-xs font-semibold">
                    <button
                      onClick={() => {
                        setReplyFor(rv);
                        setReply("");
                      }}
                      className="text-info"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => {
                        flagReview(rv.reviewId);
                        toast.success("Sent to admin for moderation");
                      }}
                      className="text-brand"
                    >
                      Flag to admin
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <Sheet
        open={replyFor !== null}
        onClose={() => setReplyFor(null)}
        title="Reply to review"
        footer={
          <button
            disabled={!reply.trim()}
            onClick={() => {
              if (!replyFor) return;
              replyToReview(replyFor.reviewId, reply.trim());
              toast.success("Reply published");
              setReplyFor(null);
            }}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
          >
            Post reply
          </button>
        }
      >
        <textarea
          autoFocus
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
          placeholder="Thank the shopper…"
          className="w-full rounded-xl border border-border p-3 text-sm outline-none focus:border-info"
        />
      </Sheet>
    </>
  );
}

export default SellerReviews;