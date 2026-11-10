"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/format";
import { approveAddon, listAddons, rejectAddon } from "@/lib/api";
import type { AddonRecord } from "@/data/types";

const MAX_REASON = 500;

function AddonQueue() {
  const [pending, setPending] = useState<AddonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<AddonRecord | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPending(await listAddons({ status: "PENDING_REVIEW" }));
    } catch {
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function approve(addon: AddonRecord) {
    setBusy(addon.addonId);
    try {
      await approveAddon(addon.addonId);
      toast.success("Add-on approved", { description: "It is now live on the dish." });
      await refresh();
    } catch {
      toast.error("Could not approve the add-on");
    } finally {
      setBusy(null);
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    const message = reason.trim();
    if (!message) {
      toast.error("Add a reason so the seller knows what to fix");
      return;
    }
    setBusy(rejecting.addonId);
    try {
      await rejectAddon(rejecting.addonId, message);
      toast.success("Add-on returned to the seller", { description: "They will see your note." });
      setRejecting(null);
      setReason("");
      await refresh();
    } catch {
      toast.error("Could not reject the add-on");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Add-on queue"
        description="Approved add-ons become orderable extras on the seller's dishes immediately."
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={pending.length === 0}
          empty={
            <EmptyState
              title="Queue is clear"
              description="No add-ons from your district are waiting for approval."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Add-on</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((addon) => (
                <TableRow key={addon.addonId} className="h-12">
                  <TableCell className="text-[13px] font-medium">{addon.name}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{addon.groupName || "—"}</TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">{addon.venueId}</TableCell>
                  <TableCell className="num text-right">{formatINR(addon.pricePaisa)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" disabled={busy === addon.addonId} onClick={() => void approve(addon)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === addon.addonId}
                        onClick={() => {
                          setRejecting(addon);
                          setReason("");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return this add-on?</DialogTitle>
            <DialogDescription>
              {rejecting?.name} goes back to the seller as a draft. Tell them what to fix so they can
              resubmit it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="addon-reject-reason">Reason</Label>
            <Textarea
              id="addon-reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
              placeholder="e.g. The price looks wrong and the group is missing."
              rows={4}
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {reason.length}/{MAX_REASON}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmReject()}
              disabled={reason.trim().length === 0 || busy === rejecting?.addonId}
            >
              Return to seller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AddonQueue;
