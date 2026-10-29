"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Copy, KeyRound, RefreshCw } from "lucide-react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import {
  createDistrictAdminWithLogin,
  deleteDistrictAdmin,
  listAuditLogs,
  listPortalCredentials,
  normalizePhoneDigits,
  stateAdminConflictMessage,
  stateAdminDuplicateHint,
  updateDistrictAdmin,
} from "@/lib/api";
import { useMockLoading, useSellers, useDistrictAdmins } from "@/lib/api/hooks";
import { DISTRICTS, stateForDistrict } from "@/data/districts";
import type { PortalCredential, DistrictAdmin } from "@/data/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 12;
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";

function generatePassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

/** District picker grouped by parent state (production coverage: Tamil Nadu + Puducherry). */
function DistrictSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const groups = ["TN", "PY"] as const;
  const labels: Record<string, string> = { TN: "Tamil Nadu", PY: "Puducherry" };
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {groups.map((stateCode, index) => (
          <React.Fragment key={stateCode}>
            {index > 0 ? <SelectSeparator /> : null}
            <SelectGroup>
              <SelectLabel>{labels[stateCode]}</SelectLabel>
              {DISTRICTS.filter((d) => d.stateCode === stateCode).map((d) => (
                <SelectItem key={d.districtCode} value={d.districtCode}>
                  {d.name} · {d.districtCode}
                </SelectItem>
              ))}
            </SelectGroup>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}

function DistrictAdminAccounts() {
  const loading = useMockLoading();
  const admins = useDistrictAdmins();
  const sellers = useSellers();
  const [creds, setCreds] = useState<PortalCredential[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    districtCode: "TCH",
    issueLogin: true,
    password: "",
    forceChange: true, // locked ON for DISTRICT_ADMIN — the temp password is single-use
  });
  const [serverError, setServerError] = useState<{ field: "email" | "phone" | null; message: string } | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdWarnings, setCreatedWarnings] = useState<string[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DistrictAdmin | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", districtCode: "TCH" });
  const [query, setQuery] = useState("");

  // Portal logins drive the roster's login-status badges + the pre-submit one-person-one-role lint.
  useEffect(() => {
    let active = true;
    void listPortalCredentials().then((rows) => {
      if (active) setCreds(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  const loginEmails = new Set(creds.filter((c) => c.role === "DISTRICT_ADMIN").map((c) => c.email.toLowerCase()));
  const loginByEmail = (email: string) =>
    creds.find((c) => c.role === "DISTRICT_ADMIN" && c.email.toLowerCase() === email.toLowerCase());

  const phoneDigits = normalizePhoneDigits(form.phone);
  const duplicateHint = stateAdminDuplicateHint(form.email, form.phone, creds, sellers, admins);
  const passwordValid = !form.issueLogin || form.password.length >= MIN_PASSWORD;
  const valid =
    form.name.trim().length > 2 &&
    EMAIL_RE.test(form.email) &&
    phoneDigits.length === 10 &&
    passwordValid &&
    duplicateHint?.kind !== "error";

  const uncovered = DISTRICTS.filter(
    (d) => admins.filter((a) => a.districtCode === d.districtCode && a.active).length === 0,
  );
  const activeCount = admins.filter((a) => a.active).length;
  const covered = DISTRICTS.length - uncovered.length;
  const coveragePct = Math.round((covered / DISTRICTS.length) * 100);

  const q = query.trim().toLowerCase();
  const filtered = admins.filter(
    (a) =>
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.districtCode || a.stateCode || "").toLowerCase().includes(q),
  );

  async function handleCreate() {
    setCreating(true);
    setServerError(null);
    setCreatedWarnings(null);
    try {
      const { credential, warnings } = await createDistrictAdminWithLogin({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        districtCode: form.districtCode,
        issueLogin: form.issueLogin,
        password: form.issueLogin ? form.password : undefined,
      });
      if (credential) {
        setCreds((prev) => [credential, ...prev.filter((c) => c.id !== credential.id)]);
        setCreatedPassword(form.password);
      }
      if (warnings?.length) {
        setCreatedWarnings(warnings);
        toast.info("District admin created — shared phone", { description: warnings.join(" · ") });
      } else if (credential) {
        toast.success("District admin created with a portal login");
      } else {
        toast.success("District admin added to the roster (no login issued)");
      }
      setForm((f) => ({
        name: "",
        email: "",
        phone: "",
        districtCode: f.districtCode,
        issueLogin: true,
        password: generatePassword(),
        forceChange: true,
      }));
    } catch (err) {
      const conflict = stateAdminConflictMessage(err);
      setServerError(conflict);
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        toast.error("District admin blocked", { description: conflict.message });
      } else {
        toast.error("Could not create the district admin", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="District admins"
        description="A district may have several admins; each admin is locked to exactly one district."
      />

      <p className="text-[12px] text-muted-foreground">
        One form creates the roster row{" "}
        {form.issueLogin ? (
          <>
            and the portal login together. You can also{" "}
            <button type="button" className="font-semibold text-interactive underline" onClick={() => setForm((f) => ({ ...f, issueLogin: false, password: "" }))}>
              pre-provision without a login
            </button>
            <ComponentHelp id="pre-provision" label="About pre-provisioning an admin" />.
          </>
        ) : (
          <>
            without a login — that admin cannot sign in until you{" "}
            <Link href="/admin/super/credentials" className="font-semibold text-interactive">
              issue a portal login
            </Link>
            .
          </>
        )}
      </p>

      <div className="space-y-2 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-semibold">
            <span className="num">{covered}</span> / {DISTRICTS.length} districts covered
          </p>
          <p className="num text-[12px] text-muted-foreground">
            {activeCount} active admin{activeCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${coveragePct}%` }}
          />
        </div>
      </div>

      {uncovered.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px]">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <span className="text-muted-foreground">No active admin for</span>
          {uncovered.map((d) => (
            <button
              key={d.districtCode}
              type="button"
              title={`Create an admin for ${d.name}`}
              onClick={() => {
                setEditing(null);
                setForm((f) => ({ ...f, districtCode: d.districtCode }));
                document.getElementById("create-admin")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="num rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning transition-colors hover:bg-warning/20"
            >
              {d.districtCode}
            </button>
          ))}
          <span className="text-muted-foreground">— those districts have no one to review KYC or run campaigns.</span>
        </div>
      ) : null}

      <div id="create-admin">
        <SectionCard title="Create an admin account">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="adm-name">Name</Label>
            <Input
              id="adm-name"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setServerError(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adm-email">Email</Label>
            <Input
              id="adm-email"
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                setServerError(null);
              }}
              placeholder="admin.mh@faazio.dev"
              className={serverError?.field === "email" ? "border-destructive" : undefined}
            />
            {form.email && !EMAIL_RE.test(form.email) ? (
              <p className="text-[11px] text-destructive">Enter a valid email address.</p>
            ) : null}
            {duplicateHint?.field === "email" ? (
              <p className="text-[11px] text-destructive">Already in use — {duplicateHint.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adm-phone">Phone</Label>
            <Input
              id="adm-phone"
              className="num"
              value={form.phone}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                setServerError(null);
              }}
            />
            {form.phone && phoneDigits.length !== 10 ? (
              <p className="text-[11px] text-destructive">Enter a valid 10-digit Indian mobile number.</p>
            ) : null}
            {duplicateHint?.field === "phone" ? (
              <p className="flex items-start gap-1 text-[11px] text-warning">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                <span>{duplicateHint.message}</span>
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label>District</Label>
              <ComponentHelp id="district-select" label="About the district field" />
            </div>
            <DistrictSelect
              value={form.districtCode}
              onValueChange={(value) => setForm({ ...form, districtCode: value })}
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2">
            <label className="flex items-start gap-2.5 text-[13px]">
              <Checkbox
                className="mt-0.5"
                checked={form.issueLogin}
                onCheckedChange={(checked) => {
                  const issueLogin = checked === true;
                  setForm((f) => ({ ...f, issueLogin, password: issueLogin ? f.password : "" }));
                }}
              />
              <span>
                Issue portal login now
                <span className="block text-[11px] text-muted-foreground">
                  Creates the DISTRICT_ADMIN credential + temporary password in the same step. Uncheck to
                  pre-provision a roster-only row (they cannot sign in until you issue a login).
                </span>
              </span>
            </label>
            <ComponentHelp id="issue-login-toggle" label="About issuing a login" className="mt-0.5" />
          </div>

          {form.issueLogin ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="adm-password">Temporary password</Label>
                  <Input
                    id="adm-password"
                    className="num"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
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
                At least {MIN_PASSWORD} characters. Shown once — copy it before creating.
              </p>
              <label className="flex items-start gap-2.5 text-[13px]">
                <Checkbox className="mt-0.5" checked={form.forceChange} disabled />
                <span>
                  Require a password change on first sign-in
                  <span className="block text-[11px] text-muted-foreground">
                    Locked ON for district admins — the temporary password is single-use.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          {serverError ? (
            <p className="text-[12px] text-destructive">{serverError.message}</p>
          ) : null}
        </div>

        {createdPassword ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
            <div>
              <p className="text-[12px] font-semibold">Temporary password created</p>
              <p className="num text-[13px]">{createdPassword}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Shown only once. Copy it now — it is not stored by the server.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                void navigator.clipboard?.writeText(createdPassword);
                setCreatedPassword(null);
                toast.success("Copied");
              }}
            >
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
        ) : null}

        {createdWarnings?.length ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="text-[12px] font-semibold text-warning">Created — shared phone</p>
              <p className="text-[11px] text-muted-foreground">
                This phone already belongs to another account. You can still continue; confirm the
                intended owner if you did not expect this.
              </p>
              <ul className="mt-1 list-inside list-disc text-[11px] text-warning">
                {createdWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-1 text-[11px] font-semibold text-interactive underline"
                onClick={() => setCreatedWarnings(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-1.5">
          <ComponentHelp id="create-admin-button" label="About creating an admin" />
          <Button
            size="sm"
            disabled={!valid || creating}
            onClick={() => void handleCreate()}
          >
            {creating ? "Creating..." : "Create admin"}
          </Button>
        </div>
      </SectionCard>
      </div>

      <SectionCard
        title="Admin roster"
        description={query ? `${filtered.length} of ${admins.length} admins` : undefined}
        bodyClassName="p-0"
        actions={
          <div className="flex items-center gap-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email or code..."
              className="h-8 w-56 text-[12px]"
              aria-label="Search admin roster"
            />
            <ComponentHelp id="roster-search" label="About the roster search" />
          </div>
        }
      >
        <DataShell
          loading={loading}
          isEmpty={filtered.length === 0}
          empty={
            <EmptyState
              title={query ? "No matching admins" : "No admins yet"}
              description={
                query
                  ? "Try a different name, email or district code."
                  : "Create the first district admin above."
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((admin) => {
                const hasLogin = loginEmails.has(admin.email.toLowerCase());
                const login = loginByEmail(admin.email);
                return (
                  <TableRow key={admin.adminId} className="h-12">
                    <TableCell className="num text-[13px] font-semibold">
                      {admin.districtCode || admin.stateCode || "—"}
                      {admin.districtCode ? (
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          {stateForDistrict(admin.districtCode)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-[13px] font-medium">{admin.name}</TableCell>
                    <TableCell className="num text-[12px]">{admin.email}</TableCell>
                    <TableCell className="num text-[12px]">{admin.phone}</TableCell>
                    <TableCell className="num text-[12px]">{formatDate(admin.createdAt)}</TableCell>
                    <TableCell className="num text-[12px] text-muted-foreground">
                      {formatDateTime(admin.lastActiveAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusPill status={admin.active ? "ACTIVE" : "DEACTIVATED"} />
                        {hasLogin ? (
                          <StatusPill status={login?.mustChange ? "TEMP PASSWORD" : "LOGIN"} />
                        ) : (
                          <StatusPill status="NO LOGIN" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(admin);
                            setDraft({
                              name: admin.name,
                              email: admin.email,
                              phone: admin.phone,
                              districtCode: admin.districtCode,
                            });
                          }}
                        >
                          Edit
                        </Button>
                        {!hasLogin ? (
                          <Link href={`/admin/super/credentials?email=${encodeURIComponent(admin.email)}&role=DISTRICT_ADMIN`}>
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <KeyRound className="size-3.5" /> Issue login
                            </Button>
                          </Link>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            updateDistrictAdmin(admin.adminId, { active: !admin.active });
                            toast.success(admin.active ? "Admin deactivated" : "Admin reactivated");
                          }}
                        >
                          {admin.active ? "Deactivate" : "Reactivate"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {admin.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes their access to {admin.districtCode} permanently
                                {hasLogin ? " and revokes their portal login" : ""}. Their past actions
                                stay in the audit log for 7 days.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  deleteDistrictAdmin(admin.adminId);
                                  setCreds((prev) => prev.filter((c) => c.email.toLowerCase() !== admin.email.toLowerCase()));
                                  toast.success("Admin deleted");
                                }}
                              >
                                Delete admin
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Sheet open={Boolean(editing)} onOpenChange={(next) => !next && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit admin</SheetTitle>
            <SheetDescription>{editing?.adminId}</SheetDescription>
          </SheetHeader>
          {editing ? (
            <div className="space-y-4 px-4 pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  className="num"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>District</Label>
                <DistrictSelect
                  value={draft.districtCode}
                  onValueChange={(value) => setDraft({ ...draft, districtCode: value })}
                />
              </div>
              <Button
                size="sm"
                disabled={!EMAIL_RE.test(draft.email) || draft.name.trim().length < 3}
                onClick={() => {
                  updateDistrictAdmin(editing.adminId, draft);
                  toast.success("Admin updated");
                  setEditing(null);
                }}
              >
                Save changes
              </Button>

              <div>
                <p className="mb-2 text-[12px] font-semibold">Recent activity</p>
                <ul className="space-y-1">
                  {listAuditLogs({ query: editing.adminId })
                    .slice(0, 6)
                    .map((log) => (
                      <li key={log.logId} className="num text-[11px] text-muted-foreground">
                        {formatDateTime(log.createdAt)} — {log.action} on {log.entityId}
                      </li>
                    ))}
                  {listAuditLogs({ query: editing.adminId }).length === 0 ? (
                    <li className="text-[12px] text-muted-foreground">No recorded actions yet.</li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default DistrictAdminAccounts;