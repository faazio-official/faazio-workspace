// 'use client'
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
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
import { pageMeta } from "@/lib/seo";
import { formatDate, formatDateTime } from "@/lib/format";
import { createStateAdmin, deleteStateAdmin, listAuditLogs, updateStateAdmin } from "@/lib/api";
import { useMockLoading, useStateAdmins } from "@/lib/api/hooks";
import { STATES } from "@/data/states";
import type { StateAdmin } from "@/data/types";

export const Route = createFileRoute("/admin/super/state-admins")({
  head: () =>
    pageMeta(
      "State admin accounts",
      "Create, edit, deactivate and delete state admin accounts, with per-state coverage warnings.",
    ),
  component: StateAdminAccounts,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function StateAdminAccounts() {
  const loading = useMockLoading();
  const admins = useStateAdmins();
  const [form, setForm] = useState({ name: "", email: "", phone: "", stateCode: "MH" });
  const [editing, setEditing] = useState<StateAdmin | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", stateCode: "MH" });

  const valid =
    form.name.trim().length > 2 && EMAIL_RE.test(form.email) && form.phone.trim().length >= 10;
  const uncovered = STATES.filter(
    (s) => admins.filter((a) => a.stateCode === s.stateCode && a.active).length === 0,
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="State admins"
        description="A state may have several admins; each admin is locked to exactly one state."
      />

      {uncovered.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px]">
          <AlertTriangle className="size-4 text-warning" />
          No active admin for{" "}
          <span className="num font-semibold">
            {uncovered.map((s) => s.stateCode).join(", ")}
          </span>
          — those states have no one to review KYC or run campaigns.
        </div>
      ) : null}

      <SectionCard title="Create an admin account">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="adm-name">Name</Label>
            <Input
              id="adm-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adm-email">Email</Label>
            <Input
              id="adm-email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="admin.mh@faazio.dev"
            />
            {form.email && !EMAIL_RE.test(form.email) ? (
              <p className="text-[11px] text-destructive">Enter a valid email address.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adm-phone">Phone</Label>
            <Input
              id="adm-phone"
              className="num"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <Select
              value={form.stateCode}
              onValueChange={(value) => setForm({ ...form, stateCode: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s.stateCode} value={s.stateCode}>
                    {s.stateCode} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => {
              createStateAdmin({
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                stateCode: form.stateCode,
              });
              setForm({ name: "", email: "", phone: "", stateCode: form.stateCode });
              toast.success("State admin created");
            }}
          >
            Create admin
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Admin roster" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={admins.length === 0}
          empty={<EmptyState title="No admins yet" description="Create the first state admin above." />}
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
              {admins.map((admin) => (
                <TableRow key={admin.adminId} className="h-12">
                  <TableCell className="num text-[13px] font-semibold">{admin.stateCode}</TableCell>
                  <TableCell className="text-[13px] font-medium">{admin.name}</TableCell>
                  <TableCell className="num text-[12px]">{admin.email}</TableCell>
                  <TableCell className="num text-[12px]">{admin.phone}</TableCell>
                  <TableCell className="num text-[12px]">{formatDate(admin.createdAt)}</TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">
                    {formatDateTime(admin.lastActiveAt)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={admin.active ? "ACTIVE" : "DEACTIVATED"} />
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
                            stateCode: admin.stateCode,
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          updateStateAdmin(admin.adminId, { active: !admin.active });
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
                              This removes their access to {admin.stateCode} permanently. Their past
                              actions stay in the audit log.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteStateAdmin(admin.adminId);
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
              ))}
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
                <Label>State</Label>
                <Select
                  value={draft.stateCode}
                  onValueChange={(value) => setDraft({ ...draft, stateCode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map((s) => (
                      <SelectItem key={s.stateCode} value={s.stateCode}>
                        {s.stateCode} · {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={!EMAIL_RE.test(draft.email) || draft.name.trim().length < 3}
                onClick={() => {
                  updateStateAdmin(editing.adminId, draft);
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
