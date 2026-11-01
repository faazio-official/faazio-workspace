"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Upload } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STATES } from "@/data/states";
import type { Sector } from "@/data/types";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

const STEPS = ["Business", "KYC documents", "Bank", "Store", "E-sign"];

function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    category: "MART" as Sector,
    gstin: "",
    businessAddress: "",
    bankAccount: "",
    ifsc: "",
    contactPhone: "",
    storeName: "",
    city: "",
    stateCode: "MH",
    deliveryTime: "45 min",
    hours: "10:00 AM - 9:30 PM",
    isVeg: false,
    docsUploaded: false,
    signed: false,
  });

  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const gstinValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{2}$/.test(form.gstin.toUpperCase());
  const valid = [
    form.businessName.trim().length > 2 && form.ownerName.trim().length > 2 && gstinValid,
    form.docsUploaded,
    form.bankAccount.trim().length >= 8 && form.ifsc.trim().length === 11,
    form.storeName.trim().length > 2 && form.city.trim().length > 1,
    form.signed,
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Seller onboarding"
        description="Submitted applications go to your district admin for KYC review."
      />

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium",
              index === step
                ? "border-primary bg-primary/10 text-primary"
                : index < step
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border text-muted-foreground",
            )}
          >
            <span className="num">{index + 1}</span> {label}
          </li>
        ))}
      </ol>

      <SectionCard title={STEPS[step]} description={`Step ${step + 1} of ${STEPS.length}`}>
        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Text
              label="Business name"
              value={form.businessName}
              onChange={(v) => field("businessName", v)}
            />
            <Text
              label="Owner name"
              value={form.ownerName}
              onChange={(v) => field("ownerName", v)}
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Primary sector</Label>
                <ComponentHelp id="sector-select" />
              </div>
              <Select value={form.category} onValueChange={(v) => field("category", v as Sector)}>
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
              <div className="flex items-center gap-1.5">
                <Label htmlFor="gstin">GSTIN</Label>
                <ComponentHelp id="gstin-input" />
              </div>
              <Input
                id="gstin"
                className="num"
                value={form.gstin}
                onChange={(e) => field("gstin", e.target.value.toUpperCase())}
                placeholder="27AABCU9603R1ZM"
              />
              {form.gstin && !gstinValid ? (
                <p className="text-[11px] text-destructive">
                  Format must be 2 digits, 5 letters, 4 digits, 1 letter, 2 alphanumerics.
                </p>
              ) : null}
            </div>
            <Text
              label="Contact phone"
              value={form.contactPhone}
              onChange={(v) => field("contactPhone", v)}
            />
            <Text
              label="Registered address"
              value={form.businessAddress}
              onChange={(v) => field("businessAddress", v)}
            />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            {["GSTIN certificate", "PAN card", "Bank proof", "Shop licence"].map((doc) => (
              <div
                key={doc}
                className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3"
              >
                <span className="text-[13px]">{doc}</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      field("docsUploaded", true);
                      toast.success(`${doc} attached (mock upload)`);
                    }}
                  >
                    <Upload className="size-4" /> Attach
                  </Button>
                  <ComponentHelp id="attach-docs-button" />
                </div>
              </div>
            ))}
            {form.docsUploaded ? (
              <p className="flex items-center gap-1 text-[12px] text-success">
                <CheckCircle2 className="size-4" /> Documents attached
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Text
              label="Bank account number"
              value={form.bankAccount}
              onChange={(v) => field("bankAccount", v)}
              hint="bank-input"
            />
            <Text label="IFSC" value={form.ifsc} onChange={(v) => field("ifsc", v.toUpperCase())} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Text
              label="Store name"
              value={form.storeName}
              onChange={(v) => field("storeName", v)}
            />
            <Text label="City" value={form.city} onChange={(v) => field("city", v)} />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>State</Label>
                <ComponentHelp id="state-select" />
              </div>
              <Select value={form.stateCode} onValueChange={(v) => field("stateCode", v)}>
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
            <Text
              label="Delivery time"
              value={form.deliveryTime}
              onChange={(v) => field("deliveryTime", v)}
            />
            <Text label="Opening hours" value={form.hours} onChange={(v) => field("hours", v)} />
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="veg">Pure vegetarian store</Label>
              <Switch id="veg" checked={form.isVeg} onCheckedChange={(v) => field("isVeg", v)} />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              By signing you confirm the details above are accurate and accept the Faazio partner
              terms, including commission and settlement timelines.
            </p>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="sign">I agree and e-sign this application</Label>
                <ComponentHelp id="esign-switch" />
              </div>
              <Switch id="sign" checked={form.signed} onCheckedChange={(v) => field("signed", v)} />
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <Button
            size="sm"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" disabled={!valid[step]} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                disabled={!valid[step]}
                onClick={() => {
                  toast.success("Application submitted — status PENDING_REVIEW");
                  router.push("/seller");
                }}
              >
                Submit application
              </Button>
              <ComponentHelp id="submit-button" />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {hint ? <ComponentHelp id={hint} /> : null}
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default Onboarding;
