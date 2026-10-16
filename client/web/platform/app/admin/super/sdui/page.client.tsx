"use client";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { saveSduiLayoutHome } from "@/lib/api";
import type { SduiBanner, SduiSection } from "@/data/types";

/** Comma/newline separated id list -> trimmed, non-empty ids. */
function parseIds(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function SuperSdui() {
  const loading = useMockLoading();
  const layouts = useSduiLayouts({ layoutId: "home" });
  const layout = layouts[0];
  const [draft, setDraft] = useState<SduiSection[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(layout?.sections ?? []);
    setDirty(false);
  }, [layout]);

  const patch = (id: string, next: Partial<SduiSection>) => {
    setDraft((rows) => rows.map((s) => (s.id === id ? { ...s, ...next } : s)));
    setDirty(true);
  };

  const patchBanner = (sectionId: string, bannerId: string, next: Partial<SduiBanner>) => {
    setDraft((rows) =>
      rows.map((s) =>
        s.id === sectionId
          ? { ...s, banners: (s.banners ?? []).map((b) => (b.id === bannerId ? { ...b, ...next } : b)) }
          : s,
      ),
    );
    setDirty(true);
  };

  const publish = () => {
    saveSduiLayoutHome(draft);
    setDirty(false);
    toast.success(`Home layout v${(layout?.version ?? 0) + 1} published`);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="App content (SDUI)"
        description="Server-driven home layouts the mobile app renders at runtime. Publishing bumps the live version (Mongo sdui_layouts) and the app picks it up on its next poll."
      />

      <SectionCard
        title="Home layout"
        actions={
          <Button size="sm" onClick={publish} disabled={!dirty}>
            {dirty ? "Publish changes" : "Published"}
          </Button>
        }
      >
        {layout ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Locale <span className="num">{layout.locale}</span> · v{layout.version} · updated{" "}
            {formatDateTime(layout.updatedAt)} · {draft.length} sections. Ids reference catalog
            products / directory stores (ID-only).
          </p>
        ) : null}
        <DataShell
          loading={loading}
          isEmpty={draft.length === 0}
          empty={
            <EmptyState
              title="No layout"
              description="The gateway has no Home SDUI layout (or you are offline)."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Section</TableHead>
                <TableHead className="w-56">Title</TableHead>
                <TableHead>Product ids</TableHead>
                <TableHead className="w-32">Refs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.map((s) => (
                <Fragment key={s.id}>
                  <TableRow>
                    <TableCell className="num align-top text-muted-foreground">{s.id}</TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={s.title}
                        onChange={(e) => patch(s.id, { title: e.target.value })}
                        aria-label={`${s.id} title`}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Textarea
                        value={s.productIds.join(", ")}
                        rows={2}
                        onChange={(e) => patch(s.id, { productIds: parseIds(e.target.value) })}
                        aria-label={`${s.id} product ids`}
                        placeholder="md-1, md-2, …"
                      />
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      {s.storeIds?.length ? <div>{s.storeIds.length} stores</div> : null}
                      {s.chips?.length ? <div>{s.chips.length} chips</div> : null}
                      {s.banners?.length ? <div>{s.banners.length} banners</div> : null}
                    </TableCell>
                  </TableRow>
                  {s.banners?.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted/30">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {s.id} banners (image + copy; prices are always joined from the catalog)
                          </p>
                          {s.banners.map((b) => (
                            <div
                              key={b.id}
                              className="grid grid-cols-1 gap-2 rounded border border-border p-2 md:grid-cols-4"
                            >
                              <div className="num self-center text-xs text-muted-foreground">{b.id}</div>
                              <Input
                                value={b.title}
                                onChange={(e) => patchBanner(s.id, b.id, { title: e.target.value })}
                                aria-label={`${b.id} title`}
                                placeholder="Title"
                              />
                              <Input
                                value={b.subtitle ?? ""}
                                onChange={(e) => patchBanner(s.id, b.id, { subtitle: e.target.value })}
                                aria-label={`${b.id} subtitle`}
                                placeholder="Subtitle"
                              />
                              <Input
                                value={b.imageUrl ?? ""}
                                onChange={(e) => patchBanner(s.id, b.id, { imageUrl: e.target.value })}
                                aria-label={`${b.id} image url`}
                                placeholder="Image URL"
                              />
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default SuperSdui;