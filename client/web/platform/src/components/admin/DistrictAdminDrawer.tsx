"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
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
import { formatDateTime } from "@/lib/format";
import type { DistrictInfo } from "@/lib/api";
import {
  createDistrictAdminWithLogin,
  districtAdminConflictMessage,
  districtAdminDuplicateHint,
  districtAdminInviteUrl,
  normalizePhoneDigits,
} from "@/lib/api";
import type { DistrictAdminCreateResult, IdentityHint } from "@/lib/api";
import type { DistrictAdmin, PortalCredential } from "@/data/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 12;
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";

function generatePassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

/** How the login (if any) is delivered to the new admin. */
type Mode = "invite" | "password" | "roster";

const MODE_OPTIONS: { value: Mode; label: string; hint: string }[] = [
  {
    value: "invite",
    label: "Send invite",
    hint: "The admin sets their own password from a one-time link. You never handle credentials.",
  },
  {
    value: "password",
    label: "Set temporary password",
    hint: "Generate a password now and share it once; it must be changed at first sign-in.",
  },
  {
    value: "roster",
    label: "No login yet",
    hint: "Create the roster row only. They cannot sign in until a login is issued.",
  },
];

export interface DistrictAdminDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  districts: readonly DistrictInfo[];
  /** When set, the district is fixed (opened from a district drilldown). */
  lockedDistrictCode?: string | undefined;
  /** Pre-submit lint inputs (non-authoritative; the server is the source of truth). */
  credentials?: readonly PortalCredential[] | undefined;
  sellers?: readonly { sellerId: string; contactPhone: string }[] | undefined;
  admins?: readonly DistrictAdmin[] | undefined;
  onCreated?: ((result: DistrictAdminCreateResult) => void) | undefined;
}

/** The single create-an-admin surface, shared by the roster page and the district drilldown. */
export function DistrictAdminDrawer({
  open,
  onOpenChange,
  districts,
  lockedDistrictCode,
  credentials = [],
  sellers = [],
  admins = [],
  onCreated,
}: DistrictAdminDrawerProps) {
  const [mode, setMode] = useState<Mode>("invite");
  const [districtQuery, setDistrictQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    districtCode: lockedDistrictCode ?? "",
    password: "",
    martAccess: true,
    foodAccess: true,
    pharmaAccess: true,
  });
  const [creating, setCreating] = useState(false);
  const [serverError, setServerError] = useState<IdentityHint | null>(null);
  const [created, setCreated] = useState<DistrictAdminCreateResult | null>(null);

  const lockedDistrict = lockedDistrictCode
    ? districts.find((d) => d.districtCode === lockedDistrictCode)
    : undefined;

  // The drawer stays mounted while closed, so re-target the district each time it opens (an
  // uncovered-district chip, or reopening before the close animation's reset runs) instead of
  // carrying the previous draft's district into a submit.
  useEffect(() => {
    if (!open) return;
    setForm((f) => ({ ...f, districtCode: lockedDistrictCode ?? "" }));
    setDistrictQuery("");
  }, [open, lockedDistrictCode]);

  const visibleDistricts = useMemo(() => {
    const q = districtQuery.trim().toLowerCase();
    if (!q) return districts;
    return districts.filter(
      (d) => d.districtCode.toLowerCase().includes(q) || d.name.toLowerCase().includes(q),
    );
  }, [districts, districtQuery]);

  const phoneDigits = normalizePhoneDigits(form.phone);
  const duplicateHint = districtAdminDuplicateHint(
    form.email,
    form.phone,
    [...credentials],
    [...sellers],
    [...admins],
  );
  const passwordValid = mode !== "password" || form.password.length >= MIN_PASSWORD;
  const valid =
    form.name.trim().length > 2 &&
    EMAIL_RE.test(form.email) &&
    phoneDigits.length === 10 &&
    Boolean(form.districtCode) &&
    passwordValid &&
    duplicateHint?.kind !== "error";

  function resetForm() {
    setMode("invite");
    setDistrictQuery("");
    setForm({
      name: "",
      email: "",
      phone: "",
      districtCode: lockedDistrictCode ?? "",
      password: "",
      martAccess: true,
      foodAccess: true,
      pharmaAccess: true,
    });
    setServerError(null);
    setCreated(null);
  }

  function close() {
    onOpenChange(false);
    // Let the close animation finish before wiping the one-time secret.
    window.setTimeout(resetForm, 200);
  }

  async function handleCreate() {
    setCreating(true);
    setServerError(null);
    try {
      const result = await createDistrictAdminWithLogin({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        districtCode: form.districtCode,
        issueLogin: mode !== "roster",
        inviteMode: mode === "invite",
        password: mode === "password" ? form.password : undefined,
        martAccess: form.martAccess,
        foodAccess: form.foodAccess,
        pharmaAccess: form.pharmaAccess,
      });
      setCreated(result);
      onCreated?.(result);
      if (result.warnings?.length) {
        toast.info("District admin created: shared phone", { description: result.warnings.join(" · ") });
      } else if (mode === "invite") {
        toast.success("District admin invited");
      } else if (mode === "password") {
        toast.success("District admin created with a portal login");
      } else {
        toast.success("District admin added to the roster (no login issued)");
      }
    } catch (err) {
      const conflict = districtAdminConflictMessage(err);
      setServerError({ field: conflict.field ?? "email", kind: "error", message: conflict.message });
      toast.error("Could not create the district admin", { description: conflict.message });
    } finally {
      setCreating(false);
    }
  }

  function copy(text: string, label: string) {
    void navigator.clipboard?.writeText(text);
    toast.success(`${label} copied`);
  }

  const inviteLink = created?.inviteToken ? districtAdminInviteUrl(created.inviteToken) : "";

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Assign a district admin</SheetTitle>
          <SheetDescription>
            One step creates the roster row and, when requested, the portal login for exactly one
            district. A district can have several admins.
          </SheetDescription>
        </SheetHeader>

        {created ? (
          <div className="space-y-4 px-4 pb-6">
            <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12px] text-success">
              {created.admin.name} is now an admin for{" "}
              <span className="num font-medium">{created.admin.districtCode}</span>.
            </div>

            {inviteLink ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-3">
                <p className="text-[12px] font-medium">Invite link</p>
                <p className="text-[11px] text-muted-foreground">
                  Share it with {created.admin.email}. It works once and expires{" "}
                  {created.inviteExpiresAt ? formatDateTime(created.inviteExpiresAt) : "in 7 days"}.
                </p>
                <div className="break-all rounded-md border border-border bg-background px-2 py-1.5 text-[11px]">
                  {inviteLink}
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(inviteLink, "Invite link")}>
                  <Copy className="size-3.5" /> Copy link
                </Button>
              </div>
            ) : null}

            {mode === "password" && form.password ? (
              <div className="space-y-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-3">
                <p className="text-[12px] font-medium">Temporary password</p>
                <p className="text-[11px] text-muted-foreground">
                  Shown only once. Copy it now; it must be changed at first sign-in.
                </p>
                <div className="num break-all rounded-md border border-border bg-background px-2 py-1.5 text-[13px]">
                  {form.password}
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(form.password, "Password")}>
                  <Copy className="size-3.5" /> Copy
                </Button>
              </div>
            ) : null}

            {created.warnings?.length ? (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] text-warning">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <ul className="list-inside list-disc">
                  {created.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={resetForm} disabled={creating}>
                Add another
              </Button>
              <Button size="sm" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>District</Label>
                <ComponentHelp id="district-select" label="About the district field" />
              </div>
              {lockedDistrict ? (
                <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-[13px]">
                  <span className="num font-medium">{lockedDistrict.districtCode}</span>
                  <span className="ml-1.5 text-muted-foreground">{lockedDistrict.name}</span>
                </div>
              ) : (
                <>
                  <Input
                    value={districtQuery}
                    onChange={(e) => setDistrictQuery(e.target.value)}
                    placeholder="Filter districts..."
                    className="h-8 text-[12px]"
                    aria-label="Filter districts"
                  />
                  <Select
                    value={form.districtCode}
                    onValueChange={(next) => setForm((f) => ({ ...f, districtCode: next }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a district" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleDistricts.length === 0 ? (
                        <div className="px-2 py-3 text-[12px] text-muted-foreground">No districts match.</div>
                      ) : (
                        visibleDistricts.map((d) => (
                          <SelectItem key={d.districtCode} value={d.districtCode}>
                            {d.districtCode} · {d.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adm-name">Name</Label>
              <Input
                id="adm-name"
                value={form.name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }));
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
                  setForm((f) => ({ ...f, email: e.target.value }));
                  setServerError(null);
                }}
                placeholder="admin.district@faazio.dev"
                className={serverError?.field === "email" ? "border-destructive" : undefined}
              />
              {form.email && !EMAIL_RE.test(form.email) ? (
                <p className="text-[11px] text-destructive">Enter a valid email address.</p>
              ) : null}
              {duplicateHint?.field === "email" ? (
                <p className="text-[11px] text-destructive">Already in use: {duplicateHint.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adm-phone">Phone</Label>
              <Input
                id="adm-phone"
                className="num"
                value={form.phone}
                onChange={(e) => {
                  setForm((f) => ({ ...f, phone: e.target.value }));
                  setServerError(null);
                }}
              />
              {form.phone && phoneDigits.length !== 10 ? (
                <p className="text-[11px] text-destructive">Enter a valid 10-digit Indian mobile number.</p>
              ) : null}
              {duplicateHint?.field === "phone" ? (
                <p className="flex items-start gap-1 text-[11px] text-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{duplicateHint.message}</span>
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Login</Label>
                <ComponentHelp id="login-mode" label="About the login hand-over" />
              </div>
              <Select value={mode} onValueChange={(next) => setMode(next as Mode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {MODE_OPTIONS.find((o) => o.value === mode)?.hint}
              </p>
            </div>

            {mode === "password" ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-3">
                <Label htmlFor="adm-password">Temporary password</Label>
                <div className="flex items-end gap-2">
                  <Input
                    id="adm-password"
                    className="num flex-1"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Copy password"
                    onClick={() => copy(form.password, "Password")}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Regenerate password"
                    onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  At least {MIN_PASSWORD} characters. Shown once; copy it before creating.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Vertical access</Label>
                <ComponentHelp id="vertical-access" label="About vertical access" />
              </div>
              {[
                { key: "martAccess" as const, label: "Mart" },
                { key: "foodAccess" as const, label: "Food" },
                { key: "pharmaAccess" as const, label: "Pharma" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 text-[13px]">
                  <Checkbox
                    checked={form[key]}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, [key]: checked === true }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Which verticals this admin can manage in their district. All three by default.
              </p>
            </div>

            {serverError ? <p className="text-[12px] text-destructive">{serverError.message}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={close} disabled={creating}>
                Cancel
              </Button>
              <Button disabled={!valid || creating} onClick={() => void handleCreate()}>
                {creating ? "Creating..." : mode === "invite" ? "Create & invite" : "Create admin"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Small MART / FOOD / PHARMA badges for the roster table. */
export function VerticalAccessBadges({
  martAccess,
  foodAccess,
  pharmaAccess,
}: {
  martAccess?: boolean | undefined;
  foodAccess?: boolean | undefined;
  pharmaAccess?: boolean | undefined;
}) {
  const items = [
    { on: martAccess !== false, label: "MART" },
    { on: foodAccess !== false, label: "FOOD" },
    { on: pharmaAccess !== false, label: "PHARMA" },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(({ on, label }) => (
        <span
          key={label}
          className={
            on
              ? "rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground"
              : "rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground/60 line-through"
          }
        >
          {label}
        </span>
      ))}
    </div>
  );
}
