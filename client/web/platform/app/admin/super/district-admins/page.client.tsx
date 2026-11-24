"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, KeyRound, MailPlus, Plus } from "lucide-react";
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
import { ApiError, remote } from "@/lib/api/http";
import { remoteConfigured } from "@/lib/config";
import {
  deleteDistrictAdmin,
  districtAdminConflictMessage,
  districtAdminInviteUrl,
  listAuditLogs,
  listPortalCredentials,
  resendDistrictAdminInvite,
  updateDistrictAdmin,
} from "@/lib/api";
import { usePortalLoading, useSellers, useDistrictAdmins, useDistricts } from "@/lib/api/hooks";
import { usePortalStore } from "@/lib/api/store";
import { districtName } from "@/lib/api/reference";
import { DistrictAdminDrawer, VerticalAccessBadges } from "@/components/admin/DistrictAdminDrawer";
import type { PortalCredential, DistrictAdmin } from "@/data/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALL = "__all__";

function DistrictAdminAccounts() {
  const loading = usePortalLoading();
  const admins = useDistrictAdmins();
  const sellers = useSellers();
  const districts = useDistricts();
  const [creds, setCreds] = useState<PortalCredential[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<DistrictAdmin | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    phone: "",
    districtCode: "",
    martAccess: true,
    foodAccess: true,
    pharmaAccess: true,
  });
  const [query, setQuery] = useState("");
  const [districtFilter, setDistrictFilter] = useState<string>(ALL);
  // A chip on the uncovered list (or the drilldown) locks the drawer to one district; the header
  // button opens it unlocked so the picker inside can target any district.
  const [lockedDistrict, setLockedDistrict] = useState<string | undefined>(undefined);
  const [resending, setResending] = useState<string | null>(null);

  // Portal logins drive the roster's login/invite badges + the pre-submit one-person-one-role lint.
  useEffect(() => {
    let active = true;
    void listPortalCredentials()
      .then((rows) => {
        if (active) setCreds(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // DB-backed roster: refresh from the gateway when configured (the store is hydrated at login).
  useEffect(() => {
    if (!remoteConfigured()) return;
    let active = true;
    void remote
      .get<DistrictAdmin[]>("/district-admins")
      .then((rows) => {
        if (active) usePortalStore.getState().set(() => ({ districtAdmins: rows }));
      })
      .catch(() => {
        /* keep the hydrated roster */
      });
    return () => {
      active = false;
    };
  }, []);

  const loginByEmail = (email: string) =>
    creds.find((c) => c.role === "DISTRICT_ADMIN" && c.email.toLowerCase() === email.toLowerCase());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return admins.filter((a) => {
      if (districtFilter !== ALL && a.districtCode !== districtFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.districtCode ?? "").toLowerCase().includes(q)
      );
    });
  }, [admins, query, districtFilter]);

  // Coverage: every active district that has at least one active admin. It follows the district
  // filter, so picking one district reports that district's own coverage rather than the platform's.
  const coveredCodes = new Set(admins.filter((a) => a.active && a.districtCode).map((a) => a.districtCode));
  const activeDistricts = districts.length > 0 ? districts : [];
  const scopedDistricts =
    districtFilter === ALL ? activeDistricts : activeDistricts.filter((d) => d.districtCode === districtFilter);
  const covered = scopedDistricts.filter((d) => coveredCodes.has(d.districtCode)).length;
  const uncovered = scopedDistricts.filter((d) => !coveredCodes.has(d.districtCode));
  const totalDistricts = scopedDistricts.length;
  const activeCount = admins.filter((a) => a.active).length;
  const pendingCount = admins.filter((a) => {
    const login = loginByEmail(a.email);
    return (a.inviteStatus ?? login?.inviteStatus) === "pending";
  }).length;
  const coveragePct = totalDistricts ? Math.round((covered / totalDistricts) * 100) : 0;
  const scopeLabel = districtFilter === ALL ? null : districtName(districts, districtFilter);

  function openEdit(admin: DistrictAdmin) {
    setDraft({
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      districtCode: admin.districtCode,
      martAccess: admin.martAccess !== false,
      foodAccess: admin.foodAccess !== false,
      pharmaAccess: admin.pharmaAccess !== false,
    });
    setEditing(admin);
  }

  async function handleResend(admin: DistrictAdmin) {
    setResending(admin.adminId);
    try {
      const { inviteToken } = await resendDistrictAdminInvite(admin.adminId);
      const link = districtAdminInviteUrl(inviteToken);
      void navigator.clipboard?.writeText(link);
      toast.success("New invite link copied", {
        description: "The previous link no longer works. Send it to the admin.",
      });
    } catch (err) {
      toast.error("Could not resend the invite", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setResending(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="District admins"
        description="Assign admins to any district. A district can have several admins; each admin is scoped to exactly one district and the verticals you grant."
        actions={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setLockedDistrict(undefined);
              setDrawerOpen(true);
            }}
          >
            <Plus className="size-3.5" /> Assign admin
          </Button>
        }
      />

      <div className="space-y-2 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-medium">
            <span className="num">{covered}</span> / {totalDistricts}{" "}
            {districtFilter === ALL ? "district" : "selected district"} coverage
            {scopeLabel ? <span className="ml-1.5 text-[12px] text-muted-foreground">{scopeLabel}</span> : null}
          </p>
          <p className="num text-[12px] text-muted-foreground">
            {activeCount} active admin{activeCount === 1 ? "" : "s"}
            {pendingCount > 0 ? ` · ${pendingCount} pending invite${pendingCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full w-full origin-left rounded-full bg-primary transition-transform"
            style={{ transform: `scaleX(${coveragePct / 100})` }}
          />
        </div>
      </div>

      {uncovered.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-[13px]">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <span className="text-muted-foreground">No active admin for</span>
          {uncovered.slice(0, 12).map((d) => (
            <button
              key={d.districtCode}
              type="button"
              title={`Assign an admin for ${d.name}`}
              onClick={() => {
                setDistrictFilter(d.districtCode);
                setLockedDistrict(d.districtCode);
                setDrawerOpen(true);
              }}
              className="num rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning transition-colors hover:bg-warning/20"
            >
              {d.districtCode}
            </button>
          ))}
          {uncovered.length > 12 ? (
            <span className="text-[11px] text-muted-foreground">+{uncovered.length - 12} more</span>
          ) : null}
        </div>
      ) : null}

      <SectionCard
        title="Admin roster"
        description={query || districtFilter !== ALL ? `${filtered.length} of ${admins.length} admins` : undefined}
        bodyClassName="p-0"
        actions={
          <div className="flex items-center gap-1.5">
            <Select value={districtFilter} onValueChange={setDistrictFilter}>
              <SelectTrigger className="h-8 w-52 text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All districts</SelectItem>
                {districts.map((d) => (
                  <SelectItem key={d.districtCode} value={d.districtCode}>
                    {d.districtCode} · {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              title={query || districtFilter !== ALL ? "No matching admins" : "No admins yet"}
              description={
                query || districtFilter !== ALL
                  ? "Try a different name, email, district or clear the filter."
                  : "Assign the first district admin to cover KYC and campaigns."
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((admin) => {
                const login = loginByEmail(admin.email);
                const inviteStatus = admin.inviteStatus ?? login?.inviteStatus;
                const expiresAt = admin.inviteExpiresAt ?? login?.inviteExpiresAt;
                // A pending invite whose link has passed its expiry is shown as expired; the server
                // still treats the row as 'pending', so rotating it mints a fresh link.
                const inviteExpired =
                  inviteStatus === "pending" && Boolean(expiresAt) && new Date(expiresAt!).getTime() < Date.now();
                const hasLogin = Boolean(login) || inviteStatus === "pending";
                return (
                  <TableRow key={admin.adminId} className="h-12">
                    <TableCell className="text-[13px] font-medium">
                      {admin.districtCode ? (
                        <>
                          <span className="num">{admin.districtCode}</span>
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            {districtName(districts, admin.districtCode)}
                          </span>
                        </>
                      ) : (
                        <span className="num">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] font-medium">{admin.name}</TableCell>
                    <TableCell className="num text-[12px]">{admin.email}</TableCell>
                    <TableCell>
                      <VerticalAccessBadges
                        martAccess={admin.martAccess}
                        foodAccess={admin.foodAccess}
                        pharmaAccess={admin.pharmaAccess}
                      />
                    </TableCell>
                    <TableCell className="num text-[12px]">{formatDate(admin.createdAt)}</TableCell>
                    <TableCell className="num text-[12px] text-muted-foreground">
                      {formatDateTime(admin.lastActiveAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusPill status={admin.active ? "ACTIVE" : "DEACTIVATED"} />
                        {inviteExpired ? (
                          <StatusPill status="INVITE EXPIRED" />
                        ) : inviteStatus === "pending" ? (
                          <StatusPill status="PENDING_INVITE" />
                        ) : login?.mustChange ? (
                          <StatusPill status="TEMP PASSWORD" />
                        ) : hasLogin ? (
                          <StatusPill status="LOGIN" />
                        ) : (
                          <StatusPill status="NO LOGIN" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(admin)}>
                          Edit
                        </Button>
                        {inviteStatus === "pending" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={resending === admin.adminId}
                            onClick={() => void handleResend(admin)}
                          >
                            <MailPlus className="size-3.5" /> New invite link
                          </Button>
                        ) : null}
                        {!hasLogin ? (
                          <Link
                            href={`/admin/super/credentials?email=${encodeURIComponent(admin.email)}&role=DISTRICT_ADMIN&district=${encodeURIComponent(admin.districtCode)}`}
                          >
                            <Button size="sm" variant="outline" className="gap-1.5">
                              <KeyRound className="size-3.5" /> Issue login
                            </Button>
                          </Link>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void (async () => {
                              const nextActive = !admin.active;
                              try {
                                await updateDistrictAdmin(admin.adminId, { active: nextActive });
                                toast.success(nextActive ? "Admin reactivated" : "Admin deactivated");
                              } catch (err) {
                                toast.error("Update failed", {
                                  description: err instanceof Error ? err.message : undefined,
                                });
                              }
                            })();
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
                                  void (async () => {
                                    try {
                                      await deleteDistrictAdmin(admin.adminId);
                                      setCreds((prev) =>
                                        prev.filter(
                                          (c) => c.email.toLowerCase() !== admin.email.toLowerCase(),
                                        ),
                                      );
                                      toast.success("Admin deleted");
                                    } catch (err) {
                                      toast.error("Delete failed", {
                                        description: err instanceof Error ? err.message : undefined,
                                      });
                                    }
                                  })();
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

      <DistrictAdminDrawer
        open={drawerOpen}
        onOpenChange={(next) => {
          setDrawerOpen(next);
          if (!next) setLockedDistrict(undefined);
        }}
        districts={districts}
        lockedDistrictCode={lockedDistrict}
        credentials={creds}
        sellers={sellers}
        admins={admins}
        onCreated={() => {
          void listPortalCredentials().then(setCreds).catch(() => undefined);
        }}
      />

      <Sheet open={Boolean(editing)} onOpenChange={(next) => !next && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
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
                <Select
                  value={draft.districtCode}
                  onValueChange={(next) => setDraft({ ...draft, districtCode: next })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d.districtCode} value={d.districtCode}>
                        {d.districtCode} · {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vertical access</Label>
                {[
                  { key: "martAccess" as const, label: "Mart" },
                  { key: "foodAccess" as const, label: "Food" },
                  { key: "pharmaAccess" as const, label: "Pharma" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 text-[13px]">
                    <Checkbox
                      checked={draft[key]}
                      onCheckedChange={(checked) => setDraft({ ...draft, [key]: checked === true })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <Button
                size="sm"
                disabled={!EMAIL_RE.test(draft.email) || draft.name.trim().length < 3}
                onClick={() => {
                  void (async () => {
                    try {
                      await updateDistrictAdmin(editing.adminId, draft);
                      toast.success("Admin updated");
                      setEditing(null);
                      void listPortalCredentials().then(setCreds).catch(() => undefined);
                    } catch (err) {
                      const conflict =
                        err instanceof ApiError
                          ? districtAdminConflictMessage(err)
                          : { message: err instanceof Error ? err.message : "Update failed" };
                      toast.error("Update failed", { description: conflict.message });
                    }
                  })();
                }}
              >
                Save changes
              </Button>

              <div>
                <p className="mb-2 text-[12px] font-medium">Recent activity</p>
                <ul className="space-y-1">
                  {listAuditLogs({ query: editing.adminId })
                    .slice(0, 6)
                    .map((log) => (
                      <li key={log.logId} className="num text-[11px] text-muted-foreground">
                        {formatDateTime(log.createdAt)}: {log.action} on {log.entityId}
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
