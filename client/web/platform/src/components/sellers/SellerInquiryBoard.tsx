"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, MapPin, Phone, Mail, Percent, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { StatusPill } from "@/components/patterns/Pills";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { assignSellerInquiry, listSellerInquiries, updateSellerInquiry } from "@/lib/api";
import { useSession } from "@/lib/hooks/useSession";
import { useDistricts } from "@/lib/api/hooks";
import { districtName } from "@/lib/api/reference";
import { ApiError } from "@/lib/api/http";
import type { InquiryStage, SellerRecord } from "@/data/types";

const STAGES: (InquiryStage | "ALL")[] = ["NEW", "CONTACTED", "APPROVED", "REJECTED", "ALL"];

/** Ownership filter: everything, only my call-backs, or only enquiries nobody has taken. */
const OWNERSHIP = [
  { value: "ALL", label: "Everyone" },
  { value: "me", label: "Mine" },
  { value: "unassigned", label: "Unclaimed" },
] as const;
type OwnershipFilter = (typeof OWNERSHIP)[number]["value"];

/**
 * Landing-page "Sell with us" follow-up queue.
 *
 * An enquiry is a `sellers.sellers` row with status INQUIRY, so the canonical record lives on the
 * seller detail page — this board only triages the call-back. `scope="district"` narrows the display;
 * the gateway already scopes a district admin to their own district and lets a super admin see every
 * district, so the client filter can never widen what the server returned.
 *
 * The decision here is PENDING_REVIEW ("proceeding — complete KYC in the app") or REJECTED. It is
 * never ACTIVE: an enquiry has no KYC documents, so the gateway refuses that transition.
 */
export function SellerInquiryBoard({ scope }: { scope: "district" | "global" }) {
  const session = useSession();
  const districts = useDistricts();
  const [stage, setStage] = useState<InquiryStage | "ALL">("NEW");
  const [ownership, setOwnership] = useState<OwnershipFilter>("ALL");
  const [district, setDistrict] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SellerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<SellerRecord | null>(null);
  const [note, setNote] = useState("");
  const [dialogError, setDialogError] = useState("");

  const detailHref = (sellerId: string) =>
    scope === "district"
      ? `/admin/district/sellers/${sellerId}`
      : `/admin/super/sellers/${sellerId}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(
        await listSellerInquiries({
          stage,
          districtCode: scope === "district" ? (session?.districtCode ?? undefined) : district || undefined,
          query: query.trim() || undefined,
          assigned: ownership === "ALL" ? undefined : ownership,
        }),
      );
    } catch {
      toast.error("Could not load seller enquiries");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, session?.districtCode, stage, district, query, ownership]);

  useEffect(() => {
    void load();
  }, [load]);

  const newCount = useMemo(() => rows.filter((r) => r.inquiryStage === "NEW").length, [rows]);

  async function claim(row: SellerRecord, take: boolean) {
    setBusy(row.sellerId);
    try {
      const updated = await assignSellerInquiry(row.sellerId, take);
      toast.success(take ? `You have ${row.businessName}` : `Released ${row.businessName}`);
      if (selected?.sellerId === row.sellerId) setSelected(updated);
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Another admin already claimed this enquiry", {
          description: "The queue has been refreshed with their claim.",
        });
        await load();
        return;
      }
      toast.error(error instanceof ApiError ? error.message : "Could not update the enquiry");
    } finally {
      setBusy(null);
    }
  }

  async function move(row: SellerRecord, next: InquiryStage) {
    setBusy(row.sellerId);
    try {
      await updateSellerInquiry(row.sellerId, { stage: next });
      toast.success(`${row.businessName} → ${next.toLowerCase()}`);
      setSelected(null);
      setDialogError("");
      await load();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Could not update the enquiry";
      if (selected) setDialogError(message);
      else toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function decide(row: SellerRecord, status: "PENDING_REVIEW" | "REJECTED") {
    setBusy(row.sellerId);
    try {
      await updateSellerInquiry(row.sellerId, {
        status,
        stage: status === "REJECTED" ? "REJECTED" : "APPROVED",
        reason: status === "REJECTED" ? note : undefined,
      });
      toast.success(
        status === "REJECTED"
          ? `${row.businessName} rejected`
          : `${row.businessName} is proceeding — KYC now happens in the app`,
      );
      setSelected(null);
      setNote("");
      setDialogError("");
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Another admin already decided this enquiry", {
          description: "The queue has been refreshed with their decision.",
        });
        setSelected(null);
        await load();
        return;
      }
      const message = error instanceof ApiError ? error.message : "Could not update the enquiry";
      if (selected) setDialogError(message);
      else toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  function openInquiry(row: SellerRecord) {
    setSelected(row);
    setNote(row.inquiryNotes ?? "");
    setDialogError("");
  }

  const scopeDescription =
    scope === "district"
      ? `Enquiries from the landing page in ${districtName(districts, session?.districtCode ?? "") || "your district"}.`
      : "Enquiries from the landing page across every district.";

  return (
    <div className="space-y-4">
      <PageHeader title="Seller enquiries" description={scopeDescription} />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {STAGES.map((option) => (
            <FilterChip
              key={option}
              label={option === "ALL" ? "All" : option.charAt(0) + option.slice(1).toLowerCase()}
              active={stage === option}
              onClick={() => setStage(option)}
            />
          ))}
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          {OWNERSHIP.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              active={ownership === option.value}
              onClick={() => setOwnership(option.value)}
            />
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {scope === "global" ? (
              <select
                aria-label="Filter by district"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                className="focus-ringed h-8 rounded-md border border-border bg-card px-2 text-[12px]"
              >
                <option value="">All districts</option>
                {districts.map((d) => (
                  <option key={d.districtCode} value={d.districtCode}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Input
              aria-label="Search enquiries"
              placeholder="Shop, owner, phone or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 w-[15rem] text-[12px]"
            />
          </div>
        </div>

        <DataShell
          loading={loading}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title={stage === "NEW" ? "No new enquiries" : "No enquiries here"}
              description={
                stage === "NEW"
                  ? "New enquiries from the landing page land here. Nothing to call back yet."
                  : "No enquiries match this filter."
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Actions
                    <ComponentHelp
                      helpKey="pattern:seller-inquiry-followup"
                      label="About following up a seller enquiry"
                    />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.sellerId} className="h-12">
                  <TableCell className="text-[13px] font-medium">
                    <Link href={detailHref(row.sellerId)} className="text-primary hover:underline">
                      {row.businessName}
                    </Link>
                    <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                      {row.inquiryCategory ?? "—"} · {row.ownerName}
                    </p>
                    {row.shopPhotos?.length ? (
                      <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                        {row.shopPhotos.length} shop photo{row.shopPhotos.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3" aria-hidden />
                      {row.contactPhone}
                    </span>
                    <p className="mt-0.5 inline-flex items-center gap-1.5">
                      <Mail className="size-3" aria-hidden />
                      {row.contactEmail ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {row.districtCode ? districtName(districts, row.districtCode) || row.districtCode : "—"}
                  </TableCell>
                  <TableCell className="num text-[12px]">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {row.inquiryAssignedTo ? (
                      row.inquiryAssignedTo === session?.accountId ? (
                        <span className="text-foreground">You</span>
                      ) : (
                        row.inquiryAssignedTo
                      )
                    ) : (
                      "Unclaimed"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={row.inquiryStage ?? "NEW"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => openInquiry(row)}>
                        Open
                      </Button>
                      {!row.inquiryAssignedTo ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === row.sellerId}
                          onClick={() => void claim(row, true)}
                        >
                          Claim
                        </Button>
                      ) : null}
                      {row.inquiryStage === "NEW" ? (
                        <Button
                          size="sm"
                          disabled={busy === row.sellerId}
                          onClick={() => void move(row, "CONTACTED")}
                        >
                          Mark contacted
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
        {newCount > 0 && stage !== "NEW" ? (
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            {newCount} new in this view.
          </p>
        ) : null}
      </SectionCard>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.businessName}</DialogTitle>
                <DialogDescription>
                  {selected.ownerName} · {selected.inquiryCategory ?? "—"} ·{" "}
                  {formatDateTime(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-[13px]">
                {selected.shopPhotos?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {selected.shopPhotos.map((photo) =>
                      photo.url ? (
                        // A raw <img> is deliberate: these are R2-hosted public URLs, already AVIF and
                        // sized by the gateway, so the Next image optimizer would only add a hop.
                        <img
                          key={photo.assetId}
                          src={photo.url}
                          alt={`${selected.businessName} shop front`}
                          className="size-20 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <span
                          key={photo.assetId}
                          className="flex size-20 items-center justify-center rounded-md border border-border bg-muted text-[10px] text-muted-foreground"
                        >
                          no preview
                        </span>
                      ),
                    )}
                  </div>
                ) : null}

                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>{selected.businessAddress || "No address given"}</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Percent className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    Expected platform fee:{" "}
                    <span className="font-medium text-foreground">
                      {selected.inquiryPlatformFeePct != null
                        ? `${selected.inquiryPlatformFeePct}%`
                        : "not given"}
                    </span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                  <a
                    href={`tel:${selected.contactPhone}`}
                    className="focus-ringed inline-flex items-center gap-1.5 underline"
                  >
                    <Phone className="size-3.5" aria-hidden />
                    {selected.contactPhone}
                  </a>
                  {selected.contactEmail ? (
                    <a
                      href={`mailto:${selected.contactEmail}`}
                      className="focus-ringed inline-flex items-center gap-1.5 underline"
                    >
                      <Mail className="size-3.5" aria-hidden />
                      {selected.contactEmail}
                    </a>
                  ) : null}
                </div>

                <Link
                  href={detailHref(selected.sellerId)}
                  className="focus-ringed inline-flex items-center gap-1.5 text-[12px] text-primary underline"
                >
                  <ArrowUpRight className="size-3" aria-hidden />
                  Open the full record
                </Link>

                {selected.inquiryNotes ? (
                  <div className="rounded-md border border-border bg-muted/40 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      What they wrote
                    </p>
                    <p className="mt-1 text-[12px]">{selected.inquiryNotes}</p>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="inquiry-note" className="text-[12px]">
                    Rejection reason (required to reject)
                  </Label>
                  <Textarea
                    id="inquiry-note"
                    value={note}
                    maxLength={500}
                    rows={3}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="What the call established, or why this enquiry is not a fit."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {note.length}/500 · shown to the merchant when rejecting, never public.
                  </p>
                </div>

                {dialogError ? (
                  <p role="alert" className="text-[12px] text-destructive">
                    {dialogError}
                  </p>
                ) : null}

                {selected.status !== "INQUIRY" ? (
                  <p className="rounded-md border border-success/40 bg-success/10 px-2.5 py-2 text-[12px]">
                    Decided — this is now a{" "}
                    <span className="font-medium">{selected.status.replace("_", " ").toLowerCase()}</span>{" "}
                    seller record. Work it in Sellers.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                  <span>
                    {selected.inquiryAssignedTo
                      ? selected.inquiryAssignedTo === session?.accountId
                        ? "You own this call-back"
                        : `Owned by ${selected.inquiryAssignedTo}`
                      : "Nobody has claimed this enquiry"}
                    {selected.inquiryAssignedAt
                      ? ` · since ${formatDateTime(selected.inquiryAssignedAt)}`
                      : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === selected.sellerId}
                    onClick={() => void claim(selected, !selected.inquiryAssignedTo)}
                  >
                    {selected.inquiryAssignedTo === session?.accountId ? "Release" : "Claim"}
                  </Button>
                </div>
              </div>

              {selected.status === "INQUIRY" ? (
                <div className="flex flex-wrap justify-end gap-2">
                  {selected.inquiryStage !== "CONTACTED" ? (
                    <Button
                      variant="outline"
                      disabled={busy === selected.sellerId}
                      onClick={() => void move(selected, "CONTACTED")}
                    >
                      Mark contacted
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy === selected.sellerId}
                    onClick={() => void decide(selected, "PENDING_REVIEW")}
                  >
                    Proceeding — open application
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy === selected.sellerId || note.trim().length < 4}
                    onClick={() => void decide(selected, "REJECTED")}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
