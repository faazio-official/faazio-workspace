"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { GmvTrend } from "@/components/patterns/Charts";
import { StatusPill } from "@/components/patterns/Pills";
import { EmptyState } from "@/components/patterns/DataState";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import { periodDelta, sumGmv, sumOrders } from "@/lib/analytics/derive";
import { useAnalyticsSeries, useCampaigns, useSellers, useDistrictAdmins, useDistricts } from "@/lib/api/hooks";
import { districtName, stateForDistrict } from "@/lib/api/reference";


function SuperDistricts() {
  const districts = useDistricts();
  const [districtCode, setDistrictCode] = useState("");
  const [query, setQuery] = useState("");
  // Default to the first DB-backed district once the master loads; never a hardcoded client code.
  useEffect(() => {
    if (!districtCode && districts.length > 0) setDistrictCode(districts[0]!.districtCode);
  }, [districtCode, districts]);
  const stateCode = districtCode ? stateForDistrict(districts, districtCode) : "";
  const series = useAnalyticsSeries("state", stateCode, 30);
  const sellers = useSellers({ districtCode });
  const admins = useDistrictAdmins(districtCode);
  const campaigns = useCampaigns({ stateCode });

  const q = query.trim().toLowerCase();
  const visibleDistricts = districts.filter(
    (d) => !q || d.districtCode.toLowerCase().includes(q) || d.name.toLowerCase().includes(q),
  );
  const visibleTn = visibleDistricts.filter((d) => d.stateCode === "TN");
  const visiblePy = visibleDistricts.filter((d) => d.stateCode === "PY");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Districts"
        description="Pick a district to see its supply, demand and governance in one place."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search districts..."
                className="h-8 w-44 text-[12px]"
                aria-label="Search districts"
              />
              <ComponentHelp id="district-search" label="About searching districts" />
            </div>
            <div className="flex items-center gap-1.5">
              <ComponentHelp id="district-select" label="About choosing a district" />
              <Select value={districtCode} onValueChange={setDistrictCode}>
                <SelectTrigger className="w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibleTn.length > 0 ? (
                  <SelectGroup>
                    <SelectLabel>Tamil Nadu</SelectLabel>
                    {visibleTn.map((info) => (
                      <SelectItem key={info.districtCode} value={info.districtCode}>
                        {info.districtCode} · {info.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {visiblePy.length > 0 ? (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Puducherry</SelectLabel>
                      {visiblePy.map((info) => (
                        <SelectItem key={info.districtCode} value={info.districtCode}>
                          {info.districtCode} · {info.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                ) : null}
              </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <KpiStrip
        items={[
          {
            label: "GMV (30d)",
            value: formatINR(sumGmv(series), { compact: true }),
            deltaPercent: periodDelta(series, (p) => p.gmvPaisa),
            compare: "vs previous 30 days",
          },
          { label: "Orders (30d)", value: formatNumber(sumOrders(series)) },
          { label: "Sellers", value: formatNumber(sellers.length) },
          { label: "Active admins", value: formatNumber(admins.filter((a) => a.active).length) },
          { label: "Campaigns", value: formatNumber(campaigns.length) },
        ]}
      />

      <SectionCard title={`${districtCode ? districtName(districts, districtCode) : "District"} GMV`} description="Last 30 days">
        <GmvTrend data={series} />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Admin roster"
          bodyClassName="p-0"
          actions={<ComponentHelp id="district-admin-roster" label="About the admin roster" />}
        >
          {admins.length === 0 ? (
            <EmptyState
              title="No admins for this district"
              description="Create one from the District admins page so KYC and campaigns are covered."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.adminId} className="h-12">
                    <TableCell className="text-[13px] font-medium">{admin.name}</TableCell>
                    <TableCell className="num text-[12px]">{admin.email}</TableCell>
                    <TableCell>
                      <StatusPill status={admin.active ? "ACTIVE" : "DEACTIVATED"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          title="Campaigns"
          bodyClassName="p-0"
          actions={<ComponentHelp id="district-campaigns" label="About district campaigns" />}
        >
          {campaigns.length === 0 ? (
            <EmptyState title="No campaigns" description="This state has no festival campaigns yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.campaignId} className="h-12">
                    <TableCell className="text-[13px] font-medium">{campaign.name}</TableCell>
                    <TableCell className="num text-[12px]">
                      {formatDate(campaign.startsAt)} to {formatDate(campaign.endsAt)}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={campaign.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Sellers in this district"
        bodyClassName="p-0"
        actions={<ComponentHelp id="district-sellers" label="About district sellers" />}
      >
        {sellers.length === 0 ? (
          <EmptyState title="No sellers" description="No seller has applied from this district yet." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller) => (
                <TableRow key={seller.sellerId} className="h-12">
                  <TableCell className="text-[13px] font-medium">{seller.businessName}</TableCell>
                  <TableCell className="text-[13px]">{seller.ownerName}</TableCell>
                  <TableCell className="num text-right">{seller.rating.toFixed(1)}</TableCell>
                  <TableCell>
                    <StatusPill status={seller.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

export default SuperDistricts;
