"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
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
  createDistrict,
  deleteDistrict,
  purgeDistrict,
  restoreDistrict,
  toggleDistrict,
  updateDistrict,
} from "@/lib/api";
import type { AdminDistrictRow, DistrictInput } from "@/lib/api";
import { useAdminDistricts, useDeletedDistricts, useStates } from "@/lib/api/hooks";

/** Mirrors the gateway CHECK widened by 0127: 2 letters + 1–3 letters/digits (TCH, PY0, UP71). */
const CODE_PATTERN = /^[A-Z]{2}[A-Z0-9]{1,3}$/;

export function DistrictCoveragePage() {
  const [stateFilter, setStateFilter] = useState("ALL");
  const states = useStates();
  const live = useAdminDistricts(stateFilter === "ALL" ? undefined : stateFilter);
  const trash = useDeletedDistricts(stateFilter === "ALL" ? undefined : stateFilter);

  const [showTrash, setShowTrash] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminDistrictRow | null>(null);
  const [deleting, setDeleting] = useState<AdminDistrictRow | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [purging, setPurging] = useState<AdminDistrictRow | null>(null);
  const [bulkPurging, setBulkPurging] = useState(false);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formState, setFormState] = useState("TN");
  const [formActive, setFormActive] = useState(true);

  const reloadLive = live.reload;
  const reloadTrash = trash.reload;
  const reload = useCallback(() => {
    reloadLive();
    reloadTrash();
  }, [reloadLive, reloadTrash]);

  const items = showTrash ? trash.items : live.items;
  const loading = showTrash ? trash.loading : live.loading;
  const error = showTrash ? trash.error : live.error;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (d) =>
        d.districtCode.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.stateCode.toLowerCase().includes(q),
    );
  }, [items, query]);

  function toggleTrash() {
    setShowTrash((v) => !v);
    setQuery("");
    setSelected([]);
  }

  function toggleSelected(code: string) {
    setSelected((list) => (list.includes(code) ? list.filter((x) => x !== code) : [...list, code]));
  }

  const closeSheet = useCallback(() => {
    setCreating(false);
    setEditing(null);
  }, []);

  const resetForm = useCallback(() => {
    setFormCode("");
    setFormName("");
    setFormState("TN");
    setFormActive(true);
  }, []);

  function openCreate() {
    resetForm();
    setEditing(null);
    setCreating(true);
  }

  function openEdit(row: AdminDistrictRow) {
    setFormCode(row.districtCode);
    setFormName(row.name);
    setFormState(row.stateCode);
    setFormActive(row.isActive);
    setEditing(row);
    setCreating(false);
  }

  async function save() {
    const code = formCode.trim().toUpperCase();
    const name = formName.trim();
    if (!CODE_PATTERN.test(code)) {
      toast.error("District code must be 2 letters then a letter or digit (e.g. TCH).");
      return;
    }
    if (!name) {
      toast.error("District name is required.");
      return;
    }
    if (!formState) {
      toast.error("Pick a state.");
      return;
    }
    const input: DistrictInput = { name, stateCode: formState, isActive: formActive };
    setBusy(true);
    try {
      if (editing) {
        // The code is the primary key: update addresses the stored row, never rewrites it.
        await updateDistrict(editing.districtCode, input);
        toast.success("District updated");
      } else {
        await createDistrict({ ...input, districtCode: code });
        toast.success("District created", {
          description: "It is live for seller onboarding and scoping immediately.",
        });
      }
      closeSheet();
      reload();
    } catch (err) {
      toast.error("Could not save the district", {
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
      const row = await deleteDistrict(deleting.districtCode, deleteReason);
      toast.success("District deleted", {
        description: row?.purgeAt
          ? `Restorable until ${formatDateTime(row.purgeAt)}, then removed permanently.`
          : "Restorable for 7 days, then removed permanently.",
      });
      setDeleting(null);
      setDeleteReason("");
      reload();
    } catch (err) {
      toast.error("Could not delete the district", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmPurge(codes: string[]) {
    if (codes.length === 0) return;
    setBusy(true);
    try {
      for (const code of codes) {
        await purgeDistrict(code);
      }
      toast.success(codes.length === 1 ? "District permanently deleted" : `${codes.length} districts permanently deleted`);
      setPurging(null);
      setBulkPurging(false);
      setSelected([]);
      reload();
    } catch (err) {
      toast.error("Could not permanently delete the district", {
        description: err instanceof Error ? err.message : undefined,
      });
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function onRestore(row: AdminDistrictRow) {
    try {
      await restoreDistrict(row.districtCode);
      toast.success("District restored", {
        description: "It is deactivated — re-enable it when sellers should see it again.",
      });
      reload();
    } catch (err) {
      toast.error("Could not restore the district", {
        description: err instanceof Error ? err.message : undefined,
      });
      reload();
    }
  }

  async function onToggle(row: AdminDistrictRow) {
    setToggling(row.districtCode);
    try {
      await toggleDistrict(row.districtCode, !row.isActive);
      toast.success(`${row.districtCode} ${row.isActive ? "deactivated" : "activated"}`);
      reload();
    } catch (err) {
      toast.error("Could not update availability", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setToggling(null);
    }
  }

  const sheetOpen = creating || Boolean(editing);

  return (
    <div className="space-y-4">
      <PageHeader
        title="District coverage"
        description="The authoritative district master. Sellers, district admins and payouts all point at these codes — deactivate a district to hide it from pickers, delete it only when nothing references it (restorable for 7 days, then purged)."
        actions={
          <div className="flex items-center gap-1.5">
            <ComponentHelp id="district-create" label="About creating a district" />
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="size-4" /> New district
            </Button>
          </div>
        }
      />

      <SectionCard title="Districts" bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, name or state..."
            className="h-8 w-64 text-[12px]"
            aria-label="Search districts"
          />
          <div className="w-48">
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="h-8 text-[12px]">
                <SelectValue />
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
          </div>
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <FilterChip label="Live" active={!showTrash} onClick={() => showTrash && toggleTrash()} />
          <FilterChip
            label={`Deleted${trash.items.length ? ` · ${trash.items.length}` : ""}`}
            active={showTrash}
            onClick={() => !showTrash && toggleTrash()}
          />
          {showTrash && selected.length > 0 ? (
            <Button
              size="sm"
              variant="destructive"
              className="ml-auto gap-1.5"
              onClick={() => setBulkPurging(true)}
            >
              <Trash2 className="size-3.5" /> Delete forever ({selected.length})
            </Button>
          ) : (
            <span className="num ml-auto text-[12px] text-muted-foreground">
              {showTrash
                ? "Deleted districts are restorable for 7 days, then purged."
                : `${rows.length} of ${items.length}`}
            </span>
          )}
        </div>

        <DataShell
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          empty={
            showTrash ? (
              <EmptyState
                title="Nothing deleted"
                description="Deleted districts appear here for 7 days so a mistake can be undone."
              />
            ) : (
              <EmptyState
                title="No districts"
                description="Create a district to open coverage, or clear the search/filter."
              />
            )
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                {showTrash ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={rows.length > 0 && selected.length === rows.length}
                      onCheckedChange={(checked) =>
                        setSelected(checked === true ? rows.map((r) => r.districtCode) : [])
                      }
                      aria-label="Select all deleted districts"
                    />
                  </TableHead>
                ) : null}
                <TableHead>Code</TableHead>
                <TableHead>District</TableHead>
                <TableHead>State</TableHead>
                <TableHead>{showTrash ? "Deleted" : "Available"}</TableHead>
                <TableHead>{showTrash ? "Purge at" : "Updated"}</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    Actions
                    <ComponentHelp id="district-toggle" label="About district availability" />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.districtCode} className="h-12">
                  {showTrash ? (
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(row.districtCode)}
                        onCheckedChange={() => toggleSelected(row.districtCode)}
                        aria-label={`Select ${row.districtCode}`}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="num text-[13px] font-semibold">
                    {showTrash ? (
                      row.districtCode
                    ) : (
                      <Link
                        href={`/admin/super/districts/${row.districtCode}`}
                        className="text-primary hover:underline"
                      >
                        {row.districtCode}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] font-medium">{row.name}</TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {row.stateCode}
                  </TableCell>
                  <TableCell>
                    {showTrash ? (
                      <StatusPill status="DELETED" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.isActive}
                          disabled={toggling === row.districtCode}
                          onCheckedChange={() => void onToggle(row)}
                          aria-label={`Toggle ${row.districtCode} availability`}
                        />
                        <StatusPill status={row.isActive ? "ACTIVE" : "INACTIVE"} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {showTrash
                      ? row.purgeAt
                        ? formatDateTime(row.purgeAt)
                        : "—"
                      : row.updatedAt
                        ? formatDateTime(row.updatedAt)
                        : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {showTrash ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => void onRestore(row)}
                        >
                          <RotateCcw className="size-3.5" /> Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => setPurging(row)}
                        >
                          <Trash2 className="size-3.5" /> Delete forever
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                          <Pencil className="size-3.5" /> Edit
                        </Button>
                        {row.inUse ? (
                          <span className="self-center text-[11px] text-muted-foreground">
                            In use — deactivate
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => {
                              setDeleting(row);
                              setDeleteReason("");
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
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
          if (!next) closeSheet();
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.name}` : "New district"}</SheetTitle>
            <SheetDescription>
              The code is the stable key sellers and admins reference; it cannot change after
              creation.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <Label htmlFor="district-code">District code</Label>
              <Input
                id="district-code"
                value={formCode}
                disabled={Boolean(editing)}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="TCH"
                maxLength={4}
                className="num"
              />
              <p className="text-[11px] text-muted-foreground">
                2 letters then 1–3 letters or digits — e.g. TCH (Chennai), PY0 (Puducherry).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="district-name">District name</Label>
              <Input
                id="district-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Chennai"
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label>State / UT</Label>
              <Select value={formState} onValueChange={setFormState}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {states.length === 0 ? (
                    <SelectItem value="TN">TN · Tamil Nadu</SelectItem>
                  ) : (
                    states.map((s) => (
                      <SelectItem key={s.stateCode} value={s.stateCode}>
                        {s.stateCode} · {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="district-active">Available</Label>
                <p className="text-[11px] text-muted-foreground">
                  Off hides it from the seller picker; existing references keep working.
                </p>
              </div>
              <Switch id="district-active" checked={formActive} onCheckedChange={setFormActive} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeSheet} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={busy}>
                {editing ? "Save changes" : "Create district"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.districtCode}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name} moves to <span className="font-medium">Deleted</span> and is hidden
              from the picker immediately. It can be restored for 7 days — after that it is
              permanently removed from the database. Districts still referenced by sellers, admins or
              payouts cannot be deleted; deactivate them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="district-delete-reason">Reason (optional)</Label>
            <Input
              id="district-delete-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value.slice(0, 500))}
              placeholder="e.g. duplicate row created during onboarding"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              Delete district
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(purging) || bulkPurging}
        onOpenChange={(next) => {
          if (!next) {
            setPurging(null);
            setBulkPurging(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {purging
                ? `Permanently delete ${purging.districtCode}?`
                : `Permanently delete ${selected.length} districts?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the row from the database now. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void confirmPurge(purging ? [purging.districtCode] : selected);
              }}
            >
              {busy ? "Deleting…" : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DistrictCoveragePage;
