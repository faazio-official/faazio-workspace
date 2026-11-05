"use client";
import { useState } from "react";
import { Calendar, ChevronDown, ChevronRight, Download, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";
import { HubHeader } from "@/components/sellers/shells";
import { Card, PillTabs, Sheet, EmptyState } from "@/components/sellers/kit";
import { formatDate, formatINR } from "@/lib/format";
import { useLedger, useMockLoading, usePayouts } from "@/lib/api/hooks";
import { getSellerPayoutInvoice } from "@/lib/api";
import { useSession } from "@/lib/hooks/useSession";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { LedgerEntry, PayoutRecord } from "@/data/types";

const PAYOUT_PILL: Record<PayoutRecord["status"], string> = {
  SCHEDULED: "bg-info-soft text-info",
  PAID: "bg-success-soft text-success",
  ON_HOLD: "bg-warning-soft text-warning",
  PARTIAL: "bg-warning-soft text-warning",
};

/** Download the separate payout invoice (0078) for a PAID payout as a JSON settlement document. */
async function downloadPayoutInvoice(payout: PayoutRecord) {
  try {
    const invoices = await getSellerPayoutInvoice(payout.payoutId);
    if (!invoices.length) throw new Error("No payout invoice found for this payout");
    const blob = new Blob([JSON.stringify(invoices, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-invoice-${payout.payoutId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Payout invoice downloaded");
  } catch (err) {
    toast.error("Could not download the payout invoice", {
      description: err instanceof Error ? err.message : undefined,
    });
  }
}

function SellerPayments() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "";
  const loading = useMockLoading();
  const ledger = useLedger(sellerId);
  const payouts = usePayouts(sellerId);
  const [tab, setTab] = useState<"payouts" | "invoices">("payouts");
  const [detail, setDetail] = useState<LedgerEntry | null>(null);
  const [cycle, setCycle] = useState<string | null>(null);
  const [pick, setPick] = useState(false);

  const gross = ledger.reduce((t, l) => t + l.orderValuePaisa, 0);
  const tcs = ledger.reduce((t, l) => t + l.tcsPaisa, 0);
  const tds = ledger.reduce((t, l) => t + l.tdsPaisa, 0);
  const productTax = ledger.reduce((t, l) => t + l.productTaxPaisa, 0);
  const net = ledger.reduce((t, l) => t + l.netPayoutPaisa, 0);

  const cycles = Array.from(new Set(ledger.map((l) => l.cycle))).sort().reverse();
  const active = cycle ?? cycles[0] ?? null;
  const cycleLedger = active ? ledger.filter((l) => l.cycle === active) : [];

  return (
    <>
      <HubHeader
        actions={
          <button
            onClick={() => window.print()}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold"
          >
            Print statement
          </button>
        }
      />

      <div className="mt-3 px-4">
        <PillTabs
          tabs={[
            { key: "payouts", label: "Payouts" },
            { key: "invoices", label: "Invoices & Taxes" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="space-y-3 px-4 pt-3 pb-8">
        {tab === "payouts" ? (
          <>
            <Card>
              <p className="text-[11px] text-muted-foreground">All-time settlement · {cycles.length} cycles</p>
              <p className="mt-1 text-2xl font-bold">{formatINR(net)}</p>
              <p className="text-[11px] text-muted-foreground">Net payout after taxes</p>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Gross order value</p>
                  <b>{formatINR(gross)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">Product GST</p>
                  <b>{formatINR(productTax)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">TCS {config.tcsPercent}%</p>
                  <b className="text-brand">−{formatINR(tcs)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">TDS 0.1%</p>
                  <b className="text-brand">−{formatINR(tds)}</b>
                </div>
              </div>
            </Card>

            {ledger.length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-12 w-12" strokeWidth={1.2} />}
                text="No settlements yet — cycles appear after your first held payout"
              />
            ) : (
              <>
                <div className="flex items-center gap-2 pt-2">
                  {active && (
                    <>
                      <button
                        onClick={() => setPick(true)}
                        className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs"
                      >
                        <Calendar className="h-4 w-4" />
                        {active}
                        <ChevronDown className="ml-auto h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toast.success(`Report for ${active} sent to your email`)}
                        className="flex items-center gap-1 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Get report
                      </button>
                    </>
                  )}
                </div>

                <p className="pt-1 text-sm font-bold">Cycles · {active ?? "—"}</p>
                {loading && cycleLedger.length === 0 ? (
                  <div className="space-y-3">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
                    ))}
                  </div>
                ) : (
                  cycleLedger.map((entry) => (
                    <Card key={entry.entryId} onClick={() => setDetail(entry)} className="cursor-pointer">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Net payout</p>
                          <p className="text-base font-bold">{formatINR(entry.netPayoutPaisa)}</p>
                          <p className="text-[10px] text-muted-foreground">Cycle {entry.cycle}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Order value</p>
                          <b>{formatINR(entry.orderValuePaisa)}</b>
                        </div>
                        <div>
                          <p className="text-muted-foreground">TCS</p>
                          <span className="text-brand">−{formatINR(entry.tcsPaisa)}</span>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Product GST</p>
                          <span>{formatINR(entry.productTaxPaisa)}</span>
                        </div>
                      </div>
                      <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs font-semibold text-info">
                        View details <ChevronRight className="h-3.5 w-3.5" />
                      </p>
                    </Card>
                  ))
                )}

                {payouts.length > 0 && (
                  <>
                    <p className="pt-1 text-sm font-bold">Payout schedule</p>
                    {payouts.map((p) => {
                      const paidNow = p.paidAmountPaisa ?? (p.status === "PAID" ? p.amountPaisa : 0);
                      const balance = p.balancePaisa ?? Math.max(0, p.amountPaisa - paidNow);
                      return (
                        <div key={p.payoutId} className="rounded-2xl border border-border bg-card p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold">{formatINR(p.amountPaisa)}</p>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                                PAYOUT_PILL[p.status],
                              )}
                            >
                              {p.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="mt-2 text-[12px] text-muted-foreground">
                            Paid {formatINR(paidNow)}
                            {balance > 0 ? ` · Balance ${formatINR(balance)}` : ""}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {p.payoutId} · cycle {p.cycle} · {formatDate(p.scheduledFor)}
                            {p.paidAt ? ` · paid ${formatDate(p.paidAt)}` : ""}
                          </p>
                          {p.status === "PAID" ? (
                            <button
                              onClick={() => void downloadPayoutInvoice(p)}
                              className="mt-2 flex items-center gap-1.5 rounded-lg bg-background px-2 py-1.5 text-[11px] font-bold text-brand ring-1 ring-inset ring-border"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Payout invoice
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <Card>
              <p className="text-sm font-bold">Download invoices</p>
              <p className="text-[10px] text-muted-foreground">
                Tax invoices per settlement cycle · no platform commission
              </p>
              <div className="mt-2 divide-y divide-border">
                {cycles.length === 0 ? (
                  <p className="py-3 text-xs text-muted-foreground">No invoices generated yet</p>
                ) : (
                  cycles.map((c) => (
                    <button
                      key={c}
                      onClick={() => toast.success(`Invoice for ${c} sent to your email`)}
                      className="flex w-full items-center gap-3 py-3 text-sm"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-left">Invoice · {c}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info text-primary-foreground">
                  <Receipt className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">Taxes</p>
                  <p className="text-[10px] text-muted-foreground">
                    TCS {config.tcsPercent}% · TDS 0.1% · weekly cycles
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">TCS collected</p>
                  <b className="text-brand">−{formatINR(tcs)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">TDS deducted</p>
                  <b className="text-brand">−{formatINR(tds)}</b>
                </div>
                <div>
                  <p className="text-muted-foreground">Product GST</p>
                  <b>{formatINR(productTax)}</b>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      <Sheet open={detail !== null} onClose={() => setDetail(null)} title="Cycle details">
        {detail && (
          <div className="pb-4">
            {[
              { label: "Order value", value: formatINR(detail.orderValuePaisa) },
              { label: "TCS", value: `−${formatINR(detail.tcsPaisa)}`, negative: true },
              { label: "TDS", value: `−${formatINR(detail.tdsPaisa)}`, negative: true },
              { label: "Product GST", value: formatINR(detail.productTaxPaisa) },
              { label: "Platform GST", value: formatINR(detail.platformGstPaisa) },
            ].map((row) => (
              <div key={row.label} className="flex justify-between border-b border-border py-2.5 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={row.negative ? "text-brand" : undefined}>{row.value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-bold">
              <span>Net payout</span>
              <span>{formatINR(detail.netPayoutPaisa)}</span>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={pick} onClose={() => setPick(false)} title="Select cycle">
        {cycles.map((c) => (
          <button
            key={c}
            onClick={() => {
              setCycle(c);
              setPick(false);
            }}
            className="flex w-full items-center justify-between border-b border-border py-3 text-left text-sm last:border-0"
          >
            {c}
            {active === c && <span className="text-[10px] font-bold text-info">Current</span>}
          </button>
        ))}
      </Sheet>
    </>
  );
}

export default SellerPayments;