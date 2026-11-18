"use client";
// Seller-initiated platform-fee change. The fee is a property of the VENDOR, so the seller picks the
// shop that needs a new rate first; the current fee and app brand are read from that store, and the
// gateway re-validates the requested value (1–100, >= 5 for FOOD) and the one-pending-per-shop rule.
// Submitting never mutates the live fee — a district/super admin approves it on the fee boards.
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Percent } from "lucide-react";
import {
  PageHeader,
  Card,
  EmptyState,
  PrimaryButton,
  SectorBadge,
  TextField,
} from "@/components/sellers/kit";
import { StatusPill } from "@/components/patterns/Pills";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { requestSellerPlatformFeeChange } from "@/lib/api";
import { useSellerFeeChangeRequests, useSellerScope } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { cn } from "@/lib/utils";
import type { Sector } from "@/data/types";

const FOOD_FEE_FLOOR = 5;
const REASON_MAX = 500;

function floorFor(sector: Sector | undefined): number {
  return sector === "FOOD" ? FOOD_FEE_FLOOR : 1;
}

function FeeChangeRequestPage() {
  const session = useSession();
  const { sellerId, stores, activeStore: scopedStore, loading } = useSellerScope();
  const [pickedStoreId, setPickedStoreId] = useState("");
  // A typed value belongs to the shop it was typed for, so switching shops falls back to that
  // shop's live fee instead of carrying a number (or a reason) across vendors.
  const [draft, setDraft] = useState<{ storeId: string; value: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { requests, reload } = useSellerFeeChangeRequests(sellerId);

  const activeStore = useMemo(
    () => stores.find((s) => s.storeId === pickedStoreId) ?? scopedStore ?? stores[0] ?? null,
    [pickedStoreId, scopedStore, stores],
  );

  const value =
    draft && draft.storeId === activeStore?.storeId
      ? draft.value
      : activeStore
        ? String(activeStore.platformFeePct)
        : "";

  const reason = draft && draft.storeId === activeStore?.storeId ? draft.reason : "";

  const pendingForStore = requests.find(
    (r) => r.status === "PENDING" && r.storeId === activeStore?.storeId,
  );
  const floor = floorFor(activeStore?.sector);
  const next = Number(value);
  const isWholePercent = value.trim() !== "" && Number.isInteger(next);
  const inRange = isWholePercent && next >= 1 && next <= 100;
  const aboveFloor = isWholePercent && next >= floor;
  const differs = activeStore ? next !== activeStore.platformFeePct : false;
  const canSubmit =
    Boolean(sellerId && activeStore) &&
    !pendingForStore &&
    inRange &&
    aboveFloor &&
    differs &&
    reason.length <= REASON_MAX &&
    !busy;

  const hint = !activeStore
    ? ""
    : pendingForStore
      ? `A request for ${pendingForStore.requestedFeePct}% is already pending review.`
      : !isWholePercent
        ? "Enter a whole percentage."
        : !inRange
          ? "Enter a whole percentage between 1 and 100."
          : !aboveFloor
            ? `Food vendors must keep the platform fee at ${FOOD_FEE_FLOOR}% or higher.`
            : !differs
              ? "That is already this vendor's current platform fee."
              : reason.length > REASON_MAX
                ? `Keep the reason under ${REASON_MAX} characters.`
                : "";

  function selectStore(id: string) {
    setPickedStoreId(id);
    setDraft(null);
  }

  async function submit() {
    if (!canSubmit || !activeStore) return;
    setBusy(true);
    try {
      await requestSellerPlatformFeeChange(sellerId, activeStore.storeId, next, reason.trim());
      toast.success("Request submitted — an admin will review it");
      setDraft(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the request");
    } finally {
      setBusy(false);
    }
  }

  if (session && !session.sellerId) {
    return (
      <>
        <PageHeader title="Platform fee" sub="Account" />
        <EmptyState text="Sign in with the seller account that owns these shops to request a fee change." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Platform fee"
        sub="Account"
        right={
          <Link href="/seller/fee-history" className="text-xs font-semibold text-info">
            History
          </Link>
        }
      />
      <div className="space-y-3 px-4 pt-3 pb-8">
        <Card>
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-info" strokeWidth={2} />
            <p className="text-sm font-bold">Request a fee change</p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your platform fee is fixed when a shop is approved. Ask for a new rate per shop and an
            admin will review it.
          </p>

          {loading && stores.length === 0 ? (
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted" />
          ) : stores.length === 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                No vendor stores are linked to this account yet.
              </p>
              <Link
                href="/seller/onboarding"
                className="block rounded-xl bg-foreground py-3 text-center text-sm font-semibold text-background"
              >
                Create a shop
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-4 text-xs font-medium text-muted-foreground">Vendor store</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {stores.map((store) => {
                  const active = store.storeId === activeStore?.storeId;
                  return (
                    <button
                      key={store.storeId}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectStore(store.storeId)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span className="max-w-[10rem] truncate">{store.name}</span>
                      <SectorBadge sector={store.sector} />
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-info-soft px-3 py-2.5">
                <span className="truncate text-xs font-medium text-info">
                  Current fee · {activeStore?.name}
                </span>
                <span className="num shrink-0 text-base font-bold text-foreground">
                  {activeStore ? `${activeStore.platformFeePct}%` : "—"}
                </span>
              </div>

              <TextField
                label={`Requested fee (%)${activeStore?.sector === "FOOD" ? ` — ${FOOD_FEE_FLOOR}% minimum` : ""}`}
                value={value}
                onChange={(v) =>
                  setDraft({ storeId: activeStore?.storeId ?? "", value: v, reason })
                }
                type="number"
                placeholder="e.g. 12"
                disabled={busy || Boolean(pendingForStore)}
              />

              <label className="mt-3 block">
                <span className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Why should this change? (optional)
                  </span>
                  <span
                    className={cn(
                      "num text-[10px]",
                      reason.length > REASON_MAX ? "text-danger" : "text-muted-foreground",
                    )}
                  >
                    {reason.length}/{REASON_MAX}
                  </span>
                </span>
                <Textarea
                  rows={3}
                  value={reason}
                  maxLength={REASON_MAX}
                  placeholder="e.g. Rent and packaging costs went up, so we need a lower commission to stay open."
                  disabled={busy || Boolean(pendingForStore)}
                  onChange={(e) =>
                    setDraft({
                      storeId: activeStore?.storeId ?? "",
                      value,
                      reason: e.target.value,
                    })
                  }
                  className="rounded-xl bg-card text-[16px] md:text-sm"
                />
              </label>

              {hint ? (
                <p
                  className={cn(
                    "mt-1 text-xs font-medium",
                    pendingForStore ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {hint}
                </p>
              ) : null}

              <PrimaryButton className="mt-4 w-full" disabled={!canSubmit} onClick={() => void submit()}>
                {busy ? "Submitting…" : "Submit request"}
              </PrimaryButton>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Recent requests</p>
            <Link href="/seller/fee-history" className="text-xs font-semibold text-info">
              View all
            </Link>
          </div>
          {requests.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No requests yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {requests.slice(0, 4).map((row) => (
                <li key={row.requestId} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="num text-[13px] font-semibold">
                      {row.currentFeePct}% → {row.requestedFeePct}%
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {formatDateTime(row.requestedAt)}
                      {row.reviewReason ? ` · ${row.reviewReason}` : ""}
                    </p>
                    {row.sellerNote ? (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
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
      </div>
    </>
  );
}

export default FeeChangeRequestPage;
