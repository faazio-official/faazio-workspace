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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { remoteConfigured } from "@/lib/config";
import { districtName } from "@/lib/api/reference";
import { useDistricts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import {
  listSellerPayouts,
  markSellerPayoutPaid,
  getPayoutInvoice,
  type SellerPayoutSummary,
} from "@/lib/api";

/** Manual seller payout board (migration 0077): server-computed owed amounts with balance
 * carry-forward. A super admin marks a payout paid by typing the actual amount. */
export function SellerPayoutBoard({ scope }: { scope: "SUPER" | "STATE" }) {
  const session = useSession();
  const districts = useDistricts();
  const [rows, setRows] = useState<SellerPayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState("");

  const [selected, setSelected] = useState<SellerPayoutSummary | null>(null);
  const [amountRupees, setAmountRupees] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!remoteConfigured()) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const filter: { state?: string; district?: string } = {};
      if (scope === "SUPER") {
        if (district) filter.district = district;
      } else if (session?.stateCode) {
        filter.state = session.stateCode;
      }
      const items = await listSellerPayouts(filter);
      setRows(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The gateway rejected the request.");
    } finally {
      setLoading(false);
    }
  }, [district, scope, session?.stateCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = useCallback((row: SellerPayoutSummary) => {
    setSelected(row);
    setAmountRupees(row.balancePaisa > 0 ? String((row.balancePaisa / 100).toFixed(0)) : "");
  }, []);

  const submit = useCallback(async () => {
    if (!selected) return;
    const paisa = parseRupeesToPaisa(amountRupees);
    if (!Number.isFinite(paisa) || paisa <= 0) {
      toast.error("Enter a positive amount in rupees");
      return;
    }
    if (paisa > selected.balancePaisa) {
      toast.error("Amount cannot exceed the balance owed");
      return;
    }
    setBusy(true);
    try {
      await markSellerPayoutPaid(selected.sellerId, { cycle: selected.cycle, amountPaisa: paisa });
      toast.success("Payout marked paid");
      setSelected(null);
      await load();
    } catch (err) {
      toast.error("Could not mark the payout paid", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [amountRupees, load, selected]);

  const totals = useMemo(() => {
    let owed = 0;
    let paid = 0;
    for (const r of rows) {
      owed += r.balancePaisa;
      paid += r.paidPaisa;
    }
    return { owed, paid };
  }, [rows]);

  /** Download the separate payout invoice (0078) for a payout row as a JSON settlement document. */
  const downloadInvoice = useCallback(async (row: SellerPayoutSummary) => {
    if (!row.payoutId) return;
    try {
      const invoices = await getPayoutInvoice(row.payoutId);
      if (!invoices.length) throw new Error("No payout invoice found for this payout");
      const blob = new Blob([JSON.stringify(invoices, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payout-invoice-${row.payoutId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Payout invoice downloaded");
    } catch (err) {
      toast.error("Could not download the payout invoice", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Seller payouts"
        description="Server-computed seller earnings per cycle (gross − commission − TCS − TDS) with manual 'Mark as Paid'. Balance carries forward when a partial amount is paid."
      />

      <div className="flex flex-wrap items-end gap-2">
        {scope === "SUPER" ? (
          <div className="space-y-1">
            <Label htmlFor="seller-district" className="text-[11px] text-muted-foreground">
              District
            </Label>
            <select
              id="seller-district"
              className="h-9 rounded-md border border-border bg-background px-3 text-[13px]"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d.districtCode} value={d.districtCode}>
                  {d.name} ({d.districtCode})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        <span className="num ml-auto text-[12px] text-muted-foreground">
          Balance owed {formatINR(totals.owed)} · Paid {formatINR(totals.paid)}
        </span>
      </div>

      <SectionCard title="Payout board" bodyClassName="p-0">
        <DataShell
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title="No seller payouts yet"
              description="Delivered order earnings per cycle appear here, computed by the gateway."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">TCS+TDS</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.sellerId}-${row.cycle}`} className="h-12">
                  <TableCell className="text-[13px]">
                    {row.businessName}
                    <span className="num block text-[11px] text-muted-foreground">
                      {row.sellerId}
                      {row.districtCode ? ` · ${districtName(districts, row.districtCode)}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="num text-[12px]">{row.cycle}</TableCell>
                  <TableCell className="num text-right text-[12px]">{row.orderCount}</TableCell>
                  <TableCell className="num text-right text-[12px]">
                    {formatINR(row.grossPaisa)}
                  </TableCell>
                  <TableCell className="num text-right text-[12px]">
                    {formatINR(row.commissionPaisa)}
                  </TableCell>
                  <TableCell className="num text-right text-[12px]">
                    {formatINR(row.tcsPaisa + row.tdsPaisa)}
                  </TableCell>
                  <TableCell className="num text-right text-[12px] font-semibold">
                    {formatINR(row.netPaisa)}
                  </TableCell>
                  <TableCell className="num text-right text-[12px]">
                    {row.paidPaisa > 0 ? formatINR(row.paidPaisa) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {row.balancePaisa > 0 ? (
                      <Button size="sm" variant="outline" onClick={() => open(row)}>
                        Mark paid
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Settled</span>
                    )}
                    {row.paidPaisa > 0 && row.payoutId ? (
                      <Button
                        size="sm"
                        variant="link"
                        className="ml-2 p-0 text-[11px]"
                        onClick={() => void downloadInvoice(row)}
                      >
                        Payout invoice
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Mark seller payout paid</DialogTitle>
                <DialogDescription>
                  {selected.businessName} · {selected.sellerId} · cycle {selected.cycle}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Owed this cycle (server-computed)</span>
                  <span className="num font-semibold">{formatINR(selected.netPaisa)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already paid</span>
                  <span className="num">{formatINR(selected.paidPaisa)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance to pay now</span>
                  <span className="num font-semibold">{formatINR(selected.balancePaisa)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="seller-amount">Amount paid (₹)</Label>
                <Input
                  id="seller-amount"
                  type="number"
                  min="0"
                  step="1"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  disabled={busy}
                  placeholder={`Up to ${(selected.balancePaisa / 100).toFixed(0)}`}
                />
                <p className="text-[11px] text-muted-foreground">
                  Paying less than the balance keeps the remainder owed for this cycle. This is a
                  recorded entry — no bank transfer is created.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={() => void submit()} disabled={busy}>
                  {busy ? "Saving..." : "Mark as Paid"}
                </Button>
                <ComponentHelp helpKey="pattern:payout-mark-paid" label="About marking a payout paid" />
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}