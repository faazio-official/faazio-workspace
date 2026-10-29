"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
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
import { formatDate, formatINR, parseRupeesToPaisa } from "@/lib/format";
import { createCoupon, toggleCoupon } from "@/lib/api";
import { useCoupons, useMockLoading } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import type { Sector } from "@/data/types";


function StateCoupons() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const coupons = useCoupons({ stateCode });
  const [code, setCode] = useState("");
  const [sector, setSector] = useState<Sector>("MART");
  const [valuePercent, setValuePercent] = useState("10");
  const [maxDiscount, setMaxDiscount] = useState("150");
  const [validTill, setValidTill] = useState("");

  const percent = Number(valuePercent);
  const valid =
    code.trim().length >= 4 && percent > 0 && percent <= 50 && validTill !== "" && maxDiscount !== "";

  return (
    <div className="space-y-4">
      <PageHeader title="Coupons" description="District coupons appear at checkout for shoppers in your district." />

      <SectionCard title="Issue a coupon">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5">
              <Label htmlFor="code">Code</Label>
              <ComponentHelp id="coupon-code" label="About the coupon code" />
            </span>
            <Input
              id="code"
              className="num"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MHFEST10"
            />
          </div>
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5">
              <Label>Sector</Label>
              <ComponentHelp id="coupon-sector" label="About the coupon sector" />
            </span>
            <Select value={sector} onValueChange={(v) => setSector(v as Sector)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MART">MART</SelectItem>
                <SelectItem value="FOOD">FOOD</SelectItem>
                <SelectItem value="PHARMA">PHARMA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5">
              <Label htmlFor="pct">Value %</Label>
              <ComponentHelp id="coupon-value" label="About the discount value" />
            </span>
            <Input
              id="pct"
              className="num"
              value={valuePercent}
              onChange={(e) => setValuePercent(e.target.value)}
            />
            {percent > 50 ? <p className="text-[11px] text-destructive">Maximum 50%.</p> : null}
          </div>
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5">
              <Label htmlFor="cap">Max discount (₹)</Label>
              <ComponentHelp id="coupon-cap" label="About the maximum discount" />
            </span>
            <Input
              id="cap"
              className="num"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5">
              <Label htmlFor="till">Valid till</Label>
              <ComponentHelp id="coupon-valid-till" label="About the validity date" />
            </span>
            <Input
              id="till"
              type="date"
              className="num"
              value={validTill}
              onChange={(e) => setValidTill(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => {
              createCoupon({
                code: code.trim(),
                scope: "STATE",
                stateCode,
                sector,
                valuePercent: percent,
                maxDiscountPaisa: parseRupeesToPaisa(maxDiscount),
                validTill: new Date(validTill).toISOString(),
                active: true,
              });
              setCode("");
              toast.success("Coupon issued");
            }}
          >
            Issue coupon
          </Button>
          <ComponentHelp id="issue-coupon" label="About issuing a coupon" />
        </div>
      </SectionCard>

      <SectionCard title="Coupons in your district" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={coupons.length === 0}
          empty={<EmptyState title="No coupons yet" description="Issue your first state coupon above." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Cap</TableHead>
                <TableHead>Valid till</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    Action
                    <ComponentHelp id="toggle-coupon" label="About retiring a coupon" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.couponId} className="h-12">
                  <TableCell className="num text-[13px] font-semibold">{coupon.code}</TableCell>
                  <TableCell className="num text-[12px]">
                    {coupon.scope}
                    {coupon.stateCode ? ` · ${coupon.stateCode}` : ""}
                  </TableCell>
                  <TableCell className="num text-[12px]">{coupon.sector ?? "All"}</TableCell>
                  <TableCell className="num text-right">{coupon.valuePercent}%</TableCell>
                  <TableCell className="num text-right">{formatINR(coupon.maxDiscountPaisa)}</TableCell>
                  <TableCell className="num text-[12px]">{formatDate(coupon.validTill)}</TableCell>
                  <TableCell>
                    <StatusPill status={coupon.active ? "ACTIVE" : "RETIRED"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={coupon.scope === "GLOBAL"}
                      onClick={() => {
                        toggleCoupon(coupon.couponId);
                        toast.success(coupon.active ? "Coupon retired" : "Coupon reactivated");
                      }}
                    >
                      {coupon.active ? "Retire" : "Reactivate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default StateCoupons;
