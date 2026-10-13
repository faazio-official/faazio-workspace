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
import type { Sector } from "@/data/types";


function SuperCoupons() {
  const loading = useMockLoading();
  const coupons = useCoupons();
  const [code, setCode] = useState("");
  const [sector, setSector] = useState<Sector | "ALL">("ALL");
  const [valuePercent, setValuePercent] = useState("15");
  const [maxDiscount, setMaxDiscount] = useState("300");
  const [validTill, setValidTill] = useState("");

  const percent = Number(valuePercent);
  const valid = code.trim().length >= 4 && percent > 0 && percent <= 50 && validTill !== "";

  return (
    <div className="space-y-4">
      <PageHeader title="Coupons" description="Global coupons apply in every state; state coupons stay local." />

      <SectionCard title="Issue a global coupon">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="g-code">Code</Label>
            <Input
              id="g-code"
              className="num"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FAAZIO15"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sector</Label>
            <Select value={sector} onValueChange={(v) => setSector(v as Sector | "ALL")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sectors</SelectItem>
                <SelectItem value="MART">MART</SelectItem>
                <SelectItem value="FOOD">FOOD</SelectItem>
                <SelectItem value="PHARMA">PHARMA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-pct">Value %</Label>
            <Input
              id="g-pct"
              className="num"
              value={valuePercent}
              onChange={(e) => setValuePercent(e.target.value)}
            />
            {percent > 50 ? <p className="text-[11px] text-destructive">Maximum 50%.</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-cap">Max discount (₹)</Label>
            <Input
              id="g-cap"
              className="num"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-till">Valid till</Label>
            <Input
              id="g-till"
              type="date"
              className="num"
              value={validTill}
              onChange={(e) => setValidTill(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => {
              createCoupon({
                code: code.trim(),
                scope: "GLOBAL",
                ...(sector === "ALL" ? {} : { sector }),
                valuePercent: percent,
                maxDiscountPaisa: parseRupeesToPaisa(maxDiscount),
                validTill: new Date(validTill).toISOString(),
                active: true,
              });
              setCode("");
              toast.success("Global coupon issued");
            }}
          >
            Issue coupon
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="All coupons" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={coupons.length === 0}
          empty={<EmptyState title="No coupons" description="Issue the first platform coupon above." />}
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
                <TableHead className="text-right">Action</TableHead>
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

export default SuperCoupons;
