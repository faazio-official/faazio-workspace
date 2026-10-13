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


function SellerPayments() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const ledger = useLedger(sellerId);
  const payouts = usePayouts(sellerId);

  const gross = ledger.reduce((t, l) => t + l.orderValuePaisa, 0);
  const commission = ledger.reduce((t, l) => t + l.commissionPaisa, 0);
  const tcs = ledger.reduce((t, l) => t + l.tcsPaisa, 0);
  const net = ledger.reduce((t, l) => t + l.netPayoutPaisa, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description={`Commission ${config.commissionPercent}% · TCS ${config.tcsPercent}% · weekly cycles`}
        actions={
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Print statement
          </Button>
        }
      />

      <DataShell loading={loading}>
        <KpiStrip
          items={[
            { label: "Gross order value", value: formatINR(gross, { compact: true }) },
            { label: "Commission", value: formatINR(commission, { compact: true }) },
            { label: "TCS", value: formatINR(tcs, { compact: true }) },
            { label: "Net payout", value: formatINR(net, { compact: true }) },
          ]}
        />
      </DataShell>

      <SectionCard title="Settlement ledger" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={ledger.length === 0}
          empty={<EmptyState title="No settlements yet" description="Cycles appear after your first delivered order." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Order value</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">TCS</TableHead>
                <TableHead className="text-right">Net payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((entry) => (
                <TableRow key={entry.entryId} className="h-12">
                  <TableCell className="num font-medium">{entry.cycle}</TableCell>
                  <TableCell className="num text-right">{formatINR(entry.orderValuePaisa)}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    −{formatINR(entry.commissionPaisa)}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    −{formatINR(entry.tcsPaisa)}
                  </TableCell>
                  <TableCell className="num text-right font-semibold">
                    {formatINR(entry.netPayoutPaisa)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <SectionCard title="Payout schedule" bodyClassName="p-0">
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
