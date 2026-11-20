"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, MapPin, Phone, Mail } from "lucide-react";
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
import { assignSellerLead, listSellerLeads, updateSellerLeadStatus } from "@/lib/api";
import { useSession } from "@/lib/hooks/useSession";
import { useDistricts } from "@/lib/api/hooks";
import { districtName } from "@/lib/api/reference";
import { ApiError } from "@/lib/api/http";
import type { SellerLead } from "@/data/types";

const STATUSES = ["NEW", "CONTACTED", "APPROVED", "REJECTED", "ALL"] as const;
type StatusFilter = (typeof STATUSES)[number];

/** Ownership filter: everything, only my call-backs, or only leads nobody has taken. */
const OWNERSHIP = [
  { value: "ALL", label: "Everyone" },
  { value: "me", label: "Mine" },
  { value: "unassigned", label: "Unclaimed" },
] as const;
type OwnershipFilter = (typeof OWNERSHIP)[number]["value"];

/** The next step offered for each status. REJECTED/APPROVED are terminal in this queue. */
const NEXT_ACTION: Record<string, { label: string; status: SellerLead["status"]; needsNote: boolean }> = {
  NEW: { label: "Mark contacted", status: "CONTACTED", needsNote: false },
  CONTACTED: { label: "Approve", status: "APPROVED", needsNote: false },
};

/**
 * Landing-page "Sell with us" follow-up queue. `scope="district"` only narrows the display; the
 * gateway already scopes a district admin to their own district and lets a super admin see every
 * district, so the client filter can never widen what the server returned.
 *
 * Approving a lead does NOT create a seller account — the merchant still applies in the app. That is
 * deliberate: an enquiry is a phone number on a landing page, not a verified business.
 */
export function SellerLeadsBoard({ scope }: { scope: "district" | "global" }) {
  const session = useSession();
  const districts = useDistricts();
  const [status, setStatus] = useState<StatusFilter>("NEW");
  const [ownership, setOwnership] = useState<OwnershipFilter>("ALL");
  const [district, setDistrict] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SellerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<SellerLead | null>(null);
  const [note, setNote] = useState("");
  const [dialogError, setDialogError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(
        await listSellerLeads({
          status: status === "ALL" ? undefined : status,
          districtCode: scope === "district" ? (session?.districtCode ?? undefined) : district || undefined,
          query: query.trim() || undefined,
          assigned: ownership === "ALL" ? undefined : ownership,
        }),
      );
    } catch {
      toast.error("Could not load seller leads");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, session?.districtCode, status, district, query, ownership]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === "NEW").length, [rows]);

  async function claim(row: SellerLead, take: boolean) {
    setBusy(row.leadId);
    try {
      const updated = await assignSellerLead(row.leadId, take);
      toast.success(take ? `You have ${row.businessName}` : `Released ${row.businessName}`);
      if (selected?.leadId === row.leadId) setSelected(updated);
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Another admin already claimed this lead", {
          description: "The queue has been refreshed with their claim.",
        });
        await load();
        return;
      }
      toast.error(error instanceof ApiError ? error.message : "Could not update the lead");
    } finally {
      setBusy(null);
    }
  }

  async function move(row: SellerLead, next: SellerLead["status"], reason = "") {
    setBusy(row.leadId);
    try {
      await updateSellerLeadStatus(row.leadId, next, reason);
      toast.success(`${row.businessName} → ${next.toLowerCase()}`);
      setSelected(null);
      setNote("");
      setDialogError("");
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error("Another admin already moved this lead", {
          description: "The queue has been refreshed with their decision.",
        });
        setSelected(null);
        await load();
        return;
      }
      const message = error instanceof ApiError ? error.message : "Could not update the lead";
      if (selected) setDialogError(message);
      else toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  function openLead(row: SellerLead) {
    setSelected(row);
    setNote(row.adminNote ?? "");
    setDialogError("");
  }

  const scopeDescription =
    scope === "district"
      ? `Enquiries from the landing page in ${districtName(districts, session?.districtCode ?? "") || "your district"}.`
      : "Enquiries from the landing page across every district.";

  return (
    <div className="space-y-4">
      <PageHeader title="Seller leads" description={scopeDescription} />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {STATUSES.map((option) => (
            <FilterChip
              key={option}
              label={option}
              active={status === option}
              onClick={() => setStatus(option)}
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
              aria-label="Search leads"
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
              title={status === "NEW" ? "No new leads" : "No leads here"}
              description={
                status === "NEW"
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Actions
                    <ComponentHelp
                      helpKey="pattern:seller-lead-followup"
                      label="About following up a seller lead"
                    />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.leadId} className="h-12">
                  <TableCell className="text-[13px] font-medium">
                    {row.businessName}
                    <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                      {row.category} · {row.ownerName}
                    </p>
                    {row.sellerId ? (
                      <p className="mt-0.5 text-[11px] font-normal text-success">
                        Applied · {row.sellerId}
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
                      {row.contactEmail}
                    </p>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {row.districtCode
                      ? districtName(districts, row.districtCode) || row.districtCode
                      : (row.districtName ?? "—")}
                  </TableCell>
                  <TableCell className="num text-[12px]">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {row.assignedTo ? (
                      row.assignedTo === session?.accountId ? (
                        <span className="text-foreground">You</span>
                      ) : (
                        row.assignedTo
                      )
                    ) : (
                      "Unclaimed"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => openLead(row)}>
                        Open
                      </Button>
                      {!row.assignedTo ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === row.leadId}
                          onClick={() => void claim(row, true)}
                        >
                          Claim
                        </Button>
                      ) : null}
                      {NEXT_ACTION[row.status] ? (
                        <Button
                          size="sm"
                          disabled={busy === row.leadId}
                          onClick={() =>
                            void move(row, NEXT_ACTION[row.status]!.status)
                          }
                        >
                          {NEXT_ACTION[row.status]!.label}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
        {pendingCount > 0 && status !== "NEW" ? (
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            {pendingCount} new in this view.
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
                  {selected.ownerName} · {selected.category} ·{" "}
                  {formatDateTime(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-[13px]">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    {selected.businessAddress}
                    {selected.districtName ? `, ${selected.districtName}` : ""}
                    {selected.stateName ? `, ${selected.stateName}` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                  <a href={`tel:${selected.contactPhone}`} className="focus-ringed inline-flex items-center gap-1.5 underline">
                    <Phone className="size-3.5" aria-hidden />
                    {selected.contactPhone}
                  </a>
                  <a href={`mailto:${selected.contactEmail}`} className="focus-ringed inline-flex items-center gap-1.5 underline">
                    <Mail className="size-3.5" aria-hidden />
                    {selected.contactEmail}
                  </a>
                </div>

                {selected.latitude != null && selected.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="focus-ringed inline-flex items-center gap-1.5 text-[12px] text-primary underline"
                  >
                    <ExternalLink className="size-3" aria-hidden />
                    Open the pinned shop location
                  </a>
                ) : (
                  <p className="text-[12px] text-muted-foreground">
                    No pin — the merchant typed the address. Confirm it on the call.
                  </p>
                )}

                {selected.notes ? (
                  <div className="rounded-md border border-border bg-muted/40 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      What they wrote
                    </p>
                    <p className="mt-1 text-[12px]">{selected.notes}</p>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="lead-note" className="text-[12px]">
                    Follow-up note {selected.status === "REJECTED" ? "(required)" : "(optional)"}
                  </Label>
                  <Textarea
                    id="lead-note"
                    value={note}
                    maxLength={500}
                    rows={3}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="What the call established, or why this lead is not a fit."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {note.length}/500 · only the review record, never shown publicly.
                  </p>
                </div>

                {dialogError ? (
                  <p role="alert" className="text-[12px] text-destructive">
                    {dialogError}
                  </p>
                ) : null}

                {selected.sellerId ? (
                  <p className="rounded-md border border-success/40 bg-success/10 px-2.5 py-2 text-[12px]">
                    Applied as <span className="num font-medium">{selected.sellerId}</span> — this
                    enquiry is closed; work the application in Sellers.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                  <span>
                    {selected.assignedTo
                      ? selected.assignedTo === session?.accountId
                        ? "You own this call-back"
                        : `Owned by ${selected.assignedTo}`
                      : "Nobody has claimed this lead"}
                    {selected.reviewedBy
                      ? ` · last moved by ${selected.reviewedBy}${selected.reviewedAt ? ` on ${formatDateTime(selected.reviewedAt)}` : ""}`
                      : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === selected.leadId}
                    onClick={() => void claim(selected, !selected.assignedTo)}
                  >
                    {selected.assignedTo === session?.accountId ? "Release" : "Claim"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                {selected.status !== "CONTACTED" && selected.status !== "REJECTED" ? (
                  <Button
                    variant="outline"
                    disabled={busy === selected.leadId}
                    onClick={() => void move(selected, "CONTACTED", note)}
                  >
                    Mark contacted
                  </Button>
                ) : null}
                {selected.status !== "APPROVED" ? (
                  <Button
                    disabled={busy === selected.leadId}
                    onClick={() => void move(selected, "APPROVED", note)}
                  >
                    Approve
                  </Button>
                ) : null}
                {selected.status !== "REJECTED" ? (
                  <Button
                    variant="destructive"
                    disabled={busy === selected.leadId || note.trim().length < 4}
                    onClick={() => void move(selected, "REJECTED", note)}
                  >
                    Reject
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
