"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { config } from "@/lib/config";
import { formatINR } from "@/lib/format";
import { floorPaisa } from "@/lib/pricing/rules";


function PlatformSettings() {
  const [form, setForm] = useState({
    commissionPercent: String(config.commissionPercent),
    tcsPercent: String(config.tcsPercent),
    coinEarnRate: String(config.coinEarnRate),
    coinRedeemRate: String(config.coinRedeemRate),
    slaHours: String(config.slaHours),
  });

  const sampleMrp = 199900;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Platform settings"
        description="These values drive settlement maths, price floors and SLA gates everywhere in the portal."
      />

      <SectionCard title="Commission & tax">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="commission">Commission %</Label>
            <Input
              id="commission"
              className="num"
              value={form.commissionPercent}
              onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tcs">TCS %</Label>
            <Input
              id="tcs"
              className="num"
              value={form.tcsPercent}
              onChange={(e) => setForm({ ...form, tcsPercent: e.target.value })}
            />
          </div>
        </div>
        <p className="num mt-3 text-[12px] text-muted-foreground">
          At the current settings, a {formatINR(sampleMrp)} MRP item has a price floor of{" "}
          {formatINR(floorPaisa(sampleMrp))}.
        </p>
      </SectionCard>

      <SectionCard title="FaazioCoins">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="earn">Earn rate (coins per ₹100)</Label>
            <Input
              id="earn"
              className="num"
              value={form.coinEarnRate}
              onChange={(e) => setForm({ ...form, coinEarnRate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="redeem">Redeem rate (₹ per coin)</Label>
            <Input
              id="redeem"
              className="num"
              value={form.coinRedeemRate}
              onChange={(e) => setForm({ ...form, coinRedeemRate: e.target.value })}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Service levels">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sla">Dispatch SLA (hours)</Label>
            <Input
              id="sla"
              className="num"
              value={form.slaHours}
              onChange={(e) => setForm({ ...form, slaHours: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => toast.success("Platform settings saved")}>
            Save settings
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}

export default PlatformSettings;
