"use client";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/patterns/SectionCard";
import { StatusPill } from "@/components/patterns/Pills";
import { resolveImage, uploadProductImage } from "@/lib/media/productImages";
import { requestHeroCampaign } from "@/lib/api";
import { useMenus, useProducts, useStores } from "@/lib/api/hooks";
import {
  CATEGORY_OPTIONS,
  HERO_PLACEMENT_META,
  PLACEMENT_REACH_NOTE,
  TARGET_TABS,
  eligiblePlacementsFor,
  type TargetTabKey,
} from "@/data/ads/placements";
import type { AdTargetType, HeroPlacement, Sector } from "@/data/types";

const CTAS = ["Shop Now", "Order Now", "View Store", "Explore"] as const;

interface SelectedTarget {
  type: AdTargetType;
  id: string;
  label: string;
  app: Sector;
  storeId?: string | undefined;
  imageUrl?: string | undefined;
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Five-step self-serve wizard: what to promote → where → creative → when → review. Placement choices
 * are inferred from the target's sub-app + type (`eligiblePlacementsFor`), so a Mart product can never
 * land on a Food/Pharma surface. Publish is instant + machine-checked (no admin approval); the
 * optimistic LIVE row rolls back if the gateway rejects the write.
 */
export function CampaignWizard({ sellerId, stateCode }: { sellerId: string; stateCode?: string | undefined }) {
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<TargetTabKey>("PRODUCT");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<SelectedTarget | null>(null);

  const [placements, setPlacements] = useState<HeroPlacement[]>([]);
  const [category, setCategory] = useState("");

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [cta, setCta] = useState<(typeof CTAS)[number]>("Shop Now");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [startsAt, setStartsAt] = useState(isoDaysFromNow(0));
  const [endsAt, setEndsAt] = useState(isoDaysFromNow(30));
  const [submitting, setSubmitting] = useState(false);

  const products = useProducts({ sellerId, status: "ACTIVE" });
  const dishes = useMenus({ sellerId });
  const stores = useStores({ sellerId });

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    if (tab === "PRODUCT") {
      return products
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.productId.includes(q))
        .map((p) => ({
          id: p.productId,
          label: p.name,
          app: p.sector,
          storeId: p.storeId,
          imageUrl: p.imageUrl,
        }));
    }
    if (tab === "DISH") {
      return dishes
        .filter((m) => !q || m.name.toLowerCase().includes(q))
        .map((m) => ({
          id: m.dishId,
          label: m.name,
          app: "FOOD" as Sector,
          storeId: m.venueId,
          imageUrl: m.image,
        }));
    }
    return stores
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({
        id: s.storeId,
        label: s.name,
        app: s.sector,
        storeId: s.storeId,
        imageUrl: undefined,
      }));
  }, [tab, products, dishes, stores, q]);

  const allowed = target ? eligiblePlacementsFor(target.app, target.type) : [];
  const needsCategory = placements.includes("CATEGORY_TOP");
  const needsStore = placements.includes("STORE_TOP");

  function chooseTarget(row: { id: string; label: string; app: Sector; storeId: string; imageUrl?: string | undefined }) {
    setTarget({ type: tab, id: row.id, label: row.label, app: row.app, storeId: row.storeId, imageUrl: row.imageUrl });
    setPlacements([]);
    setCategory("");
  }

  function togglePlacement(p: HeroPlacement) {
    setPlacements((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function pickPoster(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const key = await uploadProductImage(file, "BANNER");
      const url = resolveImage(key) ?? key;
      if (url.startsWith("data:") || url.startsWith("blob:")) {
        toast.error("Poster uploads need storage configured — paste a hosted image URL instead.");
      } else {
        setImageUrl(url);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That image could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  const canNext =
    (step === 0 && !!target) ||
    (step === 1 && placements.length > 0 && (!needsCategory || category !== "") && (!needsStore || !!target?.storeId)) ||
    (step === 2 &&
      title.trim().length > 0 &&
      title.trim().length <= 40 &&
      subtitle.trim().length <= 60 &&
      imageUrl.trim().length > 0) ||
    step === 3;

  function submit() {
    if (!target) return;
    setSubmitting(true);
    requestHeroCampaign({
      sellerId,
      placements,
      targetType: target.type,
      targetId: target.id,
      targetApp: target.app,
      category: needsCategory ? category : undefined,
      storeId: needsStore ? target.storeId : undefined,
      title: title.trim(),
      subtitle: subtitle.trim(),
      imageUrl: imageUrl.trim(),
      cta,
      stateCode,
      startsAt: new Date(`${startsAt}T00:00:00Z`).toISOString(),
      endsAt: new Date(`${endsAt}T23:59:59Z`).toISOString(),
    });
    toast.success("Ad is live now — it was machine-checked, not admin-approved.");
    setSubmitting(false);
    setStep(0);
    setTarget(null);
    setPlacements([]);
    setTitle("");
    setSubtitle("");
    setImageUrl("");
    setCategory("");
  }

  const steps = ["What", "Where", "Creative", "When", "Review"];

  return (
    <SectionCard
      title="New hero campaign"
      description="Promote one of your own items — goes live instantly, machine-checked (owner, placement fit, poster, length, caps)."
    >
      {/* Step rail */}
      <ol className="mb-5 flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ring-1 ${
              i === step
                ? "bg-primary/10 text-primary ring-primary/30"
                : i < step
                  ? "bg-success/10 text-success ring-success/25"
                  : "bg-secondary text-muted-foreground ring-border"
            }`}
          >
            {i < step ? <Check className="size-3.5" /> : <span className="num">{i + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TARGET_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setQuery("");
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition-colors ${
                  tab === t.key ? "bg-primary text-primary-foreground ring-primary" : "bg-secondary text-muted-foreground ring-border"
                }`}
              >
                {t.key === "PRODUCT" ? <ShoppingBag className="size-3.5" /> : t.key === "DISH" ? <UtensilsCrossed className="size-3.5" /> : <Store className="size-3.5" />}
                {t.label}
              </button>
            ))}
          </div>
          <Input placeholder="Search your items…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-muted-foreground">No items match. Add a listing first.</p>
            ) : (
              rows.map((row) => {
                const selected = target?.id === row.id && target.type === tab;
                return (
                  <button
                    key={`${tab}-${row.id}`}
                    type="button"
                    onClick={() => chooseTarget(row)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    {row.imageUrl ? (
                      <img src={resolveImage(row.imageUrl) ?? row.imageUrl} alt="" className="size-10 rounded object-cover" />
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded bg-muted text-muted-foreground">
                        <Store className="size-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{row.label}</span>
                      <span className="num block text-[11px] text-muted-foreground">
                        {row.id} · {row.app}
                      </span>
                    </span>
                    {selected ? <Check className="size-4 text-primary" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {allowed.map((p) => {
              const meta = HERO_PLACEMENT_META[p];
              const on = placements.includes(p);
              return (
                <label
                  key={p}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    on ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={on} onChange={() => togglePlacement(p)} />
                  <span>
                    <span className="block text-[13px] font-semibold">{meta.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{meta.hint}</span>
                    <span className="block text-[11px] text-primary/80">{PLACEMENT_REACH_NOTE[p]}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {needsCategory && (
            <div className="space-y-1.5">
              <Label>Category page</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-[13px]"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Pick a category…</option>
                {CATEGORY_OPTIONS[target?.app ?? "MART"].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {needsStore && (
            <p className="rounded-md bg-secondary px-3 py-2 text-[12px] text-muted-foreground">
              Store header shows on <span className="font-medium text-foreground">{target?.storeId ?? "—"}</span> (the store your item belongs to).
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5 md:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title (max 40)</Label>
              <Input maxLength={40} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Big Savings Everyday" />
              <p className="num text-[11px] text-muted-foreground">{title.length}/40</p>
            </div>
            <div className="space-y-1.5">
              <Label>Subtitle (max 60)</Label>
              <Input maxLength={60} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="UP TO 50% OFF" />
              <p className="num text-[11px] text-muted-foreground">{subtitle.length}/60</p>
            </div>
            <div className="space-y-1.5">
              <Label>16:9 poster</Label>
              <div className="flex items-center gap-3">
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                  Upload poster
                </Button>
                <span className="text-[12px] text-muted-foreground">or paste a hosted URL</span>
              </div>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/hero.jpg" />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickPoster(e.target.files?.[0]); e.target.value = ""; }} />
              <p className="text-[11px] text-muted-foreground">External image links are rejected; upload to Faazio so the poster is served from our CDN.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Call to action</Label>
              <div className="flex flex-wrap gap-2">
                {CTAS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCta(c)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ${
                      cta === c ? "bg-primary text-primary-foreground ring-primary" : "bg-secondary text-muted-foreground ring-border"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Phone-frame preview (16:9 hero) */}
          <div className="space-y-2">
            <p className="text-[12px] font-medium text-muted-foreground">Live preview</p>
            <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm">
              <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
                {imageUrl ? (
                  <img src={resolveImage(imageUrl) ?? imageUrl} alt="" className="size-full object-cover" />
                ) : null}
                <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  Ad
                </span>
                <div className="absolute inset-x-3 bottom-2">
                  <p className="text-[13px] font-extrabold leading-tight text-white">{title || "Your title"}</p>
                  {subtitle ? <p className="text-[10px] font-semibold text-slate-200">{subtitle}</p> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Starts</Label>
            <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ends (default +30 days, max 90)</Label>
            <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
          <p className="sm:col-span-2 rounded-md bg-secondary px-3 py-2 text-[12px] text-muted-foreground">
            Your ad goes live the moment you publish. Position within a placement is by relevance and recency; impressions and clicks roll up on your dashboard.
          </p>
        </div>
      )}

      {step === 4 && target && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="relative aspect-[2/1] bg-muted">
              {imageUrl ? (
                <img src={resolveImage(imageUrl) ?? imageUrl} alt="" className="size-full object-cover" />
              ) : null}
              <div className="absolute inset-x-4 bottom-3">
                <p className="text-[15px] font-extrabold text-white">{title}</p>
                {subtitle ? <p className="text-[11px] font-semibold text-slate-200">{subtitle}</p> : null}
              </div>
              <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">Ad</span>
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            <Row label="Target" value={`${target.label} (${target.id})`} />
            <Row label="Sub-app" value={target.app} />
            <Row label="Placements" value={placements.map((p) => HERO_PLACEMENT_META[p].label).join(", ")} />
            <Row label="CTA" value={cta} />
            {needsCategory ? <Row label="Category" value={category} /> : null}
            {needsStore ? <Row label="Store" value={target.storeId ?? "—"} /> : null}
            <Row label="Window" value={`${startsAt} → ${endsAt}`} />
            <Row label="Status" value="" pill="LIVE" />
          </dl>
          <Button disabled={submitting} onClick={submit}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Publish now
          </Button>
        </div>
      )}

      <div className="mt-5 flex justify-between gap-2">
        <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </Button>
        {step < 4 ? (
          <Button type="button" disabled={!canNext} onClick={() => setStep((s) => Math.min(4, s + 1))}>
            Next
          </Button>
        ) : (
          <span />
        )}
      </div>
    </SectionCard>
  );
}

function Row({ label, value, pill }: { label: string; value: string; pill?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 text-right font-medium">{pill ? <StatusPill status={pill} /> : value}</dd>
    </div>
  );
}