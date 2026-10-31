"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { CategoryBars } from "@/components/patterns/Charts";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { capFor } from "@/lib/pricing/rules";
import { sumGmv } from "@/lib/analytics/derive";
import {
  createFestivalCampaign,
  productMetrics,
  setSectorCap,
  updateCampaign,
} from "@/lib/api";
import {
  useCampaigns,
  useMockLoading,
  useOptins,
  useProducts,
  useSectorCaps,
} from "@/lib/api/hooks";
import { STATES } from "@/data/states";
import type { CampaignStatus, Sector } from "@/data/types";


const SECTORS: Sector[] = ["MART", "FOOD", "PHARMA"];
const LIFECYCLE: CampaignStatus[] = ["DRAFT", "SCHEDULED", "LIVE", "ENDED"];

function SuperFestival() {
  const loading = useMockLoading();
  const caps = useSectorCaps();
  const campaigns = useCampaigns();
  const optins = useOptins();
  const products = useProducts();

  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({});
  const [overrideState, setOverrideState] = useState(STATES[0]?.stateCode ?? "MH");
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const optinGmv = optins.reduce((total, optin) => {
    const series = productMetrics(optin.productId, 30);
    return total + sumGmv(series);
  }, 0);

  const uplift = SECTORS.map((sector) => {
    const sectorOptins = optins.filter((o) => {
      const product = products.find((p) => p.productId === o.productId);
      return product?.sector === sector;
    });
    return {
      label: sector,
      value: sectorOptins.reduce((t, o) => t + sumGmv(productMetrics(o.productId, 30)), 0),
    };
  });

  const canCreate = name.trim().length > 2 && startsAt !== "" && endsAt !== "" && startsAt < endsAt;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Festival governance"
        description="Caps you set here are the hard ceiling for every state campaign and seller opt-in."
      />

      <KpiStrip
        items={[
          { label: "Campaigns", value: formatNumber(campaigns.length) },
          { label: "Live", value: formatNumber(campaigns.filter((c) => c.status === "LIVE").length) },
          { label: "Seller opt-ins", value: formatNumber(optins.length) },
          { label: "Opted-in GMV (30d)", value: formatINR(optinGmv, { compact: true }) },
        ]}
      />

      <SectionCard
        title="Global sector caps"
        description="Maximum festival discount per sector"
        actions={<ComponentHelp id="global-cap" label="About the global cap" />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {SECTORS.map((sector) => {
            const current = capFor(caps, sector);
            const key = `global:${sector}`;
            return (
              <div key={sector} className="space-y-2 rounded-xl border border-border p-3">
                <SectorPill sector={sector} />
                <div className="space-y-1.5">
                  <Label htmlFor={key}>Cap %</Label>
                  <Input
                    id={key}
                    className="num"
                    value={capDrafts[key] ?? String(current)}
                    onChange={(e) => setCapDrafts((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next = Number(capDrafts[key] ?? current);
                    if (!Number.isFinite(next) || next <= 0 || next > 90) {
                      toast.error("Enter a cap between 1% and 90%");
                      return;
                    }
                    setSectorCap(sector, next);
                    toast.success(`${sector} global cap set to ${next}%`);
                  }}
                >
                  Save cap
                </Button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Per-state overrides"
        description="An override replaces the global cap for that state only"
        actions={<ComponentHelp id="state-override" label="About state overrides" />}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>State</Label>
            <Select value={overrideState} onValueChange={setOverrideState}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s.stateCode} value={s.stateCode}>
                    {s.stateCode} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {SECTORS.map((sector) => {
            const key = `${overrideState}:${sector}`;
            const current = capFor(caps, sector, overrideState);
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{sector} cap %</Label>
                <Input
                  id={key}
                  className="num"
                  value={capDrafts[key] ?? String(current)}
                  onChange={(e) => setCapDrafts((d) => ({ ...d, [key]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next = Number(capDrafts[key] ?? current);
                    const global = capFor(caps, sector);
                    if (!Number.isFinite(next) || next <= 0) {
                      toast.error("Enter a cap above 0%");
                      return;
                    }
                    if (next > global) {
                      toast.error(`A state override cannot exceed the ${global}% global cap`);
                      return;
                    }
                    setSectorCap(sector, next, overrideState);
                    toast.success(`${overrideState} ${sector} cap set to ${next}%`);
                  }}
                >
                  Save
                </Button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Create a global campaign">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="g-name">Campaign name</Label>
              <ComponentHelp id="campaign-name" label="About the campaign name" />
            </div>
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="g-start">Starts</Label>
              <ComponentHelp id="campaign-dates" label="About the campaign dates" />
            </div>
            <Input
              id="g-start"
              type="date"
              className="num"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-end">Ends</Label>
            <Input
              id="g-end"
              type="date"
              className="num"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-1.5">
          <ComponentHelp id="create-campaign-button" label="About creating a campaign" />
          <Button
            size="sm"
            disabled={!canCreate}
            onClick={() => {
              createFestivalCampaign({
                name: name.trim(),
                scope: "GLOBAL",
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                bannerUrl: "https://cdn.faazio.dev/banners/faazio-utsav.png",
                status: "DRAFT",
              });
              setName("");
              setStartsAt("");
              setEndsAt("");
              toast.success("Global campaign created as DRAFT");
            }}
          >
            Create campaign
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="All campaigns" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={campaigns.length === 0}
          empty={<EmptyState title="No campaigns" description="Create the first global campaign above." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Window</TableHead>
                <TableHead className="text-right">Opt-ins</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Lifecycle
                    <ComponentHelp id="campaign-lifecycle" label="About the campaign lifecycle" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.campaignId} className="h-12">
                  <TableCell className="text-[13px] font-medium">{campaign.name}</TableCell>
                  <TableCell className="num text-[12px]">
                    {campaign.scope}
                    {campaign.stateCode ? ` · ${campaign.stateCode}` : ""}
                  </TableCell>
                  <TableCell className="num text-[12px]">
                    {formatDate(campaign.startsAt)} to {formatDate(campaign.endsAt)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {optins.filter((o) => o.campaignId === campaign.campaignId).length}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={campaign.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={campaign.status}
                      onValueChange={(value) => {
                        updateCampaign(campaign.campaignId, { status: value as CampaignStatus });
                        toast.success(`Campaign moved to ${value}`);
                      }}
                    >
                      <SelectTrigger className="ml-auto h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIFECYCLE.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <SectionCard title="Opted-in GMV by sector" description="Last 30 days on products with an active opt-in">
        <CategoryBars data={uplift} />
      </SectionCard>
    </div>
  );
}

export default SuperFestival;
