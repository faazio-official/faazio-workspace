"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Sheet,
} from "@/components/sellers/kit";
import { ThemeSegmentedControl } from "@/components/layout/ThemeToggle";
import {
  inviteSubUser,
  removeSubUser,
  signIn,
  signOut,
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
import { hydrateFromGateway } from "@/lib/api/sync";
import { useSession } from "@/lib/hooks/useSession";
import { changePortalEmail, changePortalPassword, PortalError } from "@/lib/portal/auth";
import type {
  BankAccountInput,
  NotificationKind,
  SellerProfilePatch,
  SubUserRole,
} from "@/data/types";

type Tab = "profile" | "bank" | "notifications" | "appearance" | "users" | "security";

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
  { key: "security", label: "Security" },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING_INVITE: "Invite pending",
  ACTIVE: "Active",
  REVOKED: "Revoked",
};

/** Surface the specific server validation code instead of the generic fallback. */
function passwordErrorMessage(err: unknown): string {
  if (err instanceof PortalError) {
    if (err.code === "weak_password") {
      return "Use a stronger, different password: at least 12 characters, not a common value.";
    }
    if (err.code === "invalid_current_password") {
      return "Your current password is incorrect.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Could not change the password.";
}

function emailErrorMessage(err: unknown): string {
  if (err instanceof PortalError) {
    if (err.code === "email_taken") return "That email already has a login.";
    if (err.code === "invalid_current_password") return "Your current password is incorrect.";
    if (err.code === "email_unchanged") return "That is already your email.";
    if (err.code === "bad_request") return "Enter a valid email address.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Could not change the email.";
}

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
  const session = useSession();
  const router = useRouter();

  const { account: bank, loading: bankLoading } = useBankAccount(sellerId);
  const subUsers = useSubUsers(sellerId);
  const preferences = useNotificationPreferences();

  const [tab, setTab] = useState<Tab>("profile");

  const [profileDraft, setProfileDraft] = useState<SellerProfilePatch | null>(null);
  const [bankDraft, setBankDraft] = useState<BankAccountInput | null>(null);
  const [invite, setInvite] = useState<InviteSubUserInput>({ name: "", email: "", role: "STAFF" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [bankBusy, setBankBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);

  // Security — email edit runs in a sheet (re-auth popup); password edit is an inline form.
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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

  const saveProfile = async () => {
    if (!profileDraft || !sellerId || !seller || profileBusy) return;
    // Send only what changed so a phone-only edit can never clear the stored GSTIN/PAN/address and
    // so the server only re-queues for review when a KYC field actually changed.
    const patch: SellerProfilePatch = {};
    const changed = (draft: string | undefined, current: string) => (draft ?? "") !== current;
    if (changed(profileDraft.businessName, seller.businessName)) {
      patch.businessName = profileDraft.businessName ?? "";
    }
    if (changed(profileDraft.ownerName, seller.ownerName)) {
      patch.ownerName = profileDraft.ownerName ?? "";
    }
    if (changed(profileDraft.gstin, seller.gstin)) patch.gstin = profileDraft.gstin ?? "";
    if (changed(profileDraft.pan, seller.pan)) patch.pan = profileDraft.pan ?? "";
    if (changed(profileDraft.businessAddress, seller.businessAddress)) {
      patch.businessAddress = profileDraft.businessAddress ?? "";
    }
    if (changed(profileDraft.contactPhone, seller.contactPhone)) {
      patch.contactPhone = profileDraft.contactPhone ?? "";
    }
    if (Object.keys(patch).length === 0) {
      setProfileDraft(null);
      return;
    }
    const kycChanged = patch.gstin !== undefined || patch.pan !== undefined || patch.businessAddress !== undefined;
    setProfileBusy(true);
    try {
      await updateSeller(sellerId, patch);
      toast.success("Profile update submitted", {
        description: kycChanged
          ? "KYC-bearing changes re-enter admin verification."
          : "Your profile has been updated.",
      });
      setProfileDraft(null);
    } catch (err) {
      toast.error("Profile update failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setProfileBusy(false);
    }
  };

  const startBankEdit = () => {
    setBankDraft({
      bankName: bank?.bankName ?? "",
      accountNumber: bank?.accountNumberMasked ?? "",
      ifsc: bank?.ifsc ?? "",
      beneficiaryName: bank?.beneficiaryName ?? "",
    });
  };

  const saveBank = async () => {
    if (!bankDraft || !sellerId || bankBusy) return;
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
    setBankBusy(true);
    try {
      await upsertBankAccount(sellerId, bankDraft);
      toast.success("Bank account saved");
      setBankDraft(null);
    } catch (err) {
      toast.error("Bank account update failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBankBusy(false);
    }
  };

  const sendInvite = async () => {
    if (!sellerId || inviteBusy) return;
    if (!invite.name.trim() || !invite.email.trim()) {
      toast.error("Enter a name and email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) {
      toast.error("Enter a valid email");
      return;
    }
    const email = invite.email.trim();
    setInviteBusy(true);
    try {
      await inviteSubUser(sellerId, invite);
      toast.success("Invite sent", { description: `An invite will go to ${email}.` });
      setInvite({ name: "", email: "", role: "STAFF" });
    } catch (err) {
      toast.error("Invite failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const openEmailSheet = () => {
    setNewEmail(session?.email ?? "");
    setEmailPassword("");
    setEmailError(null);
    setEmailOpen(true);
  };

  const saveEmail = async () => {
    setEmailError(null);
    const email = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (!emailPassword) {
      setEmailError("Enter your current password to confirm.");
      return;
    }
    setEmailBusy(true);
    try {
      await changePortalEmail(emailPassword, email);
    } catch (err) {
      setEmailError(emailErrorMessage(err));
      setEmailBusy(false);
      return;
    }
    // The gateway revoked every session (the sign-in identity changed) — mint a fresh one with the
    // new email + the password just entered, then resync the hydrated slices, so the operator stays
    // signed in on this device without a zombie session.
    try {
      await signIn(email, emailPassword);
      await hydrateFromGateway();
      setEmailOpen(false);
      setNewEmail("");
      setEmailPassword("");
      toast.success("Email updated", { description: `You now sign in with ${email}.` });
    } catch {
      await signOut();
      toast.success("Email updated — sign in again with the new email.");
      router.push("/login");
    } finally {
      setEmailBusy(false);
    }
  };

  const savePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Fill in all three password fields.");
      return;
    }
    if (newPassword.length < 12) {
      setPasswordError("Use at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("Choose a different password.");
      return;
    }
    if (!session?.email) {
      setPasswordError("Your session email is unavailable — sign in again.");
      return;
    }
    setPasswordBusy(true);
    // changePortalPassword revokes every refresh session and denylists the current access token, so
    // re-authenticate in place with the new password (do NOT signOut — that would drop this device's
    // push token for a voluntary rotation).
    try {
      await changePortalPassword(currentPassword, newPassword);
    } catch (err) {
      setPasswordError(passwordErrorMessage(err));
      setPasswordBusy(false);
      return;
    }
    try {
      await signIn(session.email, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed", { description: "You are signed in with your new password." });
    } catch {
      await signOut();
      toast.success("Password changed — sign in again with the new password.");
      router.push("/login");
    } finally {
      setPasswordBusy(false);
    }
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
                  <PrimaryButton
                    variant="outline"
                    className="flex-1"
                    onClick={() => setProfileDraft(null)}
                    disabled={profileBusy}
                  >
                    Cancel
                  </PrimaryButton>
                  <PrimaryButton
                    className="flex-1"
                    onClick={() => void saveProfile()}
                    disabled={profileBusy}
                  >
                    {profileBusy ? "Saving..." : "Save changes"}
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
                  <PrimaryButton
                    variant="outline"
                    className="flex-1"
                    onClick={() => setBankDraft(null)}
                    disabled={bankBusy}
                  >
                    Cancel
                  </PrimaryButton>
                  <PrimaryButton
                    className="flex-1"
                    onClick={() => void saveBank()}
                    disabled={bankBusy}
                  >
                    {bankBusy ? "Saving..." : "Save account"}
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
                onClick={() => void sendInvite()}
                disabled={inviteBusy || !invite.name.trim() || !invite.email.trim()}
              >
                {inviteBusy ? "Sending..." : "Send invite"}
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
                        void (async () => {
                          try {
                            await removeSubUser(user.subUserId);
                            toast.success("Sub-user revoked");
                          } catch (err) {
                            toast.error("Revoke failed", {
                              description: err instanceof Error ? err.message : undefined,
                            });
                          }
                        })();
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

        {tab === "security" && (
          <>
            <Card>
              <p className="mb-2 text-sm font-bold">Sign-in email</p>
              <p className="mb-2 text-[10px] text-muted-foreground">
                This is the email you use to sign in. Changing it signs you out of your other devices.
              </p>
              <Row label="Email" value={session?.email ?? ""} />
              <PrimaryButton
                className="mt-4 w-full"
                onClick={openEmailSheet}
                disabled={!session?.email}
              >
                Change email
              </PrimaryButton>
            </Card>

            <Card>
              <p className="mb-2 text-sm font-bold">Change password</p>
              <p className="mb-2 text-[10px] text-muted-foreground">
                Enter your current password, then choose a new one. You stay signed in here.
              </p>
              <TextField
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
              />
              <TextField
                label="New password"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
              />
              <TextField
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
              />
              <p className="text-[11px] text-muted-foreground">
                At least 12 characters. Choose a strong, different password.
              </p>
              {passwordError ? (
                <p className="mt-2 text-[12px] text-destructive">{passwordError}</p>
              ) : null}
              <PrimaryButton
                className="mt-4 w-full"
                onClick={() => void savePassword()}
                disabled={passwordBusy}
              >
                {passwordBusy ? "Changing..." : "Update password"}
              </PrimaryButton>
            </Card>
          </>
        )}
      </div>

      <Sheet
        open={emailOpen}
        onClose={() => {
          if (!emailBusy) setEmailOpen(false);
        }}
        title="Change email"
        footer={
          <PrimaryButton
            className="w-full"
            onClick={() => void saveEmail()}
            disabled={
              emailBusy ||
              newEmail.trim().toLowerCase() === (session?.email ?? "").toLowerCase()
            }
          >
            {emailBusy ? "Saving..." : "Save email"}
          </PrimaryButton>
        }
      >
        <p className="mb-2 text-[11px] text-muted-foreground">
          For your security, confirm your current password before changing the email you sign in
          with.
        </p>
        <TextField
          label="New email"
          type="email"
          value={newEmail}
          onChange={setNewEmail}
          placeholder="you@example.com"
        />
        <TextField
          label="Current password"
          type="password"
          value={emailPassword}
          onChange={setEmailPassword}
        />
        {emailError ? <p className="mt-2 text-[12px] text-destructive">{emailError}</p> : null}
      </Sheet>
    </>
  );
}

export default SellerSettings;
