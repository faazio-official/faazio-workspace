"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { ThemeSegmentedControl } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { config } from "@/lib/config";
import { formatINR } from "@/lib/format";
import { floorPaisa } from "@/lib/pricing/rules";


function PlatformSettings() {
  const [form, setForm] = useState({
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

      <SectionCard title="Tax & statutory">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="tcs">TCS %</Label>
              <ComponentHelp id="tcs-input" label="About TCS" />
            </div>
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
            <div className="flex items-center gap-1.5">
              <Label htmlFor="earn">Earn rate (coins per ₹100)</Label>
              <ComponentHelp id="earn-rate" label="About the earn rate" />
            </div>
            <Input
              id="earn"
              className="num"
              value={form.coinEarnRate}
              onChange={(e) => setForm({ ...form, coinEarnRate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="redeem">Redeem rate (₹ per coin)</Label>
              <ComponentHelp id="redeem-rate" label="About the redeem rate" />
            </div>
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
            <div className="flex items-center gap-1.5">
              <Label htmlFor="sla">Dispatch SLA (hours)</Label>
              <ComponentHelp id="sla-input" label="About the dispatch SLA" />
            </div>
            <Input
              id="sla"
              className="num"
              value={form.slaHours}
              onChange={(e) => setForm({ ...form, slaHours: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-1.5">
          <ComponentHelp id="save-settings" label="About saving settings" />
          <Button size="sm" onClick={() => toast.success("Platform settings saved")}>
            Save settings
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Appearance"
        description="Applies to this browser, on every console you sign in to"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Label>Theme</Label>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Auto follows your device&apos;s light or dark setting.
            </p>
          </div>
          <ThemeSegmentedControl />
        </div>
      </SectionCard>
    </div>
  );
}

export default PlatformSettings;
