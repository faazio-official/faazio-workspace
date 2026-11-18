"use client";
// The seller's own platform-fee request history (`GET /sellers/{id}/platform-fee-requests`). The
// gateway scopes the read to the caller's seller_id, so this page never filters client-side and
// never shows another seller's rows.
import Link from "next/link";
import { Receipt } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/sellers/kit";
import { StatusPill } from "@/components/patterns/Pills";
import { formatDateTime } from "@/lib/format";
import { useSellerFeeChangeRequests, useSellerScope } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";

function FeeHistoryPage() {
  const session = useSession();
  const { sellerId, stores } = useSellerScope();
  const { requests, loading } = useSellerFeeChangeRequests(sellerId);

  const storeName = (storeId?: string) => {
    if (!storeId) return "—";
    return stores.find((s) => s.storeId === storeId)?.name ?? storeId;
  };

  if (session && !session.sellerId) {
    return (
      <>
        <PageHeader title="Fee request history" sub="Account" />
        <EmptyState text="Sign in with a seller account to see its platform-fee requests." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Fee request history"
        sub="Account"
        right={
          <Link href="/seller/fee-change-request" className="text-xs font-semibold text-info">
            New request
          </Link>
        }
      />
      <div className="space-y-3 px-4 pt-3 pb-8">
        <Card className="p-0">
          {loading && requests.length === 0 ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-12 w-12" strokeWidth={1.2} />}
              text="No fee change requests found"
            />
          ) : (
            <ul className="divide-y divide-border">
              {requests.map((row) => (
                <li key={row.requestId} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="num text-[13px] font-semibold">
                      {row.currentFeePct}% → {row.requestedFeePct}%
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{storeName(row.storeId)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTime(row.requestedAt)}
                      {row.reviewReason ? ` · ${row.reviewReason}` : ""}
                    </p>
                    {row.sellerNote ? (
                      <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                        “{row.sellerNote}”
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0">
                    <StatusPill status={row.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          A request is a request: only an admin approval rewrites the shop's live platform fee.
        </p>
      </div>
    </>
  );
}

export default FeeHistoryPage;
