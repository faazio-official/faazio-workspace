"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
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
import { formatDate } from "@/lib/format";
import { capFor } from "@/lib/pricing/rules";
import { createFestivalCampaign, setOptinStatus, updateCampaign } from "@/lib/api";
import { useCampaigns, useMockLoading, useOptins, useProducts, useSectorCaps } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import type { CampaignStatus, Sector } from "@/data/types";


const SECTORS: Sector[] = ["MART", "FOOD", "PHARMA"];
const LIFECYCLE: CampaignStatus[] = ["DRAFT", "SCHEDULED", "LIVE", "ENDED"];

function StateFestival() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const caps = useSectorCaps();
  const campaigns = useCampaigns({ stateCode });
  const optins = useOptins();
  const products = useProducts({ stateCode });
  const productIds = new Set(products.map((p) => p.productId));
  const stateOptins = optins.filter((o) => productIds.has(o.productId));

  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const canCreate = name.trim().length > 2 && startsAt !== "" && endsAt !== "" && startsAt < endsAt;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Festival campaigns"
        description="Your discounts can never exceed the Super Admin's sector caps."
      />

      <SectionCard title="Sector caps in force" description="Global cap, or your district override when set">
        <div className="grid gap-3 md:grid-cols-3">
          {SECTORS.map((sector) => (
            <div key={sector} className="rounded-xl border border-border p-3">
              <SectorPill sector={sector} />
              <p className="num mt-2 text-[22px] font-semibold leading-none">
                {capFor(caps, sector, stateCode)}%
              </p>
              <p className="text-[11px] text-muted-foreground">Maximum festival discount</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Create a state campaign">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5">
              <Label htmlFor="cmp-name">Campaign name</Label>
              <ComponentHelp id="campaign-name" label="About the campaign name" />
            </span>
            <Input id="cmp-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5">
              <Label htmlFor="cmp-banner">Banner asset URL</Label>
              <ComponentHelp id="campaign-banner" label="About the campaign banner" />
            </span>
            <Input id="cmp-banner" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5">
              <Label htmlFor="cmp-start">Starts</Label>
              <ComponentHelp id="campaign-dates" label="About the campaign window" />
            </span>
            <Input
              id="cmp-start"
              type="date"
              className="num"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmp-end">Ends</Label>
            <Input
              id="cmp-end"
              type="date"
              className="num"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
        </div>
        {startsAt && endsAt && startsAt >= endsAt ? (
          <p className="mt-2 text-[12px] text-destructive">The end date must be after the start date.</p>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            disabled={!canCreate}
            onClick={() => {
              createFestivalCampaign({
                name: name.trim(),
                scope: "STATE",
                stateCode,
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                bannerUrl: bannerUrl.trim() || "https://cdn.faazio.dev/banners/state-festival.png",
                status: "DRAFT",
              });
              setName("");
              setStartsAt("");
              setEndsAt("");
              setBannerUrl("");
              toast.success("Campaign created as DRAFT");
            }}
          >
            Create campaign
          </Button>
          <ComponentHelp id="create-campaign" label="About creating a campaign" />
        </div>
      </SectionCard>

      <SectionCard title="Campaigns" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={campaigns.length === 0}
          empty={<EmptyState title="No campaigns" description="Create your first state campaign above." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center justify-end gap-1.5">
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
                    {formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={campaign.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.scope === "STATE" ? (
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
                    ) : (
                      <span className="text-[12px] text-muted-foreground">Global — read only</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <SectionCard title="Seller opt-ins" description="Approve discounts sellers requested for these campaigns" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={stateOptins.length === 0}
          empty={<EmptyState title="No opt-ins yet" description="Sellers opt in per product from their promotions page." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Requested</TableHead>
                <TableHead className="text-right">Cap</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    Decision
                    <ComponentHelp id="approve-optin" label="About approving an opt-in" />
                    <ComponentHelp id="reject-optin" label="About rejecting an opt-in" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stateOptins.map((optin) => {
                const product = products.find((p) => p.productId === optin.productId);
                const cap = product ? capFor(caps, product.sector, stateCode) : 0;
                return (
                  <TableRow key={optin.optinId} className="h-12">
                    <TableCell className="text-[13px] font-medium">
                      {product?.name ?? optin.productId}
                    </TableCell>
                    <TableCell className="num text-[12px]">{optin.campaignId}</TableCell>
                    <TableCell className="num text-right">{optin.discountPercent}%</TableCell>
                    <TableCell className="num text-right text-muted-foreground">{cap}%</TableCell>
                    <TableCell>
                      <StatusPill status={optin.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={optin.discountPercent > cap}
                          onClick={() => {
                            setOptinStatus(optin.optinId, "APPROVED");
                            toast.success("Opt-in approved");
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOptinStatus(optin.optinId, "REJECTED");
                            toast.success("Opt-in rejected");
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default StateFestival;
