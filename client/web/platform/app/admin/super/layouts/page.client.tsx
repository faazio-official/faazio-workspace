"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileJson,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import rawCss from "@/components/sdui/controlPlane.module.css";
import { PhonePreview } from "@/components/sdui/PhonePreview";
import {
  fetchSduiLiveLayout,
  listSduiDistricts,
  listSduiPointers,
  listSduiVersions,
  publishSduiLayout,
  rollbackSduiLayout,
  signSduiMediaUpload,
  uploadToR2,
  type SduiDistrict,
  type SduiLayoutVersion,
  type SduiPointer,
} from "@/lib/api/sduiLayouts";
import {
  SDUI_SCREENS,
  SDUI_VERTICALS,
  validateLayout,
  type LayoutIssue,
  type SduiLayoutPayload,
  type SduiScreen,
  type SduiVertical,
  type SduiWidget,
} from "@/lib/sdui/layoutSchema";
import { toWebp } from "@/lib/sdui/webp";

/** Every class in controlPlane.module.css (typed so `noPropertyAccessFromIndexSignature` holds). */
type PlaneClass =
  | "badge"
  | "badgeExpired"
  | "badgeLive"
  | "badgeScheduled"
  | "band"
  | "button"
  | "buttonGhost"
  | "buttonSmall"
  | "chip"
  | "control"
  | "dot"
  | "dotWarn"
  | "dropzone"
  | "errorPanel"
  | "eyebrow"
  | "field"
  | "fieldGrid"
  | "grid"
  | "headline"
  | "iconButton"
  | "input"
  | "issues"
  | "label"
  | "linkButton"
  | "mono"
  | "notice"
  | "panel"
  | "panelBody"
  | "panelHead"
  | "panelTitle"
  | "phone"
  | "phoneBody"
  | "phoneCaption"
  | "phoneCode"
  | "phoneCta"
  | "phoneEmpty"
  | "phoneHero"
  | "phoneHeroAccent"
  | "phoneHeroEyebrow"
  | "phoneHeroHeadline"
  | "phoneOverlay"
  | "phoneSearch"
  | "phoneStatus"
  | "phoneWrap"
  | "plane"
  | "railRight"
  | "row"
  | "skeleton"
  | "slotMeta"
  | "slotName"
  | "slotRow"
  | "status"
  | "statusCluster"
  | "subhead"
  | "tab"
  | "tabs"
  | "timeline"
  | "toolbar"
  | "versionMeta"
  | "versionNum"
  | "versionRow"
  | "widget"
  | "widgetActions"
  | "widgetId"
  | "widgetList"
  | "widgetType";

const css = rawCss as unknown as Record<PlaneClass, string>;

const SLOT_ORDER = ["top_header_theme", "hero_banner", "quick_filter_pills", "spotlight_rail"] as const;

function starterLayout(): SduiLayoutPayload {
  return {
    schema_version: "1.2",
    header_theme: { background_hex: "#2B0909", search_bar_bg_hex: "#421414", status_bar_style: "light" },
    widgets: [
      {
        widget_id: `hero_${Date.now().toString(36)}`,
        type: "HERO_PROMO_BANNER",
        slot: "hero_banner",
        priority: 1,
        copy: {
          eyebrow: "NEW CAMPAIGN",
          headline: "Set the headline",
          code_label: "CODE:",
          code: "",
          cta: "Order Now",
        },
        action: { type: "NONE" },
      },
    ],
  };
}

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 16).replace("T", " ")}Z`;
}

export default function SduiLayoutsPage() {
  const [vertical, setVertical] = useState<SduiVertical>("food");
  const [screen, setScreen] = useState<SduiScreen>("home");
  const [districtId, setDistrictId] = useState("");
  const [versions, setVersions] = useState<SduiLayoutVersion[]>([]);
  const [pointers, setPointers] = useState<SduiPointer[]>([]);
  const [districts, setDistricts] = useState<SduiDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [draft, setDraft] = useState<SduiLayoutPayload | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"builder" | "json">("builder");
  const [jsonText, setJsonText] = useState("");
  const [issues, setIssues] = useState<LayoutIssue[]>([]);
  const [note, setNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [busyVersion, setBusyVersion] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [previewSource, setPreviewSource] = useState<"server" | "draft">("server");
  const dragIndex = useRef<number | null>(null);

  const scope = useMemo(
    () => ({ vertical, screen, districtId }),
    [vertical, screen, districtId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([listSduiVersions(scope), listSduiPointers(scope), listSduiDistricts()])
      .then(([v, p, d]) => {
        if (cancelled) return;
        setVersions(v);
        setPointers(p);
        setDistricts(d);
        const live = v.find((row) => row.isLive) ?? v[0] ?? null;
        setDraft(live?.payload ? (live.payload as SduiLayoutPayload) : null);
        setJsonText(live?.payload ? JSON.stringify(live.payload, null, 2) : "");
        setDirty(false);
        setSelected(0);
        setIssues([]);
        setPreviewSource("server");
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load layouts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, reloadTick]);

  // Measure the server clock once per scope so the preview locks at the same second the app does.
  useEffect(() => {
    let cancelled = false;
    fetchSduiLiveLayout(scope)
      .then((live) => {
        if (!cancelled) setServerOffset(Date.parse(live.serverTimestampUtc) - Date.now());
      })
      .catch(() => {
        if (!cancelled) setServerOffset(0);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, reloadTick]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + serverOffset), 1000);
    setNow(Date.now() + serverOffset);
    return () => clearInterval(id);
  }, [serverOffset]);

  const liveVersion = versions.find((v) => v.isLive) ?? versions[0] ?? null;
  const panIndiaPointer = pointers.find((p) => p.districtId === "") ?? null;
  const scopedPointer = pointers.find((p) => p.districtId === districtId) ?? null;
  const activePointer = scopedPointer ?? panIndiaPointer;
  const districtLabel =
    districtId === "" ? "PAN_INDIA" : (districts.find((d) => d.code === districtId)?.name ?? districtId);

  const update = useCallback((next: SduiLayoutPayload) => {
    setDraft(next);
    setJsonText(JSON.stringify(next, null, 2));
    setDirty(true);
    setPreviewSource("draft");
    setIssues([]);
  }, []);

  const patchWidget = useCallback(
    (index: number, patch: Partial<SduiWidget>) => {
      setDraft((current) => {
        if (!current) return current;
        const widgets = current.widgets.map((w, i) => (i === index ? { ...w, ...patch } : w));
        const next = { ...current, widgets };
        setJsonText(JSON.stringify(next, null, 2));
        return next;
      });
      setDirty(true);
      setPreviewSource("draft");
      setIssues([]);
    },
    [],
  );

  const moveWidget = useCallback((from: number, to: number) => {
    setDraft((current) => {
      if (!current) return current;
      if (to < 0 || to >= current.widgets.length || from === to) return current;
      const widgets = [...current.widgets];
      const [moved] = widgets.splice(from, 1);
      if (!moved) return current;
      widgets.splice(to, 0, moved);
      const renumbered = widgets.map((w, i) => ({ ...w, priority: i + 1 }));
      const next = { ...current, widgets: renumbered };
      setJsonText(JSON.stringify(next, null, 2));
      setSelected(to);
      return next;
    });
    setDirty(true);
    setPreviewSource("draft");
  }, []);

  const addWidget = useCallback(() => {
    setDraft((current) => {
      const base = current ?? starterLayout();
      const id = `hero_${Date.now().toString(36)}`;
      const next: SduiLayoutPayload = {
        ...base,
        widgets: [
          ...base.widgets,
          {
            widget_id: id,
            type: "HERO_PROMO_BANNER",
            slot: "hero_banner",
            priority: base.widgets.length + 1,
            copy: { eyebrow: "NEW CAMPAIGN", headline: "Set the headline", cta: "Order Now" },
            action: { type: "NONE" },
          },
        ],
      };
      setJsonText(JSON.stringify(next, null, 2));
      setSelected(next.widgets.length - 1);
      return next;
    });
    setDirty(true);
    setPreviewSource("draft");
  }, []);

  const removeWidget = useCallback((index: number) => {
    setDraft((current) => {
      if (!current || current.widgets.length <= 1) return current;
      const widgets = current.widgets
        .filter((_, i) => i !== index)
        .map((w, i) => ({ ...w, priority: i + 1 }));
      const next = { ...current, widgets };
      setJsonText(JSON.stringify(next, null, 2));
      setSelected((s) => Math.min(s, widgets.length - 1));
      return next;
    });
    setDirty(true);
    setPreviewSource("draft");
  }, []);

  const applyJson = useCallback(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      setIssues([{ path: "$", message: err instanceof Error ? err.message : "invalid JSON" }]);
      return;
    }
    const result = validateLayout(parsed);
    if (!result.data) {
      setIssues(result.issues);
      return;
    }
    setDraft(result.data);
    setJsonText(JSON.stringify(result.data, null, 2));
    setIssues([]);
    setDirty(true);
    setPreviewSource("draft");
    toast.success("Layout is valid");
  }, [jsonText]);

  const importFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setIssues([{ path: "$", message: `${file.name} is not valid JSON` }]);
        return;
      }
      const result = validateLayout(parsed);
      setJsonText(text);
      setTab("json");
      if (!result.data) {
        setIssues(result.issues);
        toast.error(`${result.issues.length} schema error(s) in ${file.name}`);
        return;
      }
      setDraft(result.data);
      setIssues([]);
      setDirty(true);
      setPreviewSource("draft");
      toast.success(`${file.name} imported — review and publish`);
    } catch {
      toast.error("That file could not be read");
    }
  }, []);

  const exportJson = useCallback(() => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${vertical}-${screen}-${districtId || "PAN_INDIA"}-v${liveVersion ? liveVersion.versionNum : "draft"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [draft, vertical, screen, districtId, liveVersion]);

  const publish = useCallback(async () => {
    if (!draft) return;
    const check = validateLayout(draft);
    if (!check.data) {
      setIssues(check.issues);
      toast.error("Fix the schema errors before publishing");
      return;
    }
    setPublishing(true);
    try {
      const row = await publishSduiLayout({
        vertical,
        screen,
        districtId,
        payload: check.data,
        note: note.trim(),
      });
      toast.success(`Published v${row.versionNum} to ${districtLabel}`, {
        description: "Valkey cache for this screen was flushed — the next app request serves it.",
      });
      setNote("");
      setReloadTick((n) => n + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  }, [draft, vertical, screen, districtId, note, districtLabel]);

  const rollback = useCallback(
    async (versionId: string, versionNum: number) => {
      setBusyVersion(versionId);
      try {
        const ptr = await rollbackSduiLayout({ vertical, screen, districtId, versionId });
        toast.success(`Rolled back to v${versionNum}`, {
          description: `Pointer epoch is now ${ptr.epoch}; the screen cache was flushed.`,
        });
        setReloadTick((n) => n + 1);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Rollback failed");
      } finally {
        setBusyVersion(null);
      }
    },
    [vertical, screen, districtId],
  );

  const uploadMedia = useCallback(
    async (index: number, file: File) => {
      const kind = file.type === "application/json" ? "lottie" : file.type.startsWith("video/") ? "video" : "image";
      try {
        let upload = file;
        let contentType = file.type || (kind === "lottie" ? "application/json" : "application/octet-stream");
        if (kind === "image") {
          upload = await toWebp(file);
          contentType = upload.type;
        }
        const ticket = await signSduiMediaUpload({ filename: upload.name, contentType, kind });
        const publicUrl = await uploadToR2(ticket, upload, contentType);
        patchWidget(index, {
          media: { kind, url: publicUrl, aspect_ratio: "16:10" },
        });
        toast.success("Uploaded to R2 and injected the CDN URL");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [patchWidget],
  );

  const selectedWidget = draft?.widgets[selected] ?? null;
  const slots = SLOT_ORDER.map((slot) => ({
    slot,
    widgets: (draft?.widgets ?? []).filter((w) => w.slot === slot),
  }));
  const previewPayload = previewSource === "server" && liveVersion?.payload ? (liveVersion.payload as SduiLayoutPayload) : draft;
  const previewVersion = previewSource === "server" ? (liveVersion?.versionNum ?? null) : null;

  return (
    <main className={css.plane}>
      <header className={css.band}>
        <div>
          <p className={css.eyebrow}>SDUI control plane</p>
          <h1 className={css.headline}>Publish a district layout in under a minute</h1>
          <p className={css.subhead}>
            Fixed slots, strict schema validation and a version timeline that rolls back before the next Valkey read.
            Every widget shows its owner, its schedule and its fallback.
          </p>
        </div>
        <div className={css.statusCluster}>
          <span className={css.status}>
            <span className={css.dot} aria-hidden="true" />
            {vertical}/{screen}
          </span>
          <span className={css.status}>
            {activePointer
              ? `LIVE v${activePointer.versionNum} · ${activePointer.districtId === "" ? "PAN_INDIA" : activePointer.districtId}`
              : "NO LIVE LAYOUT"}
          </span>
          <span className={css.status}>
            EPOCH <strong className={css.mono}>{activePointer?.epoch ?? 0}</strong>
          </span>
          <span className={css.status}>
            <span className={`${css.dot} ${css.dotWarn}`} aria-hidden="true" />
            TTL 60s
          </span>
        </div>
      </header>

      <div className={css.toolbar}>
        <label className={css.field}>
          <span className={css.label}>Vertical</span>
          <select
            className={css.control}
            value={vertical}
            onChange={(e) => setVertical(e.target.value as SduiVertical)}
          >
            {SDUI_VERTICALS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className={css.field}>
          <span className={css.label}>Screen</span>
          <select
            className={css.control}
            value={screen}
            onChange={(e) => setScreen(e.target.value as SduiScreen)}
          >
            {SDUI_SCREENS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={css.field}>
          <span className={css.label}>District target</span>
          <select className={css.control} value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">PAN_INDIA (fallback)</option>
            {districts.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name} · {d.code}
              </option>
            ))}
          </select>
        </label>
        <div className={css.row} style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className={`${css.button} ${css.buttonGhost}`}
            onClick={() => setReloadTick((n) => n + 1)}
          >
            <RefreshCw size={14} /> Reload
          </button>
          <button type="button" className={css.button} onClick={publish} disabled={!draft || publishing}>
            <Send size={14} /> {publishing ? "Publishing…" : "Publish layout"}
          </button>
        </div>
      </div>

      {loadError ? (
        <div className={css.errorPanel} role="alert">
          <span>Layouts could not be loaded: {loadError}</span>
          <button
            type="button"
            className={`${css.button} ${css.buttonGhost} ${css.buttonSmall}`}
            onClick={() => setReloadTick((n) => n + 1)}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className={css.grid} aria-busy="true" aria-label="Loading layouts">
          {[0, 1, 2].map((i) => (
            <div key={i} className={css.panel}>
              <div className={css.panelBody}>
                <div className={css.skeleton} style={{ width: "48%" }} />
                <div className={css.skeleton} style={{ width: "82%" }} />
                <div className={css.skeleton} style={{ width: "64%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={css.grid}>
          {/* Slot map + widget order */}
          <section className={css.panel} aria-label="Slot map">
            <div className={css.panelHead}>
              <h2 className={css.panelTitle}>Slot map</h2>
              <button
                type="button"
                className={`${css.button} ${css.buttonGhost} ${css.buttonSmall}`}
                onClick={addWidget}
              >
                <Plus size={13} /> Widget
              </button>
            </div>
            <div className={css.panelBody}>
              {slots.map(({ slot, widgets }) => (
                <div key={slot} className={css.slotRow}>
                  <div className={css.row} style={{ justifyContent: "space-between" }}>
                    <span className={css.slotName}>{slot.replaceAll("_", " ")}</span>
                    <span className={css.badge}>{widgets.length} widget{widgets.length === 1 ? "" : "s"}</span>
                  </div>
                  <span className={css.slotMeta}>
                    {widgets.length === 0 ? "empty — apps render nothing here" : widgets.map((w) => w.widget_id).join(" · ")}
                  </span>
                </div>
              ))}

              <div className={css.row} style={{ justifyContent: "space-between", marginTop: 4 }}>
                <span className={css.slotName}>Render order</span>
                {dirty ? <span className={css.badgeScheduled + " " + css.badge}>unpublished</span> : null}
              </div>
              <ul className={css.widgetList}>
                {(draft?.widgets ?? []).map((w, index) => (
                  <li key={w.widget_id}>
                    <div
                      className={css.widget}
                      data-selected={index === selected}
                      draggable
                      onDragStart={() => {
                        dragIndex.current = index;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex.current !== null) moveWidget(dragIndex.current, index);
                        dragIndex.current = null;
                      }}
                      onClick={() => setSelected(index)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit widget ${w.widget_id}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(index);
                        }
                      }}
                    >
                      <span className={css.badge}>P{w.priority}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className={css.widgetType}>{w.type.replaceAll("_", " ")}</span>
                        <span className={css.widgetId}>{w.widget_id}</span>
                      </span>
                      <span className={css.widgetActions}>
                        <button
                          type="button"
                          className={css.iconButton}
                          aria-label={`Move ${w.widget_id} up`}
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveWidget(index, index - 1);
                          }}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className={css.iconButton}
                          aria-label={`Move ${w.widget_id} down`}
                          disabled={index === (draft?.widgets.length ?? 1) - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveWidget(index, index + 1);
                          }}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          className={css.iconButton}
                          aria-label={`Remove ${w.widget_id}`}
                          disabled={(draft?.widgets.length ?? 0) <= 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeWidget(index);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {!draft ? <p className={css.notice}>No layout in this scope yet. Import a JSON layout or add a widget.</p> : null}
            </div>
          </section>

          {/* Preview + editor */}
          <section className={css.panel} aria-label="Editor and phone preview">
            <div className={css.panelHead}>
              <h2 className={css.panelTitle}>Live phone frame</h2>
              <span className={`${css.badge} ${dirty ? css.badgeScheduled : css.badgeLive}`}>
                {previewSource === "server" ? "server payload" : "draft"}
              </span>
            </div>
            <div className={css.panelBody}>
              <PhonePreview
                payload={previewPayload}
                now={now}
                locationLabel={districtId === "" ? "All India" : districtLabel}
                versionNum={previewVersion}
              />

              <div className={css.tabs} role="tablist" aria-label="Editor mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "builder"}
                  className={css.tab}
                  data-active={tab === "builder"}
                  onClick={() => setTab("builder")}
                >
                  Builder
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "json"}
                  className={css.tab}
                  data-active={tab === "json"}
                  onClick={() => setTab("json")}
                >
                  JSON
                </button>
              </div>

              {tab === "builder" ? (
                selectedWidget && draft ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div className={css.fieldGrid}>
                      <label className={css.field}>
                        <span className={css.label}>Widget id</span>
                        <input
                          className={css.input}
                          value={selectedWidget.widget_id}
                          onChange={(e) => patchWidget(selected, { widget_id: e.target.value })}
                        />
                      </label>
                      <label className={css.field}>
                        <span className={css.label}>Type</span>
                        <select
                          className={css.input}
                          value={selectedWidget.type}
                          onChange={(e) => patchWidget(selected, { type: e.target.value as SduiWidget["type"] })}
                        >
                          {["HERO_PROMO_BANNER", "SPOTLIGHT_RAIL", "QUICK_FILTER_PILLS", "OFFER_STRIP"].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className={css.fieldGrid}>
                      <label className={css.field}>
                        <span className={css.label}>Slot</span>
                        <select
                          className={css.input}
                          value={selectedWidget.slot}
                          onChange={(e) => patchWidget(selected, { slot: e.target.value as SduiWidget["slot"] })}
                        >
                          {SLOT_ORDER.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={css.field}>
                        <span className={css.label}>Header hex</span>
                        <input
                          className={css.input}
                          value={draft.header_theme.background_hex}
                          onChange={(e) => {
                            update({
                              ...draft,
                              header_theme: { ...draft.header_theme, background_hex: e.target.value },
                            });
                          }}
                        />
                      </label>
                    </div>
                    <div className={css.fieldGrid}>
                      <label className={css.field}>
                        <span className={css.label}>Eyebrow</span>
                        <input
                          className={css.input}
                          value={selectedWidget.copy?.eyebrow ?? ""}
                          onChange={(e) =>
                            patchWidget(selected, { copy: { ...selectedWidget.copy, eyebrow: e.target.value } })
                          }
                        />
                      </label>
                      <label className={css.field}>
                        <span className={css.label}>Headline</span>
                        <input
                          className={css.input}
                          value={selectedWidget.copy?.headline ?? ""}
                          onChange={(e) =>
                            patchWidget(selected, { copy: { ...selectedWidget.copy, headline: e.target.value } })
                          }
                        />
                      </label>
                      <label className={css.field}>
                        <span className={css.label}>Accent</span>
                        <input
                          className={css.input}
                          value={selectedWidget.copy?.accent_headline ?? ""}
                          onChange={(e) =>
                            patchWidget(selected, {
                              copy: { ...selectedWidget.copy, accent_headline: e.target.value },
                            })
                          }
                        />
                      </label>
                      <label className={css.field}>
                        <span className={css.label}>CTA</span>
                        <input
                          className={css.input}
                          value={selectedWidget.copy?.cta ?? ""}
                          onChange={(e) =>
                            patchWidget(selected, { copy: { ...selectedWidget.copy, cta: e.target.value } })
                          }
                        />
                      </label>
                      <label className={css.field}>
                        <span className={css.label}>Coupon code</span>
                        <input
                          className={css.input}
                          value={selectedWidget.copy?.code ?? ""}
                          onChange={(e) =>
                            patchWidget(selected, { copy: { ...selectedWidget.copy, code: e.target.value } })
                          }
                        />
                      </label>
                      <label className={css.field}>
                        <span className={css.label}>Auto-apply coupon</span>
                        <input
                          className={css.input}
                          value={selectedWidget.action?.auto_apply_coupon ?? ""}
                          onChange={(e) =>
                            patchWidget(selected, {
                              action: { type: "DEEP_LINK", ...selectedWidget.action, auto_apply_coupon: e.target.value },
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className={css.fieldGrid}>
                      <label className={css.field}>
                        <span className={css.label}>Starts (UTC)</span>
                        <input
                          className={css.input}
                          value={selectedWidget.schedule?.starts_at_utc ?? ""}
                          onChange={(e) =>
                            patchWidget(selected, {
                              schedule: {
                                on_expire_action: "SWAP_TO_FALLBACK",
                                ...selectedWidget.schedule,
                                starts_at_utc: e.target.value,
                                expires_at_utc: selectedWidget.schedule?.expires_at_utc ?? e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label className={css.field}>
                        <span className={css.label}>Expires (UTC)</span>
                        <input
                          className={css.input}
                          value={selectedWidget.schedule?.expires_at_utc ?? ""}
                          onChange={(e) =>
                            patchWidget(selected, {
                              schedule: {
                                on_expire_action: "SWAP_TO_FALLBACK",
                                ...selectedWidget.schedule,
                                starts_at_utc: selectedWidget.schedule?.starts_at_utc ?? e.target.value,
                                expires_at_utc: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className={css.row}>
                      <label className={css.field} style={{ flex: 1 }}>
                        <span className={css.label}>On expiry</span>
                        <select
                          className={css.input}
                          value={selectedWidget.schedule?.on_expire_action ?? "SWAP_TO_FALLBACK"}
                          onChange={(e) =>
                            patchWidget(selected, {
                              schedule: {
                                starts_at_utc: selectedWidget.schedule?.starts_at_utc ?? "",
                                expires_at_utc: selectedWidget.schedule?.expires_at_utc ?? "",
                                ...selectedWidget.schedule,
                                on_expire_action: e.target.value as "SWAP_TO_FALLBACK" | "LOCK_OVERLAY",
                              },
                            })
                          }
                        >
                          <option value="SWAP_TO_FALLBACK">SWAP_TO_FALLBACK</option>
                          <option value="LOCK_OVERLAY">LOCK_OVERLAY</option>
                        </select>
                      </label>
                      <label className={css.field} style={{ flex: 1 }}>
                        <span className={css.label}>Fallback widget</span>
                        <select
                          className={css.input}
                          value={selectedWidget.schedule?.fallback_widget_id ?? ""}
                          onChange={(e) =>
                            patchWidget(selected, {
                              schedule: {
                                starts_at_utc: selectedWidget.schedule?.starts_at_utc ?? "",
                                expires_at_utc: selectedWidget.schedule?.expires_at_utc ?? "",
                                on_expire_action: selectedWidget.schedule?.on_expire_action ?? "SWAP_TO_FALLBACK",
                                fallback_widget_id: e.target.value,
                              },
                            })
                          }
                        >
                          <option value="">—</option>
                          {(draft.widgets ?? [])
                            .filter((w) => w.widget_id !== selectedWidget.widget_id)
                            .map((w) => (
                              <option key={w.widget_id} value={w.widget_id}>
                                {w.widget_id}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <label className={css.dropzone} data-active="false">
                      <input
                        type="file"
                        accept="image/webp,image/jpeg,image/png,application/json,video/mp4"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadMedia(selected, file);
                          e.target.value = "";
                        }}
                      />
                      <span className={css.row} style={{ justifyContent: "center" }}>
                        <ImageIcon size={14} /> Upload media — WebP, Lottie JSON or muted MP4 (R2)
                      </span>
                    </label>
                    {selectedWidget.media?.url ? (
                      <p className={css.notice} style={{ wordBreak: "break-all" }}>
                        media: {selectedWidget.media.kind} · {selectedWidget.media.url}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className={css.notice}>Select a widget, or add one to start a layout.</p>
                )
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <textarea
                    className={css.input}
                    style={{ minHeight: 260, padding: 10, fontFamily: "var(--cp-mono)", fontSize: 11 }}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    spellCheck={false}
                    aria-label="Layout JSON"
                  />
                  <div className={css.row}>
                    <button type="button" className={`${css.button} ${css.buttonSmall}`} onClick={applyJson}>
                      <FileJson size={13} /> Validate &amp; apply
                    </button>
                    <button
                      type="button"
                      className={`${css.button} ${css.buttonGhost} ${css.buttonSmall}`}
                      onClick={exportJson}
                      disabled={!draft}
                    >
                      <Download size={13} /> Download UI
                    </button>
                  </div>
                </div>
              )}

              {issues.length > 0 ? (
                <ul className={css.issues} aria-live="polite">
                  {issues.slice(0, 12).map((issue) => (
                    <li key={`${issue.path}-${issue.message}`}>
                      <code>{issue.path}</code> {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          {/* Right rail: publish, import, timeline */}
          <div className={css.railRight} style={{ display: "grid", gap: 16 }}>
            <section className={css.panel} aria-label="Publish">
              <div className={css.panelHead}>
                <h2 className={css.panelTitle}>Publish to {districtLabel}</h2>
                <span className={`${css.badge} ${scopedPointer ? css.badgeLive : ""}`}>
                  {scopedPointer ? `override v${scopedPointer.versionNum}` : "inherits PAN_INDIA"}
                </span>
              </div>
              <div className={css.panelBody}>
                <label
                  className={css.dropzone}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) void importFile(file);
                  }}
                >
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importFile(file);
                      e.target.value = "";
                    }}
                  />
                  <span className={css.row} style={{ justifyContent: "center" }}>
                    <Upload size={14} /> Upload UI — drop a .json layout to validate
                  </span>
                </label>
                <label className={css.field}>
                  <span className={css.label}>Release note</span>
                  <input
                    className={css.input}
                    value={note}
                    maxLength={240}
                    placeholder="Festive Chennai layout clone"
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button type="button" className={css.button} onClick={publish} disabled={!draft || publishing}>
                  <Send size={14} /> {publishing ? "Publishing…" : dirty ? "Publish draft" : "Publish current"}
                </button>
                <p className={css.notice}>
                  Publishing appends a version, bumps the pointer epoch and flushes <code>sdui:screen:{vertical}:{screen}:*</code>.
                </p>
              </div>
            </section>

            <section className={css.panel} aria-label="Version timeline">
              <div className={css.panelHead}>
                <h2 className={css.panelTitle}>Version timeline</h2>
                <span className={css.badge}>{versions.length} versions</span>
              </div>
              <div className={css.panelBody}>
                {versions.length === 0 ? (
                  <p className={css.notice}>
                    Nothing published for {districtLabel} yet. Apps fall back to the PAN_INDIA layout.
                  </p>
                ) : (
                  <ul className={css.timeline}>
                    {versions.map((v) => (
                      <li key={v.id} className={css.versionRow}>
                        <span>
                          <span className={css.versionNum}>
                            v{v.versionNum}{" "}
                            {v.isLive ? <span className={`${css.badge} ${css.badgeLive}`}>live</span> : null}
                          </span>
                          <span className={css.versionMeta}>
                            {stamp(v.publishedAt)} · {v.publishedBy ?? "system"}
                            {v.note ? ` · ${v.note}` : ""}
                          </span>
                        </span>
                        <button
                          type="button"
                          className={`${css.button} ${css.buttonGhost} ${css.buttonSmall}`}
                          disabled={v.isLive || busyVersion === v.id}
                          onClick={() => rollback(v.id, v.versionNum)}
                          aria-label={`Roll back to version ${v.versionNum}`}
                        >
                          <RotateCcw size={12} /> {busyVersion === v.id ? "…" : "Rollback"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className={css.panel} aria-label="District coverage">
              <div className={css.panelHead}>
                <h2 className={css.panelTitle}>District targeting</h2>
                <span className={css.badge}>{pointers.length} scopes</span>
              </div>
              <div className={css.panelBody}>
                {pointers.length === 0 ? (
                  <p className={css.notice}>No live scope yet.</p>
                ) : (
                  pointers.map((p) => (
                    <div key={p.districtId || "PAN_INDIA"} className={css.slotRow}>
                      <div className={css.row} style={{ justifyContent: "space-between" }}>
                        <span className={css.slotName}>{p.districtId || "PAN_INDIA"}</span>
                        <span className={css.badge}>v{p.versionNum}</span>
                      </div>
                      <span className={css.slotMeta}>
                        epoch {p.epoch} · updated {stamp(p.updatedAt)}
                      </span>
                    </div>
                  ))
                )}
                <p className={css.notice}>
                  A district without an override always answers from the PAN_INDIA row — cache key{" "}
                  <code>sdui:screen:{vertical}:{screen}:&lt;district&gt;</code>.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
