"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { PageHeader, Card, Sheet, EmptyState } from "@/components/sellers/kit";
import { formatDateTime, formatINR, parseRupeesToPaisa } from "@/lib/format";
import {
  fetchPrescriptionImages,
  listPrescriptions,
  savePrescriptionQuote,
  setPrescriptionReady,
  setPrescriptionStatus,
} from "@/lib/api";
import { usePortalLoading, useSellerScope } from "@/lib/api/hooks";
import { remoteConfigured } from "@/lib/config";
import { usePortalStore } from "@/lib/api/store";
import { cn } from "@/lib/utils";
import type { PrescriptionRecord, PrescriptionStatus } from "@/data/types";

const STATUS_PILL: Record<PrescriptionStatus, string> = {
  RECEIVED: "bg-info-soft text-info",
  PROCESSING: "bg-warning-soft text-warning",
  QUOTED: "bg-info-soft text-info",
  READY: "bg-success-soft text-success",
  FULFILLED: "bg-success-soft text-success",
  CANCELLED: "bg-muted text-muted-foreground",
};

interface DraftRow {
  name: string;
  qty: string;
  mrp: string;
  price: string;
  discount: string;
}

function emptyRow(): DraftRow {
  return { name: "", qty: "1", mrp: "", price: "", discount: "0" };
}

function toDraft(rx: PrescriptionRecord): DraftRow[] {
  if (!rx.quote || rx.quote.length === 0) return [emptyRow()];
  return rx.quote.map((q) => ({
    name: q.name,
    qty: String(q.qty),
    mrp: String(q.mrpPaisa / 100),
    price: String(q.pricePaisa / 100),
    discount: String(q.discountPaisa / 100),
  }));
}

const inputCls =
  "w-full rounded-lg border border-border bg-card px-2 py-2 text-xs outline-none focus:border-info";

function SellerPrescriptions() {
  const { sellerId, storeId, activeStore } = useSellerScope();
  const loading = usePortalLoading();
  const prescriptions = usePortalStore((s) => s.prescriptions);
  const rows = useMemo(
    () => listPrescriptions(remoteConfigured() ? { storeId } : { sellerId, storeId }),
    [prescriptions, sellerId, storeId],
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const selected = rows.find((p) => p.prescriptionId === openId) ?? null;

  const [draft, setDraft] = useState<DraftRow[]>([emptyRow()]);
  const [images, setImages] = useState<{ objectPath: string; url: string }[] | null>(null);

  const draftTotalPaisa = useMemo(
    () =>
      draft.reduce(
        (sum, r) =>
          sum +
          (Number(r.qty) || 0) * (parseRupeesToPaisa(r.price) - parseRupeesToPaisa(r.discount)),
        0,
      ),
    [draft],
  );

  const open = (rx: PrescriptionRecord) => {
    setOpenId(rx.prescriptionId);
    setDraft(toDraft(rx));
    setImages(null);
  };

  const setRow = (index: number, patch: Partial<DraftRow>) =>
    setDraft((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const advance = (prescriptionId: string, status: "PROCESSING" | "FULFILLED" | "CANCELLED") => {
    setPrescriptionStatus(prescriptionId, status);
    toast.success(`Prescription ${prescriptionId} marked ${status.toLowerCase()}`);
  };

  const saveQuote = () => {
    if (!selected) return;
    const items = draft
      .filter((r) => r.name.trim() !== "")
      .map((r) => ({
        name: r.name.trim(),
        qty: Math.min(99, Math.max(1, Number(r.qty) || 1)),
        mrpPaisa: parseRupeesToPaisa(r.mrp),
        pricePaisa: parseRupeesToPaisa(r.price),
        discountPaisa: parseRupeesToPaisa(r.discount),
      }));
    if (items.length === 0) {
      toast.error("Add at least one priced item before saving the quote.");
      return;
    }
    savePrescriptionQuote(selected.prescriptionId, items);
    toast.success(`Quote saved for ${selected.prescriptionId}`);
  };

  const markReady = () => {
    if (!selected) return;
    if (!setPrescriptionReady(selected.prescriptionId)) {
      toast.error("Save at least one priced item before marking ready.");
      return;
    }
    toast.success(`Prescription ${selected.prescriptionId} is READY — customer notified`);
  };

  const viewImages = async () => {
    if (!selected) return;
    const list = await fetchPrescriptionImages(selected.prescriptionId);
    setImages(list);
    if (list.length === 0)
      toast.message("No viewable images (seed mode or Storage not configured).");
  };

  const revealed = selected?.status === "READY" || selected?.status === "FULFILLED";

  if (activeStore && activeStore.sector !== "PHARMA") {
    return (
      <>
        <PageHeader title="Prescriptions" sub="Operations" />
        <div className="space-y-3 px-4 pt-3 pb-8">
          <EmptyState
            icon={<FileText className="h-12 w-12" strokeWidth={1.2} />}
            text="Prescriptions are routed only to your Pharmacy stores. Switch to a Pharmacy shop to review and fulfil them."
          />
          <Link
            href="/seller/stores"
            className="block rounded-xl bg-info-soft px-4 py-2.5 text-center text-xs font-semibold text-info"
          >
            View your stores →
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Prescriptions" sub="Operations" />
      <div className="space-y-3 px-4 pt-3 pb-8">
        {loading && rows.length === 0 ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-12 w-12" strokeWidth={1.2} />}
            text="No prescriptions yet — customer prescriptions routed to your stores appear here"
          />
        ) : (
          rows.map((p) => (
            <Card key={p.prescriptionId} onClick={() => open(p)} className="cursor-pointer">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{p.prescriptionId}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.customerName || p.userId || "—"} · {p.fulfillment} · {p.pages} page
                    {p.pages === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                    STATUS_PILL[p.status],
                  )}
                >
                  {p.status}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
                <span className="text-muted-foreground">{formatDateTime(p.createdAt)}</span>
                <b>Quote {formatINR(p.quotedTotalPaisa ?? 0)}</b>
              </div>
            </Card>
          ))
        )}
      </div>

      <Sheet
        open={selected !== null}
        onClose={() => setOpenId(null)}
        title={selected ? `${selected.prescriptionId} · ${selected.status}` : ""}
      >
        {selected ? (
          <div className="space-y-4 pb-6">
            <p className="text-xs text-muted-foreground">
              {selected.customerName || "Customer"} · {selected.fulfillment} · {selected.pages} page
              {selected.pages === 1 ? "" : "s"}
            </p>

            {selected.note ? (
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Patient note
                </p>
                {selected.note}
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Rx images
                </p>
                <button onClick={() => void viewImages()} className="text-xs font-semibold text-info">
                  View images
                </button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {selected.imagePaths?.length
                  ? `${selected.imagePaths.length} private Storage key(s)`
                  : "No images attached"}
              </p>
              {images && images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {images.map((img) => (
                    <img
                      key={img.objectPath}
                      src={img.url}
                      alt="Prescription scan"
                      className="h-28 w-24 rounded-lg border border-border object-cover"
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Quote
                </p>
                <button
                  onClick={() => setDraft((r) => [...r, emptyRow()])}
                  disabled={draft.length >= 50}
                  className="flex items-center gap-1 text-xs font-semibold text-info"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add item
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {draft.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1.5">
                    <input
                      placeholder="Item"
                      value={row.name}
                      onChange={(e) => setRow(i, { name: e.target.value })}
                      className={cn(inputCls, "col-span-4")}
                    />
                    <input
                      placeholder="Qty"
                      inputMode="numeric"
                      value={row.qty}
                      onChange={(e) => setRow(i, { qty: e.target.value })}
                      className={cn(inputCls, "col-span-1")}
                    />
                    <input
                      placeholder="MRP"
                      inputMode="decimal"
                      value={row.mrp}
                      onChange={(e) => setRow(i, { mrp: e.target.value })}
                      className={cn(inputCls, "col-span-2")}
                    />
                    <input
                      placeholder="Price"
                      inputMode="decimal"
                      value={row.price}
                      onChange={(e) => setRow(i, { price: e.target.value })}
                      className={cn(inputCls, "col-span-2")}
                    />
                    <input
                      placeholder="Disc ₹"
                      inputMode="decimal"
                      value={row.discount}
                      onChange={(e) => setRow(i, { discount: e.target.value })}
                      className={cn(inputCls, "col-span-2")}
                    />
                    <button
                      aria-label="Remove item"
                      onClick={() =>
                        setDraft((r) => (r.length > 1 ? r.filter((_, j) => j !== i) : [emptyRow()]))
                      }
                      className="col-span-1 flex items-center justify-center rounded-lg text-brand"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Quote total</span>
                <b>{formatINR(draftTotalPaisa)}</b>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={saveQuote}
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
                >
                  Save quote
                </button>
                <button
                  onClick={markReady}
                  disabled={draftTotalPaisa <= 0}
                  className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
                >
                  Mark READY
                </button>
              </div>
            </div>

            {revealed && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <ShieldAlert className="h-4 w-4" /> PII revealed (audited)
                </p>
                <p className="mt-1 text-sm">
                  {selected.customerPhone || "Phone unavailable"} ·{" "}
                  {selected.customerAddress || "Address unavailable"}
                </p>
                {selected.revealedAt && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Revealed {formatDateTime(selected.revealedAt)}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 border-t border-border pt-3">
              <button
                disabled={selected.status !== "RECEIVED" && selected.status !== "QUOTED"}
                onClick={() => advance(selected.prescriptionId, "PROCESSING")}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold disabled:opacity-40"
              >
                Process
              </button>
              <button
                disabled={selected.status !== "READY"}
                onClick={() => advance(selected.prescriptionId, "FULFILLED")}
                className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
              >
                Fulfil
              </button>
              <button
                disabled={selected.status === "FULFILLED" || selected.status === "CANCELLED"}
                onClick={() => advance(selected.prescriptionId, "CANCELLED")}
                className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-brand disabled:opacity-40"
              >
                Cancel
              </button>
            </div>

            {selected.history && selected.history.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Audit trail
                </p>
                <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                  {selected.history.map((h, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>
                        {h.fromStatus ? `${h.fromStatus} → ` : ""}
                        {h.toStatus}
                      </span>
                      <span>
                        {h.actorRole} · {formatDateTime(h.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

export default SellerPrescriptions;