"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatINR, parseRupeesToPaisa } from "@/lib/format";
import {
  fetchPrescriptionImages,
  listPrescriptions,
  savePrescriptionQuote,
  setPrescriptionReady,
  setPrescriptionStatus,
} from "@/lib/api";
import { useMockLoading } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { remoteConfigured } from "@/lib/config";
import { usePortalStore } from "@/lib/api/store";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import type { PrescriptionFulfillment, PrescriptionRecord } from "@/data/types";

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

function SellerPrescriptions() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-4";
  const loading = useMockLoading();
  // In remote mode the gateway already scopes rows to the caller's seller token; seed mode filters.
  const prescriptions = usePortalStore((s) => s.prescriptions);
  const rows = useMemo(
    () => listPrescriptions(remoteConfigured() ? {} : { sellerId }),
    [prescriptions, sellerId],
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

  const close = () => setOpenId(null);

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Prescriptions"
        description="Price each Rx, then flip it READY to reveal the customer's contact and notify them. Images stay private to Storage."
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title="No prescriptions yet"
              description="Customer prescriptions routed to your stores appear here."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prescription</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Pages</TableHead>
                <TableHead>Fulfilment</TableHead>
                <TableHead className="text-right">Quote</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.prescriptionId} className="h-12">
                  <TableCell className="font-medium">{p.prescriptionId}</TableCell>
                  <TableCell>{p.customerName || p.userId || "—"}</TableCell>
                  <TableCell className="num text-right">{p.pages}</TableCell>
                  <TableCell>{p.fulfillment}</TableCell>
                  <TableCell className="num text-right">
                    {formatINR(p.quotedTotalPaisa ?? 0)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(p.createdAt)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={p.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => open(p)}>
                        Open
                      </Button>
                      <ComponentHelp id="open-button" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Sheet open={selected !== null} onOpenChange={(o) => (o ? undefined : close())}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-5">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.prescriptionId}
                  <StatusPill status={selected.status} />
                </SheetTitle>
                <p className="text-[13px] text-muted-foreground">
                  {selected.customerName || "Customer"} · {selected.fulfillment} · {selected.pages}{" "}
                  page
                  {selected.pages === 1 ? "" : "s"}
                </p>
              </SheetHeader>

              {selected.note ? (
                <div className="rounded-md border border-border bg-secondary/40 p-3 text-[13px]">
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                    Patient note
                  </p>
                  {selected.note}
                </div>
              ) : null}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-[12px] text-muted-foreground">
                    Rx images
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => void viewImages()}>
                      View images
                    </Button>
                    <ComponentHelp id="view-images" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selected.imagePaths?.length
                    ? `${selected.imagePaths.length} private Storage key(s)`
                    : "No images attached"}
                </p>
                {images && images.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {images.map((img) => (
                      <img
                        key={img.objectPath}
                        src={img.url}
                        alt="Prescription scan"
                        className="h-28 w-24 rounded-md border border-border object-cover"
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px] text-muted-foreground">
                    Quote
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDraft((r) => [...r, emptyRow()])}
                      disabled={draft.length >= 50}
                    >
                      <Plus className="size-3.5" /> Add item
                    </Button>
                    <ComponentHelp id="add-item-button" />
                  </div>
                </div>

                <div className="space-y-2">
                  {draft.map((row, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1.5">
                      <Input
                        className="col-span-4 h-8 text-[12px]"
                        placeholder="Item"
                        value={row.name}
                        onChange={(e) => setRow(i, { name: e.target.value })}
                      />
                      <Input
                        className="col-span-1 h-8 text-[12px]"
                        placeholder="Qty"
                        inputMode="numeric"
                        value={row.qty}
                        onChange={(e) => setRow(i, { qty: e.target.value })}
                      />
                      <Input
                        className="col-span-2 h-8 text-[12px]"
                        placeholder="MRP"
                        inputMode="decimal"
                        value={row.mrp}
                        onChange={(e) => setRow(i, { mrp: e.target.value })}
                      />
                      <Input
                        className="col-span-2 h-8 text-[12px]"
                        placeholder="Price"
                        inputMode="decimal"
                        value={row.price}
                        onChange={(e) => setRow(i, { price: e.target.value })}
                      />
                      <Input
                        className="col-span-2 h-8 text-[12px]"
                        placeholder="Disc ₹"
                        inputMode="decimal"
                        value={row.discount}
                        onChange={(e) => setRow(i, { discount: e.target.value })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="col-span-1 h-8 w-8 text-destructive"
                        aria-label="Remove item"
                        onClick={() =>
                          setDraft((r) =>
                            r.length > 1 ? r.filter((_, j) => j !== i) : [emptyRow()],
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-2 text-[13px]">
                  <span className="text-muted-foreground">Quote total</span>
                  <span className="font-medium">{formatINR(draftTotalPaisa)}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={saveQuote}>
                      Save quote
                    </Button>
                    <ComponentHelp id="save-quote-button" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" onClick={markReady} disabled={draftTotalPaisa <= 0}>
                      Mark READY
                    </Button>
                    <ComponentHelp id="mark-ready-button" />
                  </div>
                </div>
              </div>

              {revealed ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-warning">
                    <ShieldAlert className="size-4" /> PII revealed (audited)
                  </p>
                  <p className="mt-1 text-[13px]">
                    {selected.customerPhone || "Phone unavailable"} ·{" "}
                    {selected.customerAddress || "Address unavailable"}
                  </p>
                  {selected.revealedAt ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Revealed {formatDateTime(selected.revealedAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={selected.status !== "RECEIVED" && selected.status !== "QUOTED"}
                    onClick={() => advance(selected.prescriptionId, "PROCESSING")}
                  >
                    Process
                  </Button>
                  <ComponentHelp id="process-button" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    disabled={selected.status !== "READY"}
                    onClick={() => advance(selected.prescriptionId, "FULFILLED")}
                  >
                    Fulfil
                  </Button>
                  <ComponentHelp id="fulfil-button" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={selected.status === "FULFILLED" || selected.status === "CANCELLED"}
                    onClick={() => advance(selected.prescriptionId, "CANCELLED")}
                  >
                    Cancel
                  </Button>
                  <ComponentHelp id="cancel-button" />
                </div>
              </div>

              {selected.history && selected.history.length > 0 ? (
                <div>
                  <Label className="text-[12px] text-muted-foreground">
                    Audit trail
                  </Label>
                  <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
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
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default SellerPrescriptions;
