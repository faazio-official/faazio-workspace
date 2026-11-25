"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
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
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import { useSellers, useStates } from "@/lib/api/hooks";
import {
  createPortalCredential,
  deletePortalCredential,
  fetchSellers,
  listDeletedPortalCredentials,
  listPortalCredentials,
  resetPortalCredentialPassword,
  restorePortalCredential,
  setPortalCredentialActive,
  districtAdminConflictMessage,
  type CreatePortalCredentialInput,
} from "@/lib/api";
import { useDistricts } from "@/lib/api/hooks";
import type { PortalCredential, Role } from "@/data/types";
import { remoteConfigured } from "@/lib/config";
import { usePortalStore } from "@/lib/api/store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 12;
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";

/** Role tabs. Sellers and district admins are the two surfaces the superadmin works day to day; the
 *  seeded superadmins stay reachable from the same board so a lockout never needs SQL. */
const ROLE_TABS = [
  { value: "SELLER", label: "Sellers" },
  { value: "DISTRICT_ADMIN", label: "District admins" },
  { value: "SUPER_ADMIN", label: "Super admins" },
  { value: "ALL", label: "All" },
] as const;
type RoleTab = (typeof ROLE_TABS)[number]["value"];

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
  const states = useStates();
  const [creds, setCreds] = useState<PortalCredential[]>([]);
  const [trashed, setTrashed] = useState<PortalCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<RoleTab>("SELLER");
  const [showTrash, setShowTrash] = useState(false);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [districtFilter, setDistrictFilter] = useState("ALL");

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
  const [deleting, setDeleting] = useState<PortalCredential | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [live, trash] = await Promise.all([
        listPortalCredentials(),
        listDeletedPortalCredentials(),
      ]);
      setCreds(live);
      setTrashed(trash);
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
    setTab("DISTRICT_ADMIN");
    setCreateOpen(true);
    const clean = window.location.pathname;
    window.history.replaceState(null, "", clean);
  }, []);

  const visible = useMemo(
    () => (tab === "ALL" ? creds : creds.filter((c) => c.role === tab)),
    [creds, tab],
  );
  const visibleTrash = useMemo(
    () => (tab === "ALL" ? trashed : trashed.filter((c) => c.role === tab)),
    [trashed, tab],
  );
  const rows = showTrash ? visibleTrash : visible;

  // Scope joins: a seller login carries a sellerId (state/district live on the seller row); a
  // district-admin login carries a districtCode (its parent state comes from the district master).
  const sellerById = useMemo(() => new Map(sellers.map((s) => [s.sellerId, s] as const)), [sellers]);
  const districtState = useMemo(
    () => new Map(districts.map((d) => [d.districtCode, d.stateCode] as const)),
    [districts],
  );
  const stateOf = useCallback(
    (c: PortalCredential): string | undefined => {
      if (c.role === "SELLER") return c.sellerId ? sellerById.get(c.sellerId)?.stateCode : undefined;
      return (c.districtCode ? districtState.get(c.districtCode) : undefined) ?? c.stateCode;
    },
    [sellerById, districtState],
  );
  const districtOf = useCallback(
    (c: PortalCredential): string | undefined =>
      c.role === "SELLER" ? (c.sellerId ? sellerById.get(c.sellerId)?.districtCode : undefined) : c.districtCode,
    [sellerById],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      if (tab === "SELLER") {
        if (stateFilter !== "ALL" && stateOf(c) !== stateFilter) return false;
        if (districtFilter !== "ALL" && districtOf(c) !== districtFilter) return false;
      } else if (tab === "DISTRICT_ADMIN") {
        if (stateFilter !== "ALL" && stateOf(c) !== stateFilter) return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        roleLabel(c.role).toLowerCase().includes(q) ||
        scopeLabel(c).toLowerCase().includes(q)
      );
    });
  }, [rows, query, tab, stateFilter, districtFilter, stateOf, districtOf]);
  const filtersActive = Boolean(query.trim()) || stateFilter !== "ALL" || districtFilter !== "ALL";

  const counts = useMemo(() => {
    const live = { SELLER: 0, DISTRICT_ADMIN: 0, SUPER_ADMIN: 0 } as Record<string, number>;
    for (const c of creds) live[c.role] = (live[c.role] ?? 0) + 1;
    return live;
  }, [creds]);

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

  async function submitDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const { purgeAt } = await deletePortalCredential(deleting.id, deleteReason.trim());
      setCreds((prev) => prev.filter((x) => x.id !== deleting.id));
      setTrashed((prev) => [
        {
          ...deleting,
          active: false,
          deletedAt: new Date().toISOString(),
          ...(purgeAt ? { purgeAt } : {}),
          ...(deleteReason.trim() ? { deleteReason: deleteReason.trim() } : {}),
        },
        ...prev,
      ]);
      setDeleting(null);
      setDeleteReason("");
      toast.success("Credential deleted", {
        description: purgeAt
          ? `Restorable until ${formatDateTime(purgeAt)}, then removed permanently.`
          : "Restorable for 7 days, then removed permanently.",
      });
    } catch (err) {
      toast.error("Could not delete the credential", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitRestore(c: PortalCredential) {
    try {
      await restorePortalCredential(c.id);
      setTrashed((prev) => prev.filter((x) => x.id !== c.id));
      const { deletedAt: _deletedAt, purgeAt: _purgeAt, deleteReason: _deleteReason, ...live } = c;
      setCreds((prev) => [{ ...live, active: false }, ...prev]);
      toast.success("Credential restored", {
        description: "It is deactivated — reactivate it when the holder should sign in again.",
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === "trash_expired") {
        setTrashed((prev) => prev.filter((x) => x.id !== c.id));
      }
      toast.error("Could not restore the credential", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Portal credentials"
        description="Issue seller and district-admin logins, reset any password, and delete a credential with a 7-day undo. Seller logins are created when you approve an application."
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

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {ROLE_TABS.map((option) => (
            <FilterChip
              key={option.value}
              label={
                option.value === "ALL"
                  ? "All"
                  : `${option.label}${counts[option.value] ? ` · ${counts[option.value]}` : ""}`
              }
              active={tab === option.value}
              onClick={() => {
                setTab(option.value);
                setStateFilter("ALL");
                setDistrictFilter("ALL");
              }}
            />
          ))}
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <FilterChip
            label={showTrash ? "Deleted" : `Deleted${trashed.length ? ` · ${trashed.length}` : ""}`}
            active={showTrash}
            onClick={() => setShowTrash((v) => !v)}
          />
          <span className="ml-auto text-[11px] text-muted-foreground">
            {showTrash
              ? "Deleted logins are restorable for 7 days, then removed permanently."
              : "Deleting a login moves it to Deleted for 7 days."}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or scope..."
            className="h-8 w-64 text-[12px]"
            aria-label="Search credentials"
          />
          {tab === "SELLER" || tab === "DISTRICT_ADMIN" ? (
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="h-8 w-44 text-[12px]">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All states</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s.stateCode} value={s.stateCode}>
                    {s.stateCode} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {tab === "SELLER" ? (
            <Select value={districtFilter} onValueChange={setDistrictFilter}>
              <SelectTrigger className="h-8 w-48 text-[12px]">
                <SelectValue placeholder="District" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All districts</SelectItem>
                {districts
                  .filter((d) => stateFilter === "ALL" || d.stateCode === stateFilter)
                  .map((d) => (
                    <SelectItem key={d.districtCode} value={d.districtCode}>
                      {d.districtCode} · {d.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : null}
          {filtersActive ? (
            <span className="num text-[11px] text-muted-foreground">
              {filtered.length} of {rows.length} shown
            </span>
          ) : null}
        </div>

        <DataShell
          loading={loading}
          error={error ?? undefined}
          isEmpty={filtered.length === 0}
          empty={
            filtersActive ? (
              <EmptyState
                title="No matching credentials"
                description="Try a different search, state or district, or clear the filters."
              />
            ) : showTrash ? (
              <EmptyState
                title="Nothing deleted"
                description="Deleted logins appear here for 7 days so a mistake can be undone."
              />
            ) : (
              <EmptyState
                title="No credentials here"
                description={
                  tab === "SELLER"
                    ? "Approving a seller application mints their login — it will appear here."
                    : "Create a credential to give this role portal access."
                }
              />
            )
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>{showTrash ? "Deleted" : "Last sign-in"}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Actions
                    {showTrash ? (
                      <ComponentHelp id="trash-restore" label="About restoring a login" />
                    ) : (
                      <>
                        <ComponentHelp id="reset-password" label="About resetting a password" />
                        <ComponentHelp id="toggle-active" label="About deactivating a login" />
                        <ComponentHelp id="delete-credential" label="About deleting a login" />
                      </>
                    )}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="h-12">
                  <TableCell className="text-[13px] font-medium">{roleLabel(c.role)}</TableCell>
                  <TableCell className="num text-[12px]">{scopeLabel(c)}</TableCell>
                  <TableCell className="text-[13px]">{c.name}</TableCell>
                  <TableCell className="num text-[12px]">{c.email}</TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {showTrash
                      ? c.deletedAt
                        ? formatDateTime(c.deletedAt)
                        : "—"
                      : c.lastLoginAt
                        ? formatDateTime(c.lastLoginAt)
                        : "Never"}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {showTrash ? (
                      <>
                        <StatusPill status="DELETED" />
                        {c.purgeAt ? (
                          <span className="num text-[11px] text-muted-foreground">
                            purge {formatDateTime(c.purgeAt)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <StatusPill status={c.active ? "ACTIVE" : "DEACTIVATED"} />
                        {c.inviteStatus === "pending" ? (
                          <StatusPill status="PENDING_INVITE" />
                        ) : c.mustChange ? (
                          <StatusPill status="TEMP PASSWORD" />
                        ) : null}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {showTrash ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => void submitRestore(c)}
                      >
                        <RotateCcw className="size-3.5" /> Restore
                      </Button>
                    ) : (
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleting(c);
                            setDeleteReason("");
                          }}
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </Button>
                      </div>
                    )}
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
                    Recommended for seller and district-admin logins. Uncheck to activate this
                    password immediately.
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

      <AlertDialog open={Boolean(deleting)} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their login stops working immediately and every session is revoked. The credential
              moves to <span className="font-medium">Deleted</span> and can be restored for 7 days —
              after that it is permanently removed from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="delete-reason">Reason (optional)</Label>
            <Input
              id="delete-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. duplicate login created by mistake"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void submitDelete()}>
              {busy ? "Deleting…" : "Delete credential"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CredentialsPage;
