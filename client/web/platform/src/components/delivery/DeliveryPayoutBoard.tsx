"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatINR, parseRupeesToPaisa } from "@/lib/format";
import { remoteConfigured } from "@/lib/config";
import { DISTRICTS, districtName } from "@/data/districts";
import { useSession } from "@/lib/hooks/useSession";
import {
  listAdminDeliveryPayouts,
  recordDeliveryManualFare,
  settleDeliveryPayout,
  updateDeliveryPayoutMode,
  type AdminDeliveryPayout,
  type DeliveryPayoutMode,
} from "@/lib/api/delivery";

type Scope = "SUPER" | "DISTRICT";

export function DeliveryPayoutBoard({ scope }: { scope: Scope }) {
  const session = useSession();
  const [payouts, setPayouts] = useState<AdminDeliveryPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState(
    scope === "DISTRICT" ? (session?.districtCode ?? "") : "",
  );
  const [mode, setMode] = useState("ALL");
  const [status, setStatus] = useState("PENDING");
  const [riderId, setRiderId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [selected, setSelected] = useState<AdminDeliveryPayout | null>(null);
  const [nextMode, setNextMode] = useState<DeliveryPayoutMode>("AUTOMATED");
  const [distanceKm, setDistanceKm] = useState("");
  const [fareRupees, setFareRupees] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!remoteConfigured()) {
      setPayouts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await listAdminDeliveryPayouts({
        district: scope === "SUPER" ? district || undefined : undefined,
        mode: mode === "ALL" ? undefined : mode,
        status: status === "ALL" ? undefined : status,
        riderId: riderId.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setPayouts(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The gateway rejected the request.");
    } finally {
      setLoading(false);
    }
  }, [district, from, mode, riderId, scope, status, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = useCallback((payout: AdminDeliveryPayout) => {
    setSelected(payout);
    setNextMode(payout.payoutMode);
    setDistanceKm(
      payout.manualDistanceKm != null
        ? String(payout.manualDistanceKm)
        : payout.distanceKm
          ? String(payout.distanceKm)
          : "",
    );
    setFareRupees(
      payout.manualFarePaisa != null ? String(payout.manualFarePaisa / 100) : "",
    );
    setReason(payout.fareOverrideReason ?? "");
  }, []);

  const submit = useCallback(
    async (markPaid: boolean) => {
      if (!selected) return;
      const km = Number(distanceKm);
      if (nextMode === "MANUAL" && (!Number.isFinite(km) || km <= 0)) {
        toast.error("Enter the travelled distance in kilometres");
        return;
      }
      setBusy(true);
      try {
        if (nextMode !== selected.payoutMode) {
          await updateDeliveryPayoutMode(selected.orderId, nextMode);
        }
        if (nextMode === "MANUAL") {
          await recordDeliveryManualFare(selected.orderId, {
            distanceKm: km,
            farePaisa: fareRupees.trim() ? parseRupeesToPaisa(fareRupees) : undefined,
            reason: reason.trim(),
          });
        }
        if (markPaid) {
          await settleDeliveryPayout(selected.orderId);
          toast.success("Payout marked paid");
        } else {
          toast.success("Payout details saved");
        }
        setSelected(null);
        await load();
      } catch (err) {
        toast.error(markPaid ? "Could not mark paid" : "Could not save payout", {
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setBusy(false);
      }
    },
    [distanceKm, fareRupees, load, nextMode, reason, selected],
  );

  const totals = useMemo(() => {
    let pending = 0;
    let paid = 0;
    for (const p of payouts) {
      if (p.status === "PAID") paid += p.totalPaisa;
      else pending += p.totalPaisa;
    }
    return { pending, paid };
  }, [payouts]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Delivery payouts"
        description="Settle automated and manual rider payouts. Mark Paid records the payment in the ledger only — no Razorpay transfer is initiated."
      />

      <div className="flex flex-wrap items-end gap-2">
        {scope === "SUPER" ? (
          <div className="space-y-1">
            <Label htmlFor="payout-district" className="text-[11px] text-muted-foreground">
              District
            </Label>
            <select
              id="payout-district"
              className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">All districts</option>
              {DISTRICTS.map((d) => (
                <option key={d.districtCode} value={d.districtCode}>
                  {d.name} ({d.districtCode})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="payout-mode" className="text-[11px] text-muted-foreground">
            Mode
          </Label>
          <select
            id="payout-mode"
            className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="ALL">All modes</option>
            <option value="AUTOMATED">Automated</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="payout-status" className="text-[11px] text-muted-foreground">
            Status
          </Label>
          <select
            id="payout-status"
            className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="payout-rider" className="text-[11px] text-muted-foreground">
            Rider ID
          </Label>
          <Input
            id="payout-rider"
            className="h-9 w-40"
            placeholder="rider-…"
            value={riderId}
            onChange={(e) => setRiderId(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="payout-from" className="text-[11px] text-muted-foreground">
            From
          </Label>
          <Input
            id="payout-from"
            type="date"
            className="h-9 w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="payout-to" className="text-[11px] text-muted-foreground">
            To
          </Label>
          <Input
            id="payout-to"
            type="date"
            className="h-9 w-40"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        <span className="num ml-auto text-[12px] text-muted-foreground">
          Pending {formatINR(totals.pending)} · Paid {formatINR(totals.paid)}
        </span>
      </div>

      <SectionCard title="Settlement board" bodyClassName="p-0">
        <DataShell
          loading={loading}
          error={error}
          isEmpty={payouts.length === 0}
          empty={
            <EmptyState
              title="No payouts here"
              description="Completed deliveries in this scope will appear once they are ready to settle."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Rider</TableHead>
                <TableHead>District</TableHead>
                <TableHead className="text-right">Distance</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Calculated</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid at</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.orderId} className="h-12">
                  <TableCell className="num text-[12px] font-medium">
                    {payout.orderId}
                    <span className="block text-[11px] text-muted-foreground">
                      {payout.customerOrderId}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {payout.riderName}
                    <span className="num block text-[11px] text-muted-foreground">
                      {payout.riderId}
                    </span>
                  </TableCell>
                  <TableCell className="text-[12px]">
                    {payout.districtCode
                      ? `${payout.districtCode} · ${districtName(payout.districtCode)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="num text-right text-[12px]">
                    {payout.distanceKm.toFixed(1)} km
                  </TableCell>
                  <TableCell>
                    <StatusPill status={payout.payoutMode} />
                  </TableCell>
                  <TableCell className="num text-right text-[12px]">
                    {formatINR(payout.calculatedFarePaisa)}
                  </TableCell>
                  <TableCell className="num text-right text-[12px] font-semibold">
                    {formatINR(payout.totalPaisa)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={payout.status} />
                  </TableCell>
                  <TableCell className="num text-[12px]">
                    {payout.paidAt ? formatDateTime(payout.paidAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {payout.status === "PENDING" ? (
                      <Button size="sm" variant="outline" onClick={() => open(payout)}>
                        Manage
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Settled</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Settle payout</DialogTitle>
                <DialogDescription>
                  {selected.orderId} · {selected.riderName} ·{" "}
                  {selected.districtCode ? districtName(selected.districtCode) : "No district"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="settle-mode">Payout mode</Label>
                  <select
                    id="settle-mode"
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-[13px]"
                    value={nextMode}
                    onChange={(e) => setNextMode(e.target.value as DeliveryPayoutMode)}
                    disabled={busy}
                  >
                    <option value="AUTOMATED">AUTOMATED (rate card)</option>
                    <option value="MANUAL">MANUAL (admin fare)</option>
                  </select>
                </div>

                {nextMode === "MANUAL" ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="settle-distance">Travelled distance (km)</Label>
                        <Input
                          id="settle-distance"
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={distanceKm}
                          onChange={(e) => setDistanceKm(e.target.value)}
                          disabled={busy}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="settle-fare">Fare to pay (₹)</Label>
                        <Input
                          id="settle-fare"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Leave blank for rate-card fare"
                          value={fareRupees}
                          onChange={(e) => setFareRupees(e.target.value)}
                          disabled={busy}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="settle-reason">Override reason</Label>
                      <Textarea
                        id="settle-reason"
                        rows={2}
                        placeholder="Why does this fare differ from the rate card?"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </>
                ) : (
                  <p className="num rounded-lg border border-border p-3 text-[12px] text-muted-foreground">
                    System fare:{" "}
                    <span className="font-semibold text-foreground">
                      {formatINR(selected.calculatedFarePaisa)}
                    </span>
                    . Marking paid records this amount in the payout ledger.
                  </p>
                )}

                {selected.status === "PENDING" ? (
                  <p className="text-[11px] text-muted-foreground">
                    Mark Paid settles the rider in person. No Razorpay transfer is created.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void submit(false)}
                  disabled={busy || (nextMode === selected.payoutMode && nextMode !== "MANUAL")}
                >
                  Save details
                </Button>
                <Button onClick={() => void submit(true)} disabled={busy}>
                  {busy ? "Saving..." : "Mark Paid"}
                </Button>
                <ComponentHelp helpKey="pattern:payout-mark-paid" label="About marking a payout paid" />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
