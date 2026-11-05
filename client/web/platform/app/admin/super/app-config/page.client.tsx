"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  deleteAppConfig,
  getDeliveryUpipQr,
  listAppConfig,
  updateAppConfig,
  updateDeliveryUpipQr,
} from "@/lib/api";
import { uploadDeliveryQr } from "@/lib/media/deliveryQr";
import type {
  AppConfigCategory,
  AppConfigRow,
  AppConfigVariant,
} from "@/data/types";

const KEY_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const CATEGORIES: AppConfigCategory[] = ["brand", "maps", "region", "feature", "maintenance", "limits"];
const VARIANTS: AppConfigVariant[] = ["customer", "delivery", "seller", "all"];

const CATEGORY_LABEL: Record<AppConfigCategory, string> = {
  brand: "Brand",
  maps: "Maps",
  region: "Region",
  feature: "Feature",
  maintenance: "Maintenance",
  limits: "Limits",
};

const VARIANT_LABEL: Record<AppConfigVariant, string> = {
  customer: "Customer",
  delivery: "Delivery",
  seller: "Seller",
  all: "All apps",
};

/** Pretty-print a row's value for the table. Secret rows never show their real value. */
function displayValue(row: AppConfigRow): string {
  if (row.valueSecret) return "••••••••";
  const v = row.value;
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return v;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}

/** Turn a stored value into the editor's text field (secret rows edit as blank → "keep"). */
function encodeValueForEdit(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/** Parse the editor text back into a JSON value. Plain text becomes a string; "null"/objects/numbers keep their JSON type. */
function decodeValueFromEdit(raw: string): unknown {
  const t = raw.trim();
  if (t === "") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    const n = Number(t);
    if (!Number.isNaN(n)) return n;
  }
  if (t.startsWith("{") || t.startsWith("[") || t.startsWith('"')) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      // fall through to a plain string
    }
  }
  return t;
}

function AppConfigPage() {
  const [rows, setRows] = useState<AppConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AppConfigRow | null>(null);
  const [deleting, setDeleting] = useState<AppConfigRow | null>(null);

  const [formKey, setFormKey] = useState("");
  const [formCategory, setFormCategory] = useState<AppConfigCategory>("brand");
  const [formValue, setFormValue] = useState("");
  const [formIsPublic, setFormIsPublic] = useState(true);
  const [formAppVariant, setFormAppVariant] = useState<AppConfigVariant>("all");
  const [formSecret, setFormSecret] = useState(false);
  const [formDescription, setFormDescription] = useState("");

  // Delivery UPI QR (migration 0077): one public QR shown to delivery riders so a COD customer can
  // pay by scanning. Uploaded to R2 by the super admin.
  const [qrUrl, setQrUrl] = useState("");
  const [qrAssetId, setQrAssetId] = useState("");
  const [qrBusy, setQrBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const qr = await getDeliveryUpipQr();
        setQrUrl(qr.qrUrl ?? "");
        setQrAssetId(qr.assetId ?? "");
      } catch {
        // non-fatal: QR stays unset (gateway unconfigured)
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAppConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the app config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setFormKey("");
    setFormCategory("brand");
    setFormValue("");
    setFormIsPublic(true);
    setFormAppVariant("all");
    setFormSecret(false);
    setFormDescription("");
    setCreating(true);
    setEditing(null);
  }

  function openEdit(row: AppConfigRow) {
    setFormKey(row.key);
    setFormCategory(row.category);
    setFormValue(encodeValueForEdit(row.value));
    setFormIsPublic(row.isPublic);
    setFormAppVariant(row.appVariant as AppConfigVariant);
    setFormSecret(row.valueSecret);
    setFormDescription(row.description ?? "");
    setEditing(row);
    setCreating(false);
  }

  async function save() {
    const key = formKey.trim();
    if (!KEY_RE.test(key)) {
      toast.error("Invalid key", {
        description: "Lowercase letters, digits, dots, dashes and underscores only (max 64 chars).",
      });
      return;
    }
    if (formSecret && formIsPublic) {
      toast.error("A public value cannot be marked secret.");
      return;
    }
    // A masked secret row edits as blank ("keep"). Unchecking Secret with no value would send a
    // JSON null and permanently clobber the stored secret, so require a real value on that path.
    if (editing?.valueSecret && !formSecret && formValue.trim() === "") {
      toast.error("Enter a value before making this key public.");
      return;
    }
    if (formDescription.trim().length > 300) {
      toast.error("Description is too long (max 300 characters).");
      return;
    }
    setBusy(true);
    try {
      await updateAppConfig(key, {
        category: formCategory,
        value: formSecret ? null : decodeValueFromEdit(formValue),
        isPublic: formIsPublic,
        appVariant: formAppVariant,
        valueSecret: formSecret,
        description: formDescription.trim(),
      });
      setCreating(false);
      setEditing(null);
      toast.success(
        editing ? "Config updated" : "Config created",
        { description: "Apps pick it up on their next boot — no app-store release needed." },
      );
      void load();
    } catch (err) {
      toast.error("Could not save the config", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteAppConfig(deleting.key);
      toast.success("Config removed", { description: "Apps fall back to their baked defaults." });
      setDeleting(null);
      void load();
    } catch (err) {
      toast.error("Could not remove the config", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleQrPick(file: File | undefined) {
    if (!file) return;
    setQrBusy(true);
    try {
      const uploaded = await uploadDeliveryQr(file);
      setQrUrl(uploaded.qrUrl);
      setQrAssetId(uploaded.assetId ?? "");
    } catch (err) {
      toast.error("Could not upload the QR image", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setQrBusy(false);
    }
  }

  async function saveQr() {
    setQrBusy(true);
    try {
      const assetId = qrAssetId.trim();
      await updateDeliveryUpipQr(assetId ? { qrUrl: qrUrl.trim(), assetId } : { qrUrl: qrUrl.trim() });
      toast.success(qrUrl.trim() ? "Delivery UPI QR updated" : "Delivery UPI QR cleared", {
        description: "Riders see this QR at the DROP stop for COD orders.",
      });
    } catch (err) {
      toast.error("Could not save the delivery UPI QR", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setQrBusy(false);
    }
  }

  const sheetOpen = creating || Boolean(editing);

  return (
    <div className="space-y-4">
      <PageHeader
        title="App config"
        description="The central remote config every Faazio app fetches on boot. Edit a value here and the next app boot picks it up — no app-store review."
        actions={
          <div className="flex items-center gap-1.5">
            <ComponentHelp id="new-config" label="About adding a config key" />
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="size-4" /> New config key
            </Button>
          </div>
        }
      />

      <SectionCard
        title="Delivery UPI QR"
        description="One QR shown to every delivery rider at the DROP stop, so a COD customer can pay by scanning. Rider confirms 'Payment received' before marking the order delivered."
        actions={
          <ComponentHelp id="delivery-upi-qr" label="About the delivery UPI QR" />
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {qrUrl ? (
              <img src={qrUrl} alt="Delivery UPI QR" className="h-full w-full object-contain" />
            ) : (
              <span className="px-3 text-center text-[11px] text-muted-foreground">
                No QR set
              </span>
            )}
          </div>
          <div className="min-w-0 space-y-2.5 sm:flex-1">
            <div className="space-y-1.5">
              <Label htmlFor="qr-file">Upload QR image (R2)</Label>
              <Input
                id="qr-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="h-9 w-full cursor-pointer"
                disabled={qrBusy}
                onChange={(e) => void handleQrPick(e.target.files?.[0])}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-url">…or paste the image URL</Label>
              <Input
                id="qr-url"
                placeholder="https://… / r2:…"
                value={qrUrl}
                onChange={(e) => setQrUrl(e.target.value)}
                disabled={qrBusy}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void saveQr()} disabled={qrBusy}>
                {qrBusy ? "Saving…" : "Save QR"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={qrBusy || !qrUrl}
                onClick={() => {
                  setQrUrl("");
                  setQrAssetId("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Remote-managed settings"
        bodyClassName="p-0"
        actions={
          <Link
            href="/admin/super/audit"
            className="text-[13px] font-medium text-interactive hover:underline"
          >
            Audit trail →
          </Link>
        }
      >
        <DataShell
          loading={loading}
          error={error ?? undefined}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title="No config keys yet"
              description="Create a key to start remote-managing an app setting."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Actions
                    <ComponentHelp id="delete-config" label="About removing a config" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key} className="h-12">
                  <TableCell className="num text-[13px] font-medium">{row.key}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {CATEGORY_LABEL[row.category as AppConfigCategory] ?? row.category}
                  </TableCell>
                  <TableCell className="num max-w-56 truncate text-[12px]">
                    {displayValue(row)}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <StatusPill status={row.isPublic ? "PUBLIC" : "PRIVATE"} />
                    {row.valueSecret ? <StatusPill status="SECRET" /> : null}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {VARIANT_LABEL[row.appVariant as AppConfigVariant] ?? row.appVariant}
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {row.updatedAt ? formatDateTime(row.updatedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => setDeleting(row)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Sheet
        open={sheetOpen}
        onOpenChange={(next) => {
          if (!next) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.key}` : "New config key"}</SheetTitle>
            <SheetDescription>
              Public values are served to the apps on boot. Secret values are masked here and never
              leave the gateway.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="config-key">Key</Label>
                <ComponentHelp id="config-key" label="About the config key" />
              </div>
              <Input
                id="config-key"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder="e.g. maps.places_api_key"
                disabled={Boolean(editing)}
                aria-label="Config key"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={formCategory}
                onValueChange={(v) => setFormCategory(v as AppConfigCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="config-value">Value</Label>
                <ComponentHelp id="config-value" label="About the config value" />
              </div>
              <Textarea
                id="config-value"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="Plain text is stored as a string; use JSON for objects/arrays (e.g. {…} or […])."
                className="min-h-24"
              />
              <p className="text-[11px] text-muted-foreground">
                {formSecret
                  ? "This key is secret — the stored value is never shown. Leave blank to keep it."
                  : "Tip: true/false and numbers keep their JSON type automatically."}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label>Applies to</Label>
                <ComponentHelp id="config-variant" label="About the app scope" />
              </div>
              <Select
                value={formAppVariant}
                onValueChange={(v) => setFormAppVariant(v as AppConfigVariant)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIANTS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {VARIANT_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="config-description">Description</Label>
              <Input
                id="config-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What this setting controls and who consumes it."
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <label htmlFor="config-public" className="text-[13px]">
                  Public
                  <span className="block text-[11px] text-muted-foreground">
                    Served to every app on boot.
                  </span>
                </label>
                <ComponentHelp id="config-public" label="About public values" />
              </div>
              <Switch
                id="config-public"
                checked={formIsPublic}
                onCheckedChange={setFormIsPublic}
                disabled={formSecret}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <label htmlFor="config-secret" className="text-[13px]">
                  Secret
                  <span className="block text-[11px] text-muted-foreground">
                    Masked in this portal and never served to the app. Cannot be public.
                  </span>
                </label>
                <ComponentHelp id="config-secret" label="About secret values" />
              </div>
              <Switch
                id="config-secret"
                checked={formSecret}
                onCheckedChange={(next) => {
                  setFormSecret(next);
                  if (next) setFormIsPublic(false);
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-1.5">
                <ComponentHelp id="save-config" label="About saving a config" />
                <Button disabled={busy} onClick={() => void save()}>
                  {busy ? "Saving..." : editing ? "Save changes" : "Create key"}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(next) => !next && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.key}?</AlertDialogTitle>
            <AlertDialogDescription>
              Apps immediately fall back to their baked build-time value for this key. The removal
              is audit-logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmDelete()}>
              {busy ? "Removing…" : "Remove config"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AppConfigPage;