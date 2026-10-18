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
import { resolveImage, uploadProductImage } from "@/lib/media/productImages";
import type { SduiBanner, SduiCampaign, SduiSection } from "@/data/types";

/** Comma/newline separated id list -> trimmed, non-empty ids. */
function parseIds(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Uploads a banner image and returns the **resolved public Storage URL** (not the object key), so
 * the mobile app can render it directly from the ID-only doc. In seed mode (no Supabase Storage)
 * the uploader yields a data URL, which is far too large for the bounded SDUI doc — reject it and
 * tell the admin to paste a hosted URL instead.
 */
async function uploadBannerImage(file: File): Promise<string | null> {
  try {
    const key = await uploadProductImage(file);
    const url = resolveImage(key);
    if (!url || url.startsWith("data:") || url.startsWith("blob:")) {
      toast.error("Image uploads need Supabase Storage configured. Paste a hosted image URL instead.");
      return null;
    }
    return url;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "That image could not be uploaded.");
    return null;
  }
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

  const patchCampaign = (sectionId: string, campaignId: string, next: Partial<SduiCampaign>) => {
    setDraft((rows) =>
      rows.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              campaigns: (s.campaigns ?? []).map((c) =>
                c.id === campaignId ? { ...c, ...next } : c,
              ),
            }
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
                      {s.campaigns?.length ? <div>{s.campaigns.length} campaigns</div> : null}
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
                              <div className="flex items-center gap-2">
                                <Input
                                  value={b.imageUrl ?? ""}
                                  onChange={(e) => patchBanner(s.id, b.id, { imageUrl: e.target.value })}
                                  aria-label={`${b.id} image url`}
                                  placeholder="Image URL"
                                />
                                <label className="cursor-pointer whitespace-nowrap text-xs text-primary hover:underline">
                                  Upload
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = "";
                                      if (!file) return;
                                      const url = await uploadBannerImage(file);
                                      if (url) patchBanner(s.id, b.id, { imageUrl: url });
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {s.campaigns?.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted/30">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {s.id} campaigns (vendor store + catalog product ids; title/price are joined
                            from the directory/catalog on <span className="num">GET /home/campaigns</span>)
                          </p>
                          {s.campaigns.map((c) => (
                            <div
                              key={c.id}
                              className="grid grid-cols-1 gap-2 rounded border border-border p-2 md:grid-cols-4"
                            >
                              <div className="num self-center text-xs text-muted-foreground">{c.id}</div>
                              <Input
                                value={c.storeId}
                                onChange={(e) => patchCampaign(s.id, c.id, { storeId: e.target.value })}
                                aria-label={`${c.id} store id`}
                                placeholder="store-m1"
                              />
                              <Input
                                type="number"
                                min={1}
                                max={2}
                                value={c.carousel}
                                onChange={(e) =>
                                  patchCampaign(s.id, c.id, {
                                    carousel: Number(e.target.value) === 2 ? 2 : 1,
                                  })
                                }
                                aria-label={`${c.id} carousel`}
                                placeholder="Carousel 1|2"
                              />
                              <Textarea
                                value={c.productIds.join(", ")}
                                rows={2}
                                onChange={(e) =>
                                  patchCampaign(s.id, c.id, { productIds: parseIds(e.target.value) })
                                }
                                aria-label={`${c.id} product ids`}
                                placeholder="fm-m1, fm-m2, …"
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