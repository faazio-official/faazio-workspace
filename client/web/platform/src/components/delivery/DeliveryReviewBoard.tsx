"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatDate } from "@/lib/format";
import { fetchPrivateDocumentUrl } from "@/lib/api";
import { remoteConfigured } from "@/lib/config";
import {
  activateDeliveryPartner,
  approveDeliveryProfile,
  blacklistDeliveryPartner,
  getDeliveryApplication,
  getDeliveryRiderLocation,
  listDeliveryApplications,
  listDeliveryRiders,
  rejectDeliveryApplication,
  requestDeliveryReupload,
  suspendDeliveryPartner,
  verifyDeliveryDocument,
  type DeliveryBoyLocation,
  type DeliveryDetail,
  type DeliveryRider,
  type DeliveryStatus,
} from "@/lib/api/delivery";

type Scope = "SUPER" | "STATE";
type Tab = "APPLICATIONS" | "RIDERS";

const APPLICATION_STATUSES: (DeliveryStatus | "ALL")[] = [
  "ALL",
  "PENDING_REVIEW",
  "VERIFIED",
  "ACTIVE",
  "REJECTED",
];

const vehicleLabel = (v: string) => v.replace(/_/g, " ").toLowerCase();

export function DeliveryReviewBoard({ scope }: { scope: Scope }) {
  const [tab, setTab] = useState<Tab>("APPLICATIONS");
  const [status, setStatus] = useState<DeliveryStatus | "ALL">("PENDING_REVIEW");
  const [query, setQuery] = useState("");
  const [applications, setApplications] = useState<DeliveryRider[]>([]);
  const [riders, setRiders] = useState<DeliveryRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<DeliveryBoyLocation | null>(null);

  const load = useCallback(async () => {
    if (!remoteConfigured()) {
      setApplications([]);
      setRiders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [apps, active] = await Promise.all([
        listDeliveryApplications({ status }),
        listDeliveryRiders({ status: "ACTIVE" }),
      ]);
      setApplications(apps);
      setRiders(active);
    } catch (err) {
      toast.error("Could not load delivery partners", {
        description: err instanceof Error ? err.message : "The gateway rejected the request.",
      });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const list = tab === "APPLICATIONS" ? applications : riders;
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.stateCode.toLowerCase() === q ||
        (r.phone ?? "").includes(q),
    );
  }, [applications, query, riders, tab]);

  const openDetail = useCallback(async (id: string) => {
    setBusy(true);
    setReason("");
    setLocation(null);
    try {
      setDetail(await getDeliveryApplication(id));
      setDetailOpen(true);
    } catch (err) {
      toast.error("Could not open this application", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const run = useCallback(
    async (label: string, action: () => Promise<DeliveryDetail | void>) => {
      setBusy(true);
      try {
        const next = await action();
        if (next) setDetail(next);
        toast.success(label);
        await load();
      } catch (err) {
        toast.error(`${label} failed`, {
          description: err instanceof Error ? err.message : "The gateway rejected the change.",
        });
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const openDocument = useCallback(async (assetId?: string, fileKey?: string) => {
    try {
      const url = assetId ? await fetchPrivateDocumentUrl(assetId) : null;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else
        toast.error("No downloadable file for this document", {
          description: fileKey ? `Private key: ${fileKey}` : undefined,
        });
    } catch {
      toast.error("Could not create a private document link");
    }
  }, []);

  const viewLocation = useCallback(async (id: string) => {
    try {
      const next = await getDeliveryRiderLocation(id);
      setLocation(next);
      if (next.source === "none")
        toast.info("No recent location", { description: "The rider has not sent a heartbeat." });
    } catch (err) {
      toast.error("Could not read the live location", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Delivery partners"
        description={
          scope === "SUPER"
            ? "All-India rider KYC, activation and live availability. State admins are scoped to their own state."
            : "Review rider KYC and monitor available partners in your state."
        }
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <FilterChip
            label="Applications"
            active={tab === "APPLICATIONS"}
            onClick={() => setTab("APPLICATIONS")}
          />
          <FilterChip
            label="Active riders"
            active={tab === "RIDERS"}
            onClick={() => setTab("RIDERS")}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone or state"
            className="h-9 w-56"
          />
          {tab === "APPLICATIONS"
            ? APPLICATION_STATUSES.map((option) => (
                <FilterChip
                  key={option}
                  label={option === "ALL" ? "All" : option.replace(/_/g, " ")}
                  active={status === option}
                  onClick={() => setStatus(option)}
                />
              ))
            : null}
        </div>

        <DataShell
          loading={loading}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title={tab === "APPLICATIONS" ? "No applications match" : "No active riders"}
              description={
                remoteConfigured()
                  ? "Clear the filters, or wait for a new application to arrive."
                  : "Set GATEWAY_URL to connect the portal to the delivery API."
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rider</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                {tab === "RIDERS" ? <TableHead className="text-right">Load</TableHead> : null}
                <TableHead>Applied</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rider) => (
                <TableRow key={rider.riderId} className="h-12">
                  <TableCell className="text-[13px] font-medium">
                    <button
                      className="text-primary hover:underline"
                      onClick={() => void openDetail(rider.riderId)}
                    >
                      {rider.fullName || rider.riderId}
                    </button>
                    <p className="text-[11px] text-muted-foreground">
                      {rider.hubZone || rider.city}
                    </p>
                  </TableCell>
                  <TableCell className="num text-[12px]">{rider.phone ?? "—"}</TableCell>
                  <TableCell className="num text-[13px] font-semibold">{rider.stateCode}</TableCell>
                  <TableCell className="text-[12px] capitalize">
                    {vehicleLabel(rider.vehicleType)}
                  </TableCell>
                  <TableCell className="num text-right">{rider.maxCapacity}</TableCell>
                  {tab === "RIDERS" ? (
                    <TableCell className="num text-right">{rider.currentLoad}</TableCell>
                  ) : null}
                  <TableCell className="num text-[12px]">{formatDate(rider.createdAt)}</TableCell>
                  <TableCell>
                    <StatusPill status={rider.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void openDetail(rider.riderId)}
                      >
                        Review
                      </Button>
                      {tab === "RIDERS" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void viewLocation(rider.riderId)}
                        >
                          Location
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.fullName || "Application"}</DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.phone ?? ""} · ${detail.city}, ${detail.stateCode} · ${vehicleLabel(detail.vehicleType)} · capacity ${detail.maxCapacity}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={detail.status} />
                <span className="text-[12px] text-muted-foreground">
                  Hub: {detail.hubZone || "—"}
                </span>
                <span className="text-[12px] text-muted-foreground">PIN: {detail.pincode}</span>
                <span className="text-[12px] text-muted-foreground">
                  Emergency: {detail.emergencyContact || "—"}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground">Address: {detail.address || "—"}</p>

              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  KYC documents
                </p>
                <ul className="space-y-2">
                  {detail.documents.map((doc) => (
                    <li
                      key={doc.docId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <p className="text-[13px] font-medium">{doc.docType.replace(/_/g, " ")}</p>
                        <p className="num text-[11px] text-muted-foreground">
                          {doc.assetId ?? doc.fileKey}
                        </p>
                        {doc.rejectionReason ? (
                          <p className="text-[11px] text-destructive">{doc.rejectionReason}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusPill status={doc.status} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void openDocument(doc.assetId, doc.fileKey)}
                        >
                          View
                        </Button>
                        {doc.status !== "VERIFIED" ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void run(`${doc.docType} verified`, () =>
                                verifyDeliveryDocument(detail.riderId, doc.docType),
                              )
                            }
                          >
                            Verify
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            const note = window.prompt(
                              "Reason for re-upload (sent to the rider):",
                              "Blurry or unreadable",
                            );
                            if (note) {
                              void run(`${doc.docType} re-upload requested`, () =>
                                requestDeliveryReupload(detail.riderId, doc.docType, note),
                              );
                            }
                          }}
                        >
                          Re-upload
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {detail.bankAccount ? (
                <div className="rounded-lg border border-border p-3 text-[12px]">
                  <p className="mb-1 font-semibold">Payout account (pending review)</p>
                  <p className="text-muted-foreground">
                    {detail.bankAccount.accountName} · {detail.bankAccount.accountNumberMasked} ·{" "}
                    {detail.bankAccount.ifsc}
                  </p>
                  <StatusPill status={detail.bankAccount.status} />
                </div>
              ) : null}

              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required to reject / suspend)"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run("Profile approved", () => approveDeliveryProfile(detail.riderId))
                  }
                >
                  Approve profile
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy || reason.trim().length < 4}
                  onClick={() =>
                    void run("Application rejected", () =>
                      rejectDeliveryApplication(detail.riderId, reason.trim()),
                    )
                  }
                >
                  Reject
                </Button>
                {scope === "SUPER" ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run("Rider activated", () => activateDeliveryPartner(detail.riderId))
                    }
                  >
                    Activate
                  </Button>
                ) : null}
                {detail.status === "ACTIVE" || detail.status === "SUSPENDED" ? (
                  <Button
                    variant="outline"
                    disabled={busy || reason.trim().length < 4}
                    onClick={() =>
                      void run("Rider suspended", () =>
                        suspendDeliveryPartner(detail.riderId, reason.trim()),
                      )
                    }
                  >
                    Suspend
                  </Button>
                ) : null}
                {scope === "SUPER" && detail.status !== "BLACKLISTED" ? (
                  <Button
                    variant="destructive"
                    disabled={busy || reason.trim().length < 4}
                    onClick={() =>
                      void run("Rider blacklisted", () =>
                        blacklistDeliveryPartner(detail.riderId, reason.trim()),
                      )
                    }
                  >
                    Blacklist
                  </Button>
                ) : null}
                {location ? (
                  <span className="text-[12px] text-muted-foreground">
                    {location.source === "none"
                      ? "No location"
                      : `${location.latitude?.toFixed(5)}, ${location.longitude?.toFixed(5)} (${location.source})`}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
