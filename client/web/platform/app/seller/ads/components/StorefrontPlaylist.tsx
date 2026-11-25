"use client";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Megaphone,
  Pause,
  Pencil,
  Play,
  Plus,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, EmptyState } from "@/components/sellers/kit";
import { resolveImage, uploadProductImage } from "@/lib/media/productImages";
import { useHeroCampaigns, useProducts, useSellerScope } from "@/lib/api/hooks";
import { deleteShopAd, reorderShopAds, saveShopAd, updateShopAd, type ShopAdPatch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { HeroCampaign } from "@/data/types";

const CTA_OPTIONS = ["Shop Now", "Order Now", "View Store", "Buy Now"] as const;
type Cta = (typeof CTA_OPTIONS)[number];

type TargetType = "PRODUCT" | "STORE";

interface Editor {
  placementId?: string;
  targetType: TargetType;
  targetId: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  cta: Cta;
  startsAt?: string;
  endsAt?: string;
}

function statusPill(status: HeroCampaign["status"]): string {
  if (status === "LIVE") return "bg-success-soft text-success";
  if (status === "DRAFT") return "bg-warning-soft text-warning";
  if (status === "REJECTED") return "bg-brand-soft text-brand";
  return "bg-info-soft text-info";
}

/**
 * Per-shop storefront playlist: the ordered STORE_TOP carousel a seller shows at the top of their
 * shop page. Creatives are saved as DRAFT (hidden from the app) and played LIVE; "click target" is
 * one of this shop's own products or the shop itself. Order is explicit (up/down → sort_order), and
 * the customer app renders the LIVE rows in that order.
 */
export function StorefrontPlaylist({ sellerId, stateCode }: { sellerId: string; stateCode?: string | undefined }) {
  const { storeId, activeStore } = useSellerScope();
  const campaigns = useHeroCampaigns({ sellerId, storeId: storeId || undefined });
  const products = useProducts({ sellerId, storeId: storeId || undefined, status: "ACTIVE" });

  const playlist = useMemo(
    () =>
      campaigns
        .filter((c) => c.placement === "STORE_TOP")
        .sort((a, b) => a.sortOrder - b.sortOrder || a.requestedAt.localeCompare(b.requestedAt)),
    [campaigns],
  );

  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const shopName = activeStore?.name ?? "this shop";

  function targetLabel(c: HeroCampaign): string {
    if (c.targetType === "STORE" || c.targetType === "VENUE") return shopName;
    const product = products.find((p) => p.productId === c.targetId);
    return product?.name ?? c.targetId;
  }

  function openNew() {
    setEditor({
      targetType: "STORE",
      targetId: storeId,
      title: "",
      subtitle: "",
      imageUrl: "",
      cta: "Shop Now",
    });
  }

  function openEdit(c: HeroCampaign) {
    setEditor({
      placementId: c.placementId,
      targetType: c.targetType === "PRODUCT" ? "PRODUCT" : "STORE",
      targetId: c.targetId,
      title: c.title,
      subtitle: c.subtitle ?? "",
      imageUrl: c.imageUrl ?? "",
      cta: (CTA_OPTIONS as readonly string[]).includes(c.cta ?? "") ? (c.cta as Cta) : "Shop Now",
      startsAt: c.startsAt,
      endsAt: c.endsAt,
    });
  }

  function patchFrom(c: HeroCampaign, status: "DRAFT" | "LIVE"): ShopAdPatch {
    return {
      storeId,
      targetType: c.targetType,
      targetId: c.targetId,
      title: c.title,
      subtitle: c.subtitle ?? "",
      imageUrl: c.imageUrl ?? "",
      cta: c.cta ?? "Shop Now",
      status,
      sortOrder: c.sortOrder,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
    };
  }

  async function persist(status: "DRAFT" | "LIVE") {
    if (!editor) return;
    if (editor.title.trim().length === 0 || editor.imageUrl.trim().length === 0) {
      toast.error("Add a title and a poster before saving.");
      return;
    }
    setSaving(true);
    try {
      if (editor.placementId) {
        const existing = playlist.find((c) => c.placementId === editor.placementId);
        await updateShopAd(editor.placementId, {
          storeId,
          targetType: editor.targetType,
          targetId: editor.targetId,
          title: editor.title.trim(),
          subtitle: editor.subtitle.trim(),
          imageUrl: editor.imageUrl.trim(),
          cta: editor.cta,
          status,
          sortOrder: existing?.sortOrder ?? 0,
          startsAt: editor.startsAt,
          endsAt: editor.endsAt,
        });
      } else {
        await saveShopAd({
          sellerId,
          storeId,
          stateCode,
          targetType: editor.targetType,
          targetId: editor.targetId,
          title: editor.title.trim(),
          subtitle: editor.subtitle.trim(),
          imageUrl: editor.imageUrl.trim(),
          cta: editor.cta,
          status,
          sortOrder: playlist.length,
          startsAt: editor.startsAt,
          endsAt: editor.endsAt,
        });
      }
      toast.success(status === "DRAFT" ? "Draft saved." : "Ad is live on your shop page.");
      setEditor(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That ad could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function pickPoster(file: File | undefined) {
    if (!file || !editor) return;
    setUploading(true);
    try {
      const key = await uploadProductImage(file, "BANNER");
      const url = resolveImage(key) ?? key;
      if (url.startsWith("data:") || url.startsWith("blob:")) {
        toast.error("Poster uploads need storage configured — paste a hosted image URL instead.");
      } else {
        setEditor((cur) => (cur ? { ...cur, imageUrl: url } : cur));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That image could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function move(index: number, delta: number) {
    const j = index + delta;
    if (j < 0 || j >= playlist.length) return;
    const next = [...playlist];
    const a = next[index];
    const b = next[j];
    if (!a || !b) return;
    next[index] = b;
    next[j] = a;
    try {
      await reorderShopAds(
        sellerId,
        storeId,
        next.map((c) => c.placementId),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order could not be saved.");
    }
  }

  async function togglePlay(c: HeroCampaign) {
    const next = c.status === "LIVE" ? "DRAFT" : "LIVE";
    try {
      await updateShopAd(c.placementId, patchFrom(c, next));
      toast.success(next === "LIVE" ? "Ad is playing." : "Ad paused (saved as draft).");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That ad could not be updated.");
    }
  }

  async function remove(c: HeroCampaign) {
    try {
      await deleteShopAd(c.placementId);
      toast.success("Ad deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That ad could not be deleted.");
    }
  }

  if (!storeId || !activeStore) {
    return (
      <Card>
        <p className="text-sm font-bold">Shop page ads</p>
        <p className="mt-1 text-xs text-muted-foreground">Pick a shop to manage its banner playlist.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">Shop page ads</p>
          <p className="text-[10px] text-muted-foreground">
            The carousel on <span className="font-medium text-foreground">{shopName}</span>&apos;s page —
            draft, reorder and choose what each banner opens.
          </p>
        </div>
        {!editor ? (
          <Button size="sm" variant="outline" onClick={openNew} disabled={playlist.length >= 8}>
            <Plus className="size-4" />
            Add
          </Button>
        ) : null}
      </div>

      {editor ? (
        <div className="space-y-3 rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold">{editor.placementId ? "Edit ad" : "New ad"}</p>
            <Button size="sm" variant="ghost" onClick={() => setEditor(null)} aria-label="Close editor">
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Opens</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-[13px]"
              value={`${editor.targetType}:${editor.targetId}`}
              onChange={(e) => {
                const [type, id] = e.target.value.split(":");
                setEditor((cur) =>
                  cur ? { ...cur, targetType: type as TargetType, targetId: id ?? "" } : cur,
                );
              }}
            >
              <option value={`STORE:${storeId}`}>This shop page</option>
              {products.map((p) => (
                <option key={p.productId} value={`PRODUCT:${p.productId}`}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Title (max 40)</Label>
            <Input
              maxLength={40}
              value={editor.title}
              onChange={(e) => setEditor((cur) => (cur ? { ...cur, title: e.target.value } : cur))}
              placeholder="Big Savings Everyday"
            />
            <p className="num text-[11px] text-muted-foreground">{editor.title.length}/40</p>
          </div>

          <div className="space-y-1.5">
            <Label>Subtitle (max 60)</Label>
            <Input
              maxLength={60}
              value={editor.subtitle}
              onChange={(e) => setEditor((cur) => (cur ? { ...cur, subtitle: e.target.value } : cur))}
              placeholder="UP TO 50% OFF"
            />
          </div>

          <div className="space-y-1.5">
            <Label>16:9 poster</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                Upload
              </Button>
              <span className="text-[12px] text-muted-foreground">or paste a hosted URL</span>
            </div>
            <Input
              value={editor.imageUrl}
              onChange={(e) => setEditor((cur) => (cur ? { ...cur, imageUrl: e.target.value } : cur))}
              placeholder="https://…/banner.jpg"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pickPoster(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Call to action</Label>
            <div className="flex flex-wrap gap-2">
              {CTA_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setEditor((cur) => (cur ? { ...cur, cta: c } : cur))}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12px] font-medium ring-1",
                    editor.cta === c
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-secondary text-muted-foreground ring-border",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {editor.imageUrl ? (
            <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
              <img src={resolveImage(editor.imageUrl) ?? editor.imageUrl} alt="" className="size-full object-cover" />
              <span className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white">
                Ad
              </span>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
                <p className="text-[13px] font-medium leading-tight text-white">
                  {editor.title || "Your title"}
                </p>
                {editor.subtitle ? <p className="text-[11px] text-white/80">{editor.subtitle}</p> : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={saving} onClick={() => void persist("DRAFT")}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save draft
            </Button>
            <Button disabled={saving} onClick={() => void persist("LIVE")}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Play now
            </Button>
          </div>
        </div>
      ) : playlist.length === 0 ? (
        <EmptyState
          text="No shop page ads yet — add a creative and it plays in order."
          icon={<Megaphone className="h-10 w-10" strokeWidth={1.3} />}
        />
      ) : (
        <ol className="space-y-2">
          {playlist.map((c, i) => (
            <li key={c.placementId} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {c.imageUrl ? (
                    <img src={resolveImage(c.imageUrl) ?? c.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Megaphone className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="num text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", statusPill(c.status))}>
                      {c.status}
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold">{c.title}</p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Store className="size-3" /> {targetLabel(c)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-end gap-1 border-t border-border pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move ad up"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void move(i, 1)}
                  disabled={i === playlist.length - 1}
                  aria-label="Move ad down"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)} aria-label="Edit ad">
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void togglePlay(c)}
                  aria-label={c.status === "LIVE" ? "Pause ad" : "Play ad"}
                >
                  {c.status === "LIVE" ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void remove(c)}
                  aria-label="Delete ad"
                  className="text-brand"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
