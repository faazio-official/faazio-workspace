"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
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
  toggleDistrict,
  updateDistrict,
} from "@/lib/api";
import type { AdminDistrictRow, DistrictInput } from "@/lib/api";
import { useAdminDistricts, useStates } from "@/lib/api/hooks";

/** Mirrors the gateway CHECK widened by 0127: 2 letters + 1–3 letters/digits (TCH, PY0, UP71). */
const CODE_PATTERN = /^[A-Z]{2}[A-Z0-9]{1,3}$/;

export function DistrictCoveragePage() {
  const [stateFilter, setStateFilter] = useState("ALL");
  const states = useStates();
  const { items, loading, error, reload } = useAdminDistricts(
    stateFilter === "ALL" ? undefined : stateFilter,
  );

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminDistrictRow | null>(null);
  const [deleting, setDeleting] = useState<AdminDistrictRow | null>(null);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formState, setFormState] = useState("TN");
  const [formActive, setFormActive] = useState(true);

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
      await deleteDistrict(deleting.districtCode);
      toast.success("District deleted");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error("Could not delete the district", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
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
        description="The authoritative district master. Sellers, district admins and payouts all point at these codes — deactivate a district to hide it from pickers, delete it only when nothing references it."
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
          <span className="num ml-auto text-[12px] text-muted-foreground">
            {rows.length} of {items.length}
          </span>
        </div>

        <DataShell
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title="No districts"
              description="Create a district to open coverage, or clear the search/filter."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>District</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Updated</TableHead>
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
                  <TableCell className="num text-[13px] font-semibold">
                    <Link
                      href={`/admin/super/districts/${row.districtCode}`}
                      className="text-primary hover:underline"
                    >
                      {row.districtCode}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[13px] font-medium">{row.name}</TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {row.stateCode}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={row.isActive}
                        disabled={toggling === row.districtCode}
                        onCheckedChange={() => void onToggle(row)}
                        aria-label={`Toggle ${row.districtCode} availability`}
                      />
                      <StatusPill status={row.isActive ? "ACTIVE" : "INACTIVE"} />
                    </div>
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
                maxLength={3}
                className="num"
              />
              <p className="text-[11px] text-muted-foreground">
                2 letters then a letter or digit — e.g. TCH (Chennai), PY0 (Puducherry).
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
              This removes {deleting?.name} from the master. If any seller, admin or payout still
              references it the gateway refuses the delete — deactivate it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
    </div>
  );
}

export default DistrictCoveragePage;
