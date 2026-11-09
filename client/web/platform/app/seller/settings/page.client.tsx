"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  PageHeader,
  Card,
  TextField,
  Toggle,
  UnderlineTabs,
  PrimaryButton,
  SectionTitle,
  RadioRow,
  EmptyState,
} from "@/components/sellers/kit";
import { ThemeSegmentedControl } from "@/components/layout/ThemeToggle";
import {
  inviteSubUser,
  removeSubUser,
  updateNotificationPreferences,
  updateSeller,
  upsertBankAccount,
  type InviteSubUserInput,
} from "@/lib/api";
import {
  useBankAccount,
  useNotificationPreferences,
  usePortalLoading,
  useSeller,
  useSellerScope,
  useSubUsers,
} from "@/lib/api/hooks";
import type {
  BankAccountInput,
  NotificationKind,
  SellerProfilePatch,
  SubUserRole,
} from "@/data/types";

type Tab = "profile" | "bank" | "notifications" | "appearance" | "users";

const NOTIFICATIONS: { kind: NotificationKind; label: string; sub: string }[] = [
  { kind: "newOrder", label: "New order alerts", sub: "A new order lands in your queue" },
  { kind: "lowStock", label: "Low stock alerts", sub: "An item is running out" },
  { kind: "slaBreach", label: "SLA breach warnings", sub: "A pickup or delivery is at risk" },
  { kind: "campaigns", label: "Festival campaign news", sub: "Promotions you can join" },
];

const ROLES: { role: SubUserRole; label: string; sub: string }[] = [
  { role: "STAFF", label: "Staff", sub: "Orders and inventory" },
  { role: "VIEWER", label: "Viewer", sub: "Read-only access" },
];

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "bank", label: "Bank" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "users", label: "Sub-users" },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING_INVITE: "Invite pending",
  ACTIVE: "Active",
  REVOKED: "Revoked",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value || "—"}</span>
    </div>
  );
}

function SellerSettings() {
  const { sellerId } = useSellerScope();
  const seller = useSeller(sellerId);
  const loading = usePortalLoading();

  const { account: bank, loading: bankLoading } = useBankAccount(sellerId);
  const subUsers = useSubUsers(sellerId);
  const preferences = useNotificationPreferences();

  const [tab, setTab] = useState<Tab>("profile");

  const [profileDraft, setProfileDraft] = useState<SellerProfilePatch | null>(null);
  const [bankDraft, setBankDraft] = useState<BankAccountInput | null>(null);
  const [invite, setInvite] = useState<InviteSubUserInput>({ name: "", email: "", role: "STAFF" });

  const startProfileEdit = () => {
    if (!seller) return;
    setProfileDraft({
      businessName: seller.businessName,
      ownerName: seller.ownerName,
      gstin: seller.gstin,
      pan: seller.pan,
      contactPhone: seller.contactPhone,
      businessAddress: seller.businessAddress,
    });
  };

  const saveProfile = () => {
    if (!profileDraft || !sellerId) return;
    updateSeller(sellerId, profileDraft);
    toast.success("Profile update submitted", {
      description: "KYC-bearing changes re-enter admin verification.",
    });
    setProfileDraft(null);
  };

  const startBankEdit = () => {
    setBankDraft({
      bankName: bank?.bankName ?? "",
      accountNumber: bank?.accountNumberMasked ?? "",
      ifsc: bank?.ifsc ?? "",
      beneficiaryName: bank?.beneficiaryName ?? "",
    });
  };

  const saveBank = () => {
    if (!bankDraft || !sellerId) return;
    if (!bankDraft.beneficiaryName.trim()) {
      toast.error("Enter the beneficiary name");
      return;
    }
    if (!bankDraft.accountNumber.trim()) {
      toast.error("Enter the account number");
      return;
    }
    if (bankDraft.ifsc.trim().length !== 11) {
      toast.error("Enter an 11-character IFSC");
      return;
    }
    upsertBankAccount(sellerId, bankDraft);
    toast.success("Bank account saved");
    setBankDraft(null);
  };

  const sendInvite = () => {
    if (!sellerId) return;
    if (!invite.name.trim() || !invite.email.trim()) {
      toast.error("Enter a name and email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) {
      toast.error("Enter a valid email");
      return;
    }
    inviteSubUser(sellerId, invite);
    toast.success("Invite sent", { description: `An invite will go to ${invite.email.trim()}.` });
    setInvite({ name: "", email: "", role: "STAFF" });
  };

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
            {loading && !seller ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-9 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : profileDraft ? (
              <>
                <TextField
                  label="Business name"
                  value={profileDraft.businessName ?? ""}
                  onChange={(v) => setProfileDraft({ ...profileDraft, businessName: v })}
                />
                <TextField
                  label="Owner name"
                  value={profileDraft.ownerName ?? ""}
                  onChange={(v) => setProfileDraft({ ...profileDraft, ownerName: v })}
                />
                <TextField
                  label="GSTIN"
                  value={profileDraft.gstin ?? ""}
                  onChange={(v) => setProfileDraft({ ...profileDraft, gstin: v.toUpperCase() })}
                />
                <TextField
                  label="PAN"
                  value={profileDraft.pan ?? ""}
                  onChange={(v) => setProfileDraft({ ...profileDraft, pan: v.toUpperCase() })}
                />
                <TextField
                  label="Contact phone"
                  value={profileDraft.contactPhone ?? ""}
                  onChange={(v) => setProfileDraft({ ...profileDraft, contactPhone: v })}
                  type="tel"
                />
                <TextField
                  label="Registered address"
                  value={profileDraft.businessAddress ?? ""}
                  onChange={(v) => setProfileDraft({ ...profileDraft, businessAddress: v })}
                />
                <div className="mt-3 flex gap-2">
                  <PrimaryButton variant="outline" className="flex-1" onClick={() => setProfileDraft(null)}>
                    Cancel
                  </PrimaryButton>
                  <PrimaryButton className="flex-1" onClick={saveProfile}>
                    Save changes
                  </PrimaryButton>
                </div>
              </>
            ) : (
              <>
                <Row label="Business name" value={seller?.businessName ?? ""} />
                <Row label="Owner name" value={seller?.ownerName ?? ""} />
                <Row label="GSTIN" value={seller?.gstin ?? ""} />
                <Row label="PAN" value={seller?.pan ?? ""} />
                <Row label="Contact phone" value={seller?.contactPhone ?? ""} />
                <Row label="Registered address" value={seller?.businessAddress ?? ""} />
                <PrimaryButton className="mt-4 w-full" onClick={startProfileEdit} disabled={!seller}>
                  Edit profile
                </PrimaryButton>
              </>
            )}
          </Card>
        )}

        {tab === "bank" && (
          <Card>
            <p className="mb-2 text-sm font-bold">Settlement bank account</p>
            <p className="mb-2 text-[10px] text-muted-foreground">
              Payouts land in this account. Only the masked tail is stored.
            </p>
            {bankDraft ? (
              <>
                <TextField
                  label="Beneficiary name"
                  value={bankDraft.beneficiaryName}
                  onChange={(v) => setBankDraft({ ...bankDraft, beneficiaryName: v })}
                  placeholder="Name on the account"
                />
                <TextField
                  label="Account number"
                  value={bankDraft.accountNumber}
                  onChange={(v) => setBankDraft({ ...bankDraft, accountNumber: v })}
                  placeholder="Account number"
                />
                <TextField
                  label="IFSC"
                  value={bankDraft.ifsc}
                  onChange={(v) => setBankDraft({ ...bankDraft, ifsc: v.toUpperCase() })}
                  placeholder="HDFC0001234"
                />
                <TextField
                  label="Bank name (optional)"
                  value={bankDraft.bankName ?? ""}
                  onChange={(v) => setBankDraft({ ...bankDraft, bankName: v })}
                />
                <div className="mt-3 flex gap-2">
                  <PrimaryButton variant="outline" className="flex-1" onClick={() => setBankDraft(null)}>
                    Cancel
                  </PrimaryButton>
                  <PrimaryButton className="flex-1" onClick={saveBank}>
                    Save account
                  </PrimaryButton>
                </div>
              </>
            ) : bankLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : bank ? (
              <>
                <Row label="Beneficiary" value={bank.beneficiaryName} />
                <Row label="Account number" value={bank.accountNumberMasked} />
                <Row label="IFSC" value={bank.ifsc} />
                {bank.bankName ? <Row label="Bank" value={bank.bankName} /> : null}
                <PrimaryButton className="mt-4 w-full" onClick={startBankEdit}>
                  Change account
                </PrimaryButton>
              </>
            ) : (
              <>
                <EmptyState text="No settlement account yet — add one to receive payouts." />
                <PrimaryButton className="w-full" onClick={startBankEdit}>
                  Add settlement account
                </PrimaryButton>
              </>
            )}
          </Card>
        )}

        {tab === "notifications" && (
          <Card>
            <p className="mb-2 text-sm font-bold">Notifications</p>
            <p className="mb-1 text-[10px] text-muted-foreground">
              Choose which alerts you want to receive.
            </p>
            {NOTIFICATIONS.map(({ kind, label, sub }) => (
              <div
                key={kind}
                className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
              >
                <span>
                  <span className="block text-sm">{label}</span>
                  <span className="block text-[11px] text-muted-foreground">{sub}</span>
                </span>
                <Toggle
                  label={label}
                  checked={preferences[kind]}
                  onChange={(v) => updateNotificationPreferences({ [kind]: v } as Partial<typeof preferences>)}
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
          <>
            <Card>
              <p className="mb-2 text-sm font-bold">Invite a sub-user</p>
              <p className="mb-2 text-[10px] text-muted-foreground">
                Give staff limited access to orders and inventory.
              </p>
              <TextField
                label="Name"
                value={invite.name}
                onChange={(v) => setInvite({ ...invite, name: v })}
                placeholder="Staff name"
              />
              <TextField
                label="Email"
                value={invite.email}
                onChange={(v) => setInvite({ ...invite, email: v })}
                placeholder="staff@example.com"
                type="email"
              />
              <SectionTitle>Role</SectionTitle>
              <div className="rounded-xl border border-border">
                {ROLES.map(({ role, label, sub }) => (
                  <RadioRow
                    key={role}
                    label={label}
                    sub={sub}
                    checked={invite.role === role}
                    onClick={() => setInvite({ ...invite, role })}
                  />
                ))}
              </div>
              <PrimaryButton
                className="mt-4 w-full"
                onClick={sendInvite}
                disabled={!invite.name.trim() || !invite.email.trim()}
              >
                Send invite
              </PrimaryButton>
            </Card>

            <Card>
              <p className="mb-2 text-sm font-bold">Sub-users</p>
              {subUsers.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">
                  No sub-users yet — invite your first team member above.
                </p>
              ) : (
                subUsers.map((user) => (
                  <div
                    key={user.subUserId}
                    className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{user.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {user.email} · {user.role === "STAFF" ? "Staff" : "Viewer"} ·{" "}
                        {STATUS_LABEL[user.status] ?? user.status}
                      </span>
                    </span>
                    <button
                      onClick={() => {
                        removeSubUser(user.subUserId);
                        toast.success("Sub-user revoked");
                      }}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}

export default SellerSettings;
