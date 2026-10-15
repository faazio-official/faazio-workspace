"use client";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { useMockLoading, useSduiLayouts } from "@/lib/api/hooks";
import { setSduiLayoutStatus } from "@/lib/api";

function SuperSdui() {
  const loading = useMockLoading();
  const layouts = useSduiLayouts();

  return (
    <div className="space-y-4">
      <PageHeader
        title="App content (SDUI)"
        description="Server-driven home layouts the mobile app renders at runtime. Publishing bumps the live version."
      />

      <SectionCard bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={layouts.length === 0}
          empty={
            <EmptyState
              title="No layouts"
              description="Server-driven layouts for the mobile home feed appear here."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Layout</TableHead>
                <TableHead>Locale</TableHead>
                <TableHead>Path</TableHead>
                <TableHead className="text-right">Version</TableHead>
                <TableHead className="text-right">Sections</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {layouts.map((l) => (
                <TableRow key={`${l.layoutId}-${l.version}`} className="h-12">
                  <TableCell className="font-medium">{l.layoutId}</TableCell>
                  <TableCell>{l.locale}</TableCell>
                  <TableCell className="num">{l.path}</TableCell>
                  <TableCell className="num text-right">v{l.version}</TableCell>
                  <TableCell className="num text-right">{l.sections.length}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(l.updatedAt)}</TableCell>
                  <TableCell>
                    <StatusPill status={l.status} />
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={l.status === "PUBLISHED"}
                      onClick={() => {
                        setSduiLayoutStatus(l.layoutId, l.version, "PUBLISHED");
                        toast.success(`${l.layoutId} v${l.version} published`);
                      }}
                    >
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={l.status === "DRAFT"}
                      onClick={() => {
                        setSduiLayoutStatus(l.layoutId, l.version, "DRAFT");
                        toast.success(`${l.layoutId} v${l.version} moved to draft`);
                      }}
                    >
                      Unpublish
                    </Button>
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

export default SuperSdui;