// 'use client'
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Flag, Star } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { pageMeta } from "@/lib/seo";
import { formatDate } from "@/lib/format";
import { flagReview, replyToReview } from "@/lib/api";
import { useMockLoading, useReviews } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";

export const Route = createFileRoute("/seller/reviews")({
  head: () =>
    pageMeta("Reviews", "Rating breakdown, replies to shoppers and flagging abusive reviews to admins."),
  component: SellerReviews,
});

function SellerReviews() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const reviews = useReviews({ sellerId });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const average = reviews.length
    ? reviews.reduce((t, r) => t + r.rating, 0) / reviews.length
    : 0;
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title="Reviews" description="Replies show under the product in the consumer app." />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Rating breakdown">
          <div className="flex items-end gap-2">
            <p className="num text-[28px] font-semibold leading-none">{average.toFixed(1)}</p>
            <Star className="mb-1 size-4 text-warning" />
            <span className="mb-1 text-[12px] text-muted-foreground">
              {reviews.length} reviews
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {breakdown.map((row) => (
              <li key={row.star} className="flex items-center gap-2 text-[12px]">
                <span className="num w-3">{row.star}</span>
                <div className="h-1.5 flex-1 rounded-full bg-secondary">
                  <div
                    className="h-1.5 rounded-full bg-warning"
                    style={{
                      width: `${reviews.length ? (row.count / reviews.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="num w-6 text-right text-muted-foreground">{row.count}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Recent reviews" className="lg:col-span-2" bodyClassName="p-0">
          <DataShell
            loading={loading}
            isEmpty={reviews.length === 0}
            empty={<EmptyState title="No reviews yet" description="Reviews arrive after your first deliveries." />}
          >
            <ul className="divide-y divide-border">
              {reviews.map((review) => (
                <li key={review.reviewId} className="space-y-2 p-4">
                  <div className="flex items-center gap-2">
                    <span className="num text-[13px] font-semibold">{review.rating}.0</span>
                    <Star className="size-3.5 text-warning" />
                    <span className="text-[13px] font-medium">{review.customerName}</span>
                    <span className="num text-[11px] text-muted-foreground">
                      {formatDate(review.createdAt)}
                    </span>
                    {review.flagged ? (
                      <span className="ml-auto text-[11px] font-semibold text-destructive">
                        Flagged to admin
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[13px] text-muted-foreground">{review.body}</p>
                  {review.sellerReply ? (
                    <p className="rounded-lg bg-secondary px-3 py-2 text-[12px]">
                      Your reply: {review.sellerReply}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        placeholder="Reply to this shopper"
                        value={drafts[review.reviewId] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [review.reviewId]: e.target.value }))
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!drafts[review.reviewId]}
                          onClick={() => {
                            replyToReview(review.reviewId, drafts[review.reviewId] ?? "");
                            toast.success("Reply published");
                          }}
                        >
                          Send reply
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            flagReview(review.reviewId);
                            toast.success("Sent to admin for moderation");
                          }}
                        >
                          <Flag className="size-4" /> Flag to admin
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </DataShell>
        </SectionCard>
      </div>
    </div>
  );
}
