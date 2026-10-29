"use client";
import { useState } from "react";

import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { useAuditLogs, useMockLoading } from "@/lib/api/hooks";
import type { Role } from "@/data/types";


const ROLES: (Role | "ALL")[] = ["ALL", "SELLER", "DISTRICT_ADMIN", "SUPER_ADMIN"];

function SuperAudit() {
  const loading = useMockLoading();
  const [role, setRole] = useState<Role | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("");
  const logs = useAuditLogs({
    ...(role === "ALL" ? {} : { actorRole: role }),
    ...(query ? { query } : {}),
    ...(entity ? { entity } : {}),
  });
  const entities = [...new Set(useAuditLogs({}).map((l) => l.entity))].sort();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description="Read-only, retained 7 days. Entries older than 7 days are purged nightly at midnight IST and cannot be recovered."
      />

      <SectionCard bodyClassName="p-0">
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search action, entity id or actor"
                className="h-9 w-64"
              />
              <ComponentHelp id="audit-search" label="About audit search" />
            </div>
            <div className="flex items-center gap-1.5">
              <ComponentHelp id="role-filter" label="About the role filter" />
              {ROLES.map((option) => (
                <FilterChip
                  key={option}
                  label={option === "ALL" ? "All roles" : option.replace("_", " ")}
                  active={role === option}
                  onClick={() => setRole(option)}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ComponentHelp id="entity-filter" label="About the entity filter" />
            <FilterChip label="All entities" active={entity === ""} onClick={() => setEntity("")} />
            {entities.map((option) => (
              <FilterChip
                key={option}
                label={option}
                active={entity === option}
                onClick={() => setEntity(option)}
              />
            ))}
          </div>
        </div>
        <DataShell
          loading={loading}
          isEmpty={logs.length === 0}
          empty={<EmptyState title="No entries match" description="Clear the filters to see the full log." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity id</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.logId} className="h-12">
                  <TableCell className="num text-[12px]">{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell className="num text-[12px]">{log.actorId}</TableCell>
                  <TableCell className="num text-[12px]">{log.actorRole.replace("_", " ")}</TableCell>
                  <TableCell className="num text-[12px] font-semibold">{log.action}</TableCell>
                  <TableCell className="num text-[12px] text-muted-foreground">{log.entity}</TableCell>
                  <TableCell className="num text-[12px]">{log.entityId}</TableCell>
                  <TableCell className="num max-w-[200px] truncate text-[11px] text-muted-foreground">
                    {log.before ?? "—"}
                  </TableCell>
                  <TableCell className="num max-w-[200px] truncate text-[11px] text-muted-foreground">
                    {log.after ?? "—"}
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

export default SuperAudit;
