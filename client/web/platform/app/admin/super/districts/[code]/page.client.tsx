"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { EmptyState, TableSkeleton } from "@/components/patterns/DataState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { GmvTrend } from "@/components/patterns/Charts";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DistrictAdminDrawer, VerticalAccessBadges } from "@/components/admin/DistrictAdminDrawer";
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
import {
  useAdminDistricts,
  useAnalyticsSeries,
  useCampaigns,
  useDistrictAdmins,
  useSellers,
} from "@/lib/api/hooks";
import { districtName, stateForDistrict } from "@/lib/api/reference";

function SuperDistrictDrilldown() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const districtCode = (code ?? "").toUpperCase();
  // The admin read (not the picker read) so a deactivated district still resolves here.
  const { items: districts, loading } = useAdminDistricts();
  const [query, setQuery] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  const known = districts.find((d) => d.districtCode === districtCode);
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

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="District drilldown" />
        <TableSkeleton />
      </div>
    );
  }

  if (!known) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Unknown district"
          description={`No district named ${districtCode} is in the master.`}
          actions={
            <Link href="/admin/super/districts" className="text-[13px] font-semibold text-primary hover:underline">
              Back to district coverage
            </Link>
          }
        />
        <EmptyState
          title="District not found"
          description="It may have been deleted, or the link is stale. Pick it from the coverage page."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${known.districtCode} · ${known.name}`}
        description={
          known.isActive
            ? "Supply, demand and governance for this district in one place."
            : "This district is deactivated — hidden from pickers, existing references intact."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/super/districts"
              className="text-[13px] font-semibold text-primary hover:underline"
            >
              All districts
            </Link>
            <StatusPill status={known.isActive ? "ACTIVE" : "INACTIVE"} />
            <div className="flex items-center gap-1.5">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a district..."
                className="h-8 w-44 text-[12px]"
                aria-label="Search districts"
              />
              <ComponentHelp id="district-search" label="About searching districts" />
            </div>
            <div className="flex items-center gap-1.5">
              <ComponentHelp id="district-select" label="About choosing a district" />
              <Select
                value={districtCode}
                onValueChange={(next) => router.push(`/admin/super/districts/${next}`)}
              >
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

      <SectionCard
        title={`${districtName(districts, districtCode)} GMV`}
        description={`State ${stateCode} · last 30 days`}
      >
        <GmvTrend data={series} />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Admin roster"
          bodyClassName="p-0"
          actions={
            <div className="flex items-center gap-1.5">
              <ComponentHelp id="district-admin-roster" label="About the admin roster" />
              <ComponentHelp id="district-admin-assign" label="About assigning an admin" />
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAssignOpen(true)}>
                <Plus className="size-3.5" /> Assign admin
              </Button>
            </div>
          }
        >
          {admins.length === 0 ? (
            <div className="px-4 py-6">
              <EmptyState
                title="No admins for this district"
                description="Assign one now so KYC and campaigns are covered."
              />
              <div className="mt-3 flex justify-center">
                <Button size="sm" className="gap-1.5" onClick={() => setAssignOpen(true)}>
                  <Plus className="size-3.5" /> Assign admin to {known.districtCode}
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.adminId} className="h-12">
                    <TableCell className="text-[13px] font-medium">{admin.name}</TableCell>
                    <TableCell className="num text-[12px]">{admin.email}</TableCell>
                    <TableCell>
                      <VerticalAccessBadges
                        martAccess={admin.martAccess}
                        foodAccess={admin.foodAccess}
                        pharmaAccess={admin.pharmaAccess}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusPill status={admin.active ? "ACTIVE" : "DEACTIVATED"} />
                        {admin.inviteStatus === "pending" ? <StatusPill status="PENDING_INVITE" /> : null}
                      </div>
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

      <DistrictAdminDrawer
        open={assignOpen}
        onOpenChange={setAssignOpen}
        districts={districts}
        lockedDistrictCode={districtCode}
        admins={admins}
      />
    </div>
  );
}

export default SuperDistrictDrilldown;
