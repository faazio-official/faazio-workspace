"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { Button } from "@/components/ui/button";
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
import { formatDateTime, formatNumber } from "@/lib/format";
import { updateRewardRates } from "@/lib/api";
import { useMockLoading, useRewardLedger, useRewardRates } from "@/lib/api/hooks";

function SuperRewards() {
  const rates = useRewardRates();
  const ledger = useRewardLedger();
  const loading = useMockLoading();
  const [form, setForm] = useState({
    coinEarnRate: String(rates.coinEarnRate),
    coinRedeemRate: String(rates.coinRedeemRate),
    streakTargetDays: String(rates.streakTargetDays),
    discountCardPercent: String(rates.discountCardPercent),
    cardValidityDays: String(rates.cardValidityDays),
  });

  useEffect(() => {
    setForm({
      coinEarnRate: String(rates.coinEarnRate),
      coinRedeemRate: String(rates.coinRedeemRate),
      streakTargetDays: String(rates.streakTargetDays),
      discountCardPercent: String(rates.discountCardPercent),
      cardValidityDays: String(rates.cardValidityDays),
    });
  }, [rates]);

  function save() {
    const parsed = {
      coinEarnRate: Number(form.coinEarnRate),
      coinRedeemRate: Number(form.coinRedeemRate),
      streakTargetDays: Number(form.streakTargetDays),
      discountCardPercent: Number(form.discountCardPercent),
      cardValidityDays: Number(form.cardValidityDays),
    };
    if (Object.values(parsed).some((v) => !Number.isFinite(v) || v < 0)) {
      toast.error("Enter valid non-negative numbers");
      return;
    }
    updateRewardRates(parsed);
    toast.success("Rewards program updated");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rewards"
        description="Earn/redeem rates apply to the next order. The coin ledger is append-only and server-written."
      />

      <SectionCard title="FaazioCoins program">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field
            id="earn"
            label="Earn rate (₹ per coin)"
            hintId="earn-rate"
            value={form.coinEarnRate}
            onChange={(v) => setForm({ ...form, coinEarnRate: v })}
          />
          <Field
            id="redeem"
            label="Redeem rate (coins per ₹1)"
            hintId="redeem-rate"
            value={form.coinRedeemRate}
            onChange={(v) => setForm({ ...form, coinRedeemRate: v })}
          />
          <Field
            id="streak"
            label="Streak target (days)"
            hintId="streak-target"
            value={form.streakTargetDays}
            onChange={(v) => setForm({ ...form, streakTargetDays: v })}
          />
          <Field
            id="card"
            label="Discount card (%)"
            hintId="discount-card"
            value={form.discountCardPercent}
            onChange={(v) => setForm({ ...form, discountCardPercent: v })}
          />
          <Field
            id="validity"
            label="Card validity (days)"
            hintId="card-validity"
            value={form.cardValidityDays}
            onChange={(v) => setForm({ ...form, cardValidityDays: v })}
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="num text-[12px] text-muted-foreground">
            {rates.updatedAt ? `Last updated ${formatDateTime(rates.updatedAt)}` : "Using frozen defaults"}
          </p>
          <div className="flex items-center gap-1.5">
            <ComponentHelp id="save-program" label="About saving the program" />
            <Button size="sm" onClick={save}>
              Save program
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Recent coin ledger" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={ledger.length === 0}
          empty={<EmptyState title="No ledger entries" description="Coin activity appears as orders complete." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Coins</TableHead>
                <TableHead className="text-right">Rupees</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((e) => (
                <TableRow key={e.entryId} className="h-12">
                  <TableCell className="num text-muted-foreground">{e.entryId}</TableCell>
                  <TableCell className="font-medium">{e.type}</TableCell>
                  <TableCell className={`num text-right ${e.coins < 0 ? "text-destructive" : "text-success"}`}>
                    {e.coins > 0 ? `+${formatNumber(e.coins)}` : formatNumber(e.coins)}
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">{e.rupees}</TableCell>
                  <TableCell className="num text-muted-foreground">{e.orderId ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(e.at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

function Field({
  id,
  label,
  hintId,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hintId?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        {hintId ? <ComponentHelp id={hintId} label={`About ${label}`} /> : null}
      </div>
      <Input id={id} className="num" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default SuperRewards;