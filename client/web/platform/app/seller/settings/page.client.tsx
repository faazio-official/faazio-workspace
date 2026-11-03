"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Card, TextField, Toggle, UnderlineTabs } from "@/components/sellers/kit";
import { ThemeSegmentedControl } from "@/components/layout/ThemeToggle";
import { getBankAccount } from "@/lib/api";
import { useSeller, useSellerScope } from "@/lib/api/hooks";

type Tab = "profile" | "bank" | "notifications" | "appearance" | "users";

const NOTIFICATIONS = ["New order alerts", "Low stock alerts", "SLA breach warnings", "Festival campaign news"];

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "bank", label: "Bank" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "users", label: "Sub-users" },
];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}

function SellerSettings() {
  const { sellerId } = useSellerScope();
  const seller = useSeller(sellerId);
  const bank = getBankAccount(sellerId);
  const [tab, setTab] = useState<Tab>("profile");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATIONS.map((n) => [n, true])),
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <>
      <PageHeader title="Settings" sub="Account" />
      <div className="px-4 pt-3">
        <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="space-y-3 px-4 pt-3 pb-8">
        {tab === "profile" && (
          <Card>
            <p className="mb-2 text-sm font-bold">Business profile</p>
            <p className="mb-2 text-[10px] text-muted-foreground">
              Profile changes that affect KYC need admin re-verification.
            </p>
            <Row label="Business name" value={seller?.businessName ?? ""} />
            <Row label="Owner name" value={seller?.ownerName ?? ""} />
            <Row label="GSTIN" value={seller?.gstin ?? ""} />
            <Row label="PAN" value={seller?.pan ?? ""} />
            <Row label="Contact phone" value={seller?.contactPhone ?? ""} />
            <Row label="Registered address" value={seller?.businessAddress ?? ""} />
            <button
              onClick={() => toast.success("Profile change sent for verification")}
              className="mt-4 w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
            >
              Request update
            </button>
          </Card>
        )}

        {tab === "bank" && (
          <Card>
            <p className="mb-2 text-sm font-bold">Settlement bank account</p>
            <p className="mb-2 text-[10px] text-muted-foreground">Payouts land in this account.</p>
            <Row label="Beneficiary" value={bank?.beneficiaryName ?? "Not added"} />
            <Row label="Account number" value={bank?.accountNumberMasked ?? "Not added"} />
            <Row label="IFSC" value={bank?.ifsc ?? "Not added"} />
          </Card>
        )}

        {tab === "notifications" && (
          <Card>
            <p className="mb-2 text-sm font-bold">Notifications</p>
            {NOTIFICATIONS.map((label) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-border py-3 last:border-0"
              >
                <span className="text-sm">{label}</span>
                <Toggle
                  label={label}
                  checked={enabled[label] ?? true}
                  onChange={(v) => setEnabled((e) => ({ ...e, [label]: v }))}
                />
              </div>
            ))}
          </Card>
        )}

        {tab === "appearance" && (
          <Card>
            <p className="text-sm font-bold">Appearance</p>
            <p className="mb-3 text-[10px] text-muted-foreground">
              Applies to this browser, on every console you sign in to.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm">
                Theme
                <br />
                <span className="text-[10px] text-muted-foreground">
                  Auto follows your device&apos;s light or dark setting.
                </span>
              </span>
              <ThemeSegmentedControl />
            </div>
          </Card>
        )}

        {tab === "users" && (
          <Card>
            <p className="mb-2 text-sm font-bold">Sub-users</p>
            <p className="mb-2 text-[10px] text-muted-foreground">
              Give staff limited access to orders and inventory.
            </p>
            <TextField
              label="Name"
              value={name}
              onChange={setName}
              placeholder="Staff name"
            />
            <TextField
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="staff@example.com"
            />
            <button
              disabled={!name.trim() || !email.trim()}
              onClick={() => {
                toast.success("Invite queued");
                setName("");
                setEmail("");
              }}
              className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
            >
              Invite
            </button>
          </Card>
        )}
      </div>
    </>
  );
}

export default SellerSettings;