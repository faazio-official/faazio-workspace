"use client";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatINR } from "@/lib/format";
import { useLedger, useMockLoading, usePayouts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { config } from "@/lib/config";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

function SellerPayments() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const ledger = useLedger(sellerId);
  const payouts = usePayouts(sellerId);

  const gross = ledger.reduce((t, l) => t + l.orderValuePaisa, 0);
  const tcs = ledger.reduce((t, l) => t + l.tcsPaisa, 0);
  const tds = ledger.reduce((t, l) => t + l.tdsPaisa, 0);
  const productTax = ledger.reduce((t, l) => t + l.productTaxPaisa, 0);
  const net = ledger.reduce((t, l) => t + l.netPayoutPaisa, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description={`No platform commission · TCS ${config.tcsPercent}% · TDS 0.1% · weekly cycles`}
        actions={
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              Print statement
            </Button>
            <ComponentHelp id="print-statement-button" />
          </div>
        }
      />

      <DataShell loading={loading}>
        <KpiStrip
          items={[
            { label: "Gross order value", value: formatINR(gross, { compact: true }) },
            { label: "TCS", value: formatINR(tcs, { compact: true }) },
            { label: "TDS", value: formatINR(tds, { compact: true }) },
            { label: "Product GST", value: formatINR(productTax, { compact: true }) },
            { label: "Net payout", value: formatINR(net, { compact: true }) },
          ]}
        />
      </DataShell>

      <SectionCard
        title="Settlement ledger"
        bodyClassName="p-0"
        actions={<ComponentHelp id="settlement-ledger" />}
      >
        <DataShell
          loading={loading}
          isEmpty={ledger.length === 0}
          empty={
            <EmptyState
              title="No settlements yet"
              description="Cycles appear after your first held payout."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Order value</TableHead>
                <TableHead className="text-right">TCS</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Product GST</TableHead>
                <TableHead className="text-right">Net payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((entry) => (
                <TableRow key={entry.entryId} className="h-12">
                  <TableCell className="num font-medium">{entry.cycle}</TableCell>
                  <TableCell className="num text-right">
                    {formatINR(entry.orderValuePaisa)}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    −{formatINR(entry.tcsPaisa)}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    −{formatINR(entry.tdsPaisa)}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {formatINR(entry.productTaxPaisa)}
                  </TableCell>
                  <TableCell className="num text-right font-medium">
                    {formatINR(entry.netPayoutPaisa)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <SectionCard
        title="Payout schedule"
        bodyClassName="p-0"
        actions={<ComponentHelp id="payout-schedule" />}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payout</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Scheduled for</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((payout) => (
              <TableRow key={payout.payoutId} className="h-12">
                <TableCell className="num text-[12px] text-muted-foreground">
                  {payout.payoutId}
                </TableCell>
                <TableCell className="num">{payout.cycle}</TableCell>
                <TableCell className="num">{formatDate(payout.scheduledFor)}</TableCell>
                <TableCell className="num text-right">{formatINR(payout.amountPaisa)}</TableCell>
                <TableCell>
                  <StatusPill status={payout.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

export default SellerPayments;
