"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SellerCredentialCard } from "@/components/patterns/SellerCredentialCard";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import { useSellers } from "@/lib/api/hooks";
import {
  createPortalCredential,
  fetchSellers,
  listPortalCredentials,
  resetPortalCredentialPassword,
  setPortalCredentialActive,
  districtAdminConflictMessage,
  type CreatePortalCredentialInput,
} from "@/lib/api";
import { useDistricts } from "@/lib/api/hooks";
import type { PortalCredential, Role, SellerLoginCredential } from "@/data/types";
import { remoteConfigured } from "@/lib/config";
import { usePortalStore } from "@/lib/api/store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 12;
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";

function generatePassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

function scopeLabel(c: PortalCredential): string {
  if (c.role === "SELLER") return c.sellerId ?? "—";
  if (c.role === "DISTRICT_ADMIN") return c.districtCode ?? c.stateCode ?? "—";
  return "Global";
}

function roleLabel(role: Role): string {
  return role === "SELLER" ? "Seller" : role === "DISTRICT_ADMIN" ? "District admin" : "Super admin";
}

function CredentialsPage() {
  const sellers = useSellers();
  const districts = useDistricts();
  const [creds, setCreds] = useState<PortalCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreatePortalCredentialInput>({
    email: "",
    name: "",
    role: "SELLER",
    sellerId: "",
    districtCode: "",
    password: "",
    forceChange: true,
  });
  const [resetting, setResetting] = useState<PortalCredential | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetForceChange, setResetForceChange] = useState(true);
  const [busy, setBusy] = useState(false);
  // A password minted for a "ready to share" seller login: held in memory only, so the admin can
  // copy / WhatsApp it once. Nothing here is read back from the server (only the Argon2id hash is
  // stored), which is why an unshared login is re-passworded rather than revealed.
  const [shared, setShared] = useState<{
    id: string;
    email: string;
    businessName: string;
    phone?: string | undefined;
    credential: SellerLoginCredential;
  } | null>(null);
  const [minting, setMinting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCreds(await listPortalCredentials());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load credentials.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Seller roster: the store is hydrated once at login (hydrateFromGateway); the DB is the
  // authority, so re-fetch live on mount so the seller <Select> reflects the DB. Best-effort —
  // keep the hydrated/seed roster when the gateway is absent or the call fails.
  useEffect(() => {
    if (!remoteConfigured()) return;
    let active = true;
    void fetchSellers()
      .then((rows) => {
        if (!active) return;
        usePortalStore.getState().set(() => ({ sellers: rows }));
      })
      .catch(() => {
        /* keep the hydrated/seed roster */
      });
    return () => {
      active = false;
    };
  }, []);

  // Deep link from the district-admins "Issue login" action: prefill the create sheet for that email.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email");
    const role = params.get("role");
    const district = params.get("district");
    if (!email || role !== "DISTRICT_ADMIN") return;
    setForm((f) => ({
      ...f,
      email,
      role: "DISTRICT_ADMIN",
      districtCode: district ?? "",
      password: generatePassword(),
    }));
    setCreateOpen(true);
    const clean = window.location.pathname;
    window.history.replaceState(null, "", clean);
  }, []);

  // Seller owner logins that were minted on approval but never signed in: their one-time password
  // was shown to whoever approved the application, so a super-admin may still need to hand it over.
  // Sub-user rows (subRole) are excluded — those invitees set their own password.
  const awaitingShare = creds.filter(
    (c) => c.role === "SELLER" && c.active && !c.lastLoginAt && !c.subRole,
  );

  const createValid =
    EMAIL_RE.test(form.email.trim()) &&
    form.name.trim().length >= 2 &&
    form.password.length >= MIN_PASSWORD &&
    (form.role === "SELLER" ? Boolean(form.sellerId) : Boolean(form.districtCode));

  async function submitCreate() {
    setBusy(true);
    try {
      const created = await createPortalCredential({
        email: form.email.trim(),
        name: form.name.trim(),
        role: form.role,
        sellerId: form.role === "SELLER" ? form.sellerId : undefined,
        districtCode: form.role === "DISTRICT_ADMIN" ? form.districtCode : undefined,
        password: form.password,
        forceChange: form.forceChange,
      });
      setCreds((prev) => [created, ...prev]);
      setCreateOpen(false);
      setForm({
        email: "",
        name: "",
        role: "SELLER",
        sellerId: "",
        districtCode: "",
        password: "",
        forceChange: true,
      });
      toast.success(
        form.forceChange
          ? "Credential created — share the temporary password once."
          : "Credential created — the password is active now.",
      );
    } catch (err) {
      const conflict = districtAdminConflictMessage(err);
      toast.error("Could not create the credential", {
        description: err instanceof ApiError ? conflict.message : err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: PortalCredential) {
    try {
      await setPortalCredentialActive(c.id, !c.active);
      setCreds((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !c.active } : x)));
      toast.success(c.active ? "Credential deactivated" : "Credential reactivated");
    } catch (err) {
      toast.error("Could not update the credential", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  /**
   * Mint a fresh temporary password for an auto-provisioned seller login that has not been used yet,
   * so the super-admin can hand it over (copy / WhatsApp) from the dashboard. This is a real password
   * reset — the previous temporary password stops working immediately — because the stored value is
   * only an Argon2id hash and can never be read back.
   */
  async function mintShareLogin(c: PortalCredential) {
    const seller = sellers.find((s) => s.sellerId === c.sellerId);
    setMinting(c.id);
    try {
      const password = generatePassword();
      await resetPortalCredentialPassword(c.id, password, { forceChange: true });
      setCreds((prev) => prev.map((x) => (x.id === c.id ? { ...x, mustChange: true } : x)));
      setShared({
        id: c.id,
        email: c.email,
        businessName: seller?.businessName ?? c.name,
        phone: seller?.contactPhone,
        credential: { email: c.email, temporaryPassword: password, created: true },
      });
    } catch (err) {
      toast.error("Could not prepare a shareable password", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setMinting(null);
    }
  }

  async function submitReset() {
    if (!resetting) return;
    setBusy(true);
    try {
      const { mustChange } = await resetPortalCredentialPassword(resetting.id, newPassword, {
        forceChange: resetForceChange,
      });
      setCreds((prev) => prev.map((x) => (x.id === resetting.id ? { ...x, mustChange } : x)));
      setResetting(null);
      setNewPassword("");
      toast.success(
        mustChange
          ? "Temporary password set — share it once."
          : "Password updated — sessions were revoked.",
      );
    } catch (err) {
      toast.error("Could not reset the password", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Portal credentials"
        description="Issue seller and state-admin logins, and reset the password for any role. New superadmins are seeded operationally."
        actions={
          <div className="flex items-center gap-1.5">
            <ComponentHelp id="issue-login" label="About issuing a login" />
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                setForm((f) => ({ ...f, password: generatePassword() }));
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" /> New credential
            </Button>
          </div>
        }
      />

      <SectionCard
        title="Ready to share"
        description="Seller logins auto-provisioned when an application was approved that nobody has signed in to yet. Prepare a password to copy or send over WhatsApp."
        bodyClassName="p-0"
      >
        <DataShell
          loading={loading}
          error={error ?? undefined}
          isEmpty={awaitingShare.length === 0}
          empty={
            <EmptyState
              title="Nothing waiting"
              description="Approving a seller mints their login automatically — it will appear here until their first sign-in."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seller</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {awaitingShare.map((c) => {
                const seller = sellers.find((s) => s.sellerId === c.sellerId);
                return (
                  <TableRow key={c.id} className="h-12">
                    <TableCell className="text-[13px] font-medium">
                      {seller?.businessName ?? c.name ?? "—"}
                    </TableCell>
                    <TableCell className="num text-[12px]">{c.email}</TableCell>
                    <TableCell className="num text-[12px] text-muted-foreground">
                      {c.createdAt ? formatDateTime(c.createdAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={minting === c.id || shared?.id === c.id}
                        onClick={() => void mintShareLogin(c)}
                      >
                        <KeyRound className="size-3.5" />
                        {shared?.id === c.id
                          ? "Password ready"
                          : minting === c.id
                            ? "Preparing…"
                            : "Prepare password"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      {shared ? (
        <SectionCard
          title={`Share login for ${shared.businessName}`}
          description="This password is shown once and never stored in the clear."
        >
          <SellerCredentialCard
            credential={shared.credential}
            businessName={shared.businessName}
            phone={shared.phone}
          />
        </SectionCard>
      ) : null}

      <SectionCard title="Issued logins" bodyClassName="p-0">
        <DataShell
          loading={loading}
          error={error ?? undefined}
          isEmpty={creds.length === 0}
          empty={
            <EmptyState
              title="No credentials yet"
              description="Create a seller or state-admin login to give them portal access."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Actions
                    <ComponentHelp id="reset-password" label="About resetting a password" />
                    <ComponentHelp id="toggle-active" label="About deactivating a login" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creds.map((c) => (
                <TableRow key={c.id} className="h-12">
                  <TableCell className="text-[13px] font-medium">{roleLabel(c.role)}</TableCell>
                  <TableCell className="num text-[12px]">{scopeLabel(c)}</TableCell>
                  <TableCell className="text-[13px]">{c.name}</TableCell>
                  <TableCell className="num text-[12px]">{c.email}</TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {c.lastLoginAt ? formatDateTime(c.lastLoginAt) : "Never"}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <StatusPill status={c.active ? "ACTIVE" : "DEACTIVATED"} />
                    {c.mustChange ? <StatusPill status="TEMP PASSWORD" /> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          setResetting(c);
                          setNewPassword(generatePassword());
                          setResetForceChange(c.role !== "SUPER_ADMIN");
                        }}
                      >
                        <KeyRound className="size-3.5" /> Reset
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void toggleActive(c)}>
                        {c.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New portal credential</SheetTitle>
            <SheetDescription>
              The holder must change this temporary password on first sign-in.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Role</Label>
                <ComponentHelp id="role-select" label="About the credential role" />
              </div>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm({ ...form, role: value as "SELLER" | "DISTRICT_ADMIN" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELLER">Seller</SelectItem>
                  <SelectItem value="DISTRICT_ADMIN">District admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.role === "SELLER" ? (
              <div className="space-y-1.5">
                <Label>Seller</Label>
                <Select
                  value={form.sellerId}
                  onValueChange={(value) => setForm({ ...form, sellerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a seller" />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers.map((s) => (
                      <SelectItem key={s.sellerId} value={s.sellerId}>
                        {s.businessName} · {s.sellerId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>District</Label>
                  <Select
                    value={form.districtCode}
                    onValueChange={(value) => setForm({ ...form, districtCode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a district" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((d) => (
                        <SelectItem key={d.districtCode} value={d.districtCode}>
                          {d.name} · {d.districtCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  Tip: creating a district admin on{" "}
                  <Link href="/admin/super/district-admins" className="font-medium text-interactive">
                    District admins
                  </Link>{" "}
                  mints the roster row and login in one step, so they stay in sync.
                </p>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cred-name">Name</Label>
              <Input
                id="cred-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cred-email">Email</Label>
              <Input
                id="cred-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="partner@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cred-password">Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  id="cred-password"
                  className="num"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy password"
                  onClick={() => {
                    void navigator.clipboard?.writeText(form.password);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Regenerate password"
                  onClick={() => setForm({ ...form, password: generatePassword() })}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                At least {MIN_PASSWORD} characters. Copy it now; it is not shown again.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <label className="flex items-start gap-2.5 text-[13px]">
                <Checkbox
                  className="mt-0.5"
                  checked={form.forceChange}
                  onCheckedChange={(checked) => setForm({ ...form, forceChange: checked === true })}
                />
                <span>
                  Require a password change on first sign-in
                  <span className="block text-[11px] text-muted-foreground">
                    Recommended for seller and state-admin logins. Uncheck to activate this password
                    immediately.
                  </span>
                </span>
              </label>
              <ComponentHelp id="force-change" label="About forcing a password change" className="mt-0.5" />
            </div>
            <div className="flex items-center justify-end gap-2">
              <ComponentHelp id="create-credential" label="About creating a credential" />
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button disabled={!createValid || busy} onClick={() => void submitCreate()}>
                {busy ? "Creating..." : "Create credential"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(resetting)} onOpenChange={(next) => !next && setResetting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset password for {resetting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their current password and every active session stop working immediately.
              {resetting?.role === "SUPER_ADMIN"
                ? " The new password is active right away — the superadmin is not asked to change it."
                : resetForceChange
                  ? " They must change the temporary password on next sign-in."
                  : " The new password is active right away — no forced change."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="reset-password">
              {resetting?.role === "SUPER_ADMIN" ? "New password" : "Temporary password"}
            </Label>
            <Input
              id="reset-password"
              className="num"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          {resetting?.role === "SUPER_ADMIN" ? null : (
            <label className="flex items-start gap-2.5 pb-2 text-[13px]">
              <Checkbox
                className="mt-0.5"
                checked={resetForceChange}
                onCheckedChange={(checked) => setResetForceChange(checked === true)}
              />
              <span>
                Require a password change on first sign-in
                <span className="block text-[11px] text-muted-foreground">
                  Uncheck to activate this password immediately.
                </span>
              </span>
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={newPassword.length < MIN_PASSWORD || busy}
              onClick={() => void submitReset()}
            >
              {busy ? "Resetting…" : "Reset password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CredentialsPage;
