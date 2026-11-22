// 'use client'
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { pageMeta } from "@/lib/seo";
import { approveAddon, rejectAddon } from "@/lib/api";
import { useEffect, useState } from "react";
import { listAddons } from "@/lib/api";
import { StatusPill } from "@/components/patterns/Pills";

export const Route = createFileRoute("/admin/district/addons/queue")({
  head: () => pageMeta("Add‑on Queue", "District admin reviews pending add‑ons."),
  component: AddonQueue,
});

function AddonQueue() {
  const [addons, setAddons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const data = await listAddons({ status: "PENDING_REVIEW" });
        setAddons(data);
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);


  const handleApprove = async (id: string) => {
    await approveAddon(id);
    toast.success("Add‑on approved");
  };
  const handleReject = async (id: string) => {
    const reason = prompt("Rejection reason?");
    if (!reason) return;
    await rejectAddon(id, reason);
    toast.success("Add‑on rejected");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Add‑on queue" description="Review seller‑submitted add‑ons awaiting moderation." />
      <SectionCard>
        <DataShell loading={loading} error={error} isEmpty={addons?.length === 0} empty={<EmptyState title="No pending add‑ons" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {addons?.map(a => (
                <TableRow key={a.addonId}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.groupName}</TableCell>
                  <TableCell>{a.pricePaisa / 100}</TableCell>
                  <TableCell><StatusPill status={a.status} /></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => handleApprove(a.addonId)}>Approve</Button>
                    <Button size="sm" variant="outline" className="ml-2" onClick={() => handleReject(a.addonId)}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}
