"use client";
import { MapPin, Search, ChevronRight } from "lucide-react";
import type { SduiLayoutPayload, SduiWidget } from "@/lib/sdui/layoutSchema";
import rawCss from "./controlPlane.module.css";

type PreviewClass =
  | "mono"
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
  | "phoneWrap";

const css = rawCss as unknown as Record<PreviewClass, string>;

interface Props {
  payload: SduiLayoutPayload | null;
  /** Server-adjusted epoch millis (client clock + measured offset). */
  now: number;
  locationLabel: string;
  versionNum: number | null;
}

type Phase = "scheduled" | "live" | "expired";

function phaseOf(widget: SduiWidget, now: number): Phase {
  const schedule = widget.schedule;
  if (!schedule) return "live";
  const start = Date.parse(schedule.starts_at_utc);
  const end = Date.parse(schedule.expires_at_utc);
  if (!Number.isNaN(start) && now < start) return "scheduled";
  if (!Number.isNaN(end) && now >= end) return "expired";
  return "live";
}

function countdown(endIso: string, now: number): string {
  const remaining = Math.max(0, Date.parse(endIso) - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function HeroCard({ widget, now }: { widget: SduiWidget; now: number }) {
  const copy = widget.copy;
  const headline = copy?.headline ?? "Campaign headline";
  const accent = copy?.accent_headline;
  const [before, after] = accent && headline.includes(accent) ? headline.split(accent) : [headline, ""];
  const phase = phaseOf(widget, now);
  return (
    <div
      className={css.phoneHero}
      style={{ background: "radial-gradient(120% 80% at 78% 20%, #6d1a1a 0%, #4a1010 45%, #2b0909 100%)" }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 12% 78%, rgba(242,166,59,0.16) 0 18%, transparent 19%), radial-gradient(circle at 88% 88%, rgba(242,166,59,0.12) 0 22%, transparent 23%)",
          pointerEvents: "none",
        }}
      />
      {widget.media?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={widget.media.url}
          alt={copy?.headline ?? "Banner artwork"}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
        />
      ) : null}
      <p className={css.phoneHeroEyebrow}>{copy?.eyebrow ?? "FAAZIO"}</p>
      <p className={css.phoneHeroHeadline}>
        {before}
        {accent ? <span className={css.phoneHeroAccent}>{accent}</span> : null}
        {after}
      </p>
      {copy?.code ? (
        <span className={css.phoneCode}>
          {copy.code_label ? `${copy.code_label} ` : ""}
          <strong>{copy.code}</strong>
        </span>
      ) : null}
      <span className={css.phoneCta}>
        {copy?.cta ?? "Order now"}
        <ChevronRight size={13} strokeWidth={2.5} />
      </span>
      {widget.schedule && phase === "live" ? (
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(10,13,17,0.7)",
            color: "#f6c453",
            borderRadius: 999,
            padding: "3px 9px",
            fontSize: 10,
            letterSpacing: "0.08em",
          }}
        >
          ENDS {countdown(widget.schedule.expires_at_utc, now)}
        </span>
      ) : null}
      {phase === "expired" && widget.schedule?.on_expire_action === "LOCK_OVERLAY" ? (
        <div className={css.phoneOverlay}>Offer ended</div>
      ) : null}
      {phase === "scheduled" ? (
        <div className={css.phoneOverlay}>
          Scheduled · {new Date(widget.schedule?.starts_at_utc ?? "").toISOString().slice(11, 16)}Z
        </div>
      ) : null}
    </div>
  );
}

function SimpleCard({ widget }: { widget: SduiWidget }) {
  return (
    <div className={css.phoneEmpty} style={{ textAlign: "left", borderStyle: "solid" }}>
      <strong style={{ display: "block", color: "#E8EDF3", letterSpacing: "0.1em", fontSize: 10 }}>
        {widget.type.replaceAll("_", " ")}
      </strong>
      {widget.copy?.headline ?? widget.widget_id}
    </div>
  );
}

export function PhonePreview({ payload, now, locationLabel, versionNum }: Props) {
  const widgets = payload?.widgets ?? [];
  const heroes = widgets
    .filter((w) => w.type === "HERO_PROMO_BANNER" || w.type === "OFFER_STRIP")
    .sort((a, b) => a.priority - b.priority);
  const others = widgets
    .filter((w) => w.type !== "HERO_PROMO_BANNER" && w.type !== "OFFER_STRIP")
    .sort((a, b) => a.priority - b.priority);

  const primary = heroes[0] ?? null;
  const primaryPhase = primary ? phaseOf(primary, now) : null;
  const swapped = primary && primaryPhase === "expired" && primary.schedule?.on_expire_action === "SWAP_TO_FALLBACK";
  const fallback = swapped
    ? heroes.find((w) => w.widget_id === primary?.schedule?.fallback_widget_id) ??
      widgets.find((w) => w.widget_id === primary?.schedule?.fallback_widget_id)
    : undefined;
  const shown = (swapped ? fallback : primary) ?? null;

  const theme = payload?.header_theme;
  const statusBar = theme?.status_bar_style === "dark" ? "#0F1419" : "#FFFFFF";
  const time = new Date(now);
  const clock = `${String(time.getUTCHours()).padStart(2, "0")}:${String(time.getUTCMinutes()).padStart(2, "0")}`;

  return (
    <div className={css.phoneWrap}>
      <div className={css.phone} role="img" aria-label="Live phone preview of this layout">
        <div style={{ background: theme?.background_hex ?? "#0F1419" }}>
          <div className={css.phoneStatus} style={{ color: statusBar }}>
            <span className={css.mono}>{clock}Z</span>
            <span>{statusBar === "#FFFFFF" ? "light status bar" : "dark status bar"}</span>
          </div>
          <div
            className={css.phoneSearch}
            style={{ background: theme?.search_bar_bg_hex ?? "#1B242E" }}
          >
            <MapPin size={13} color="#FFFFFF" />
            <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{locationLabel}</span>
            <span style={{ opacity: 0.4, color: "#FFFFFF" }}>|</span>
            <Search size={13} color="rgba(255,255,255,0.75)" />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Search restaurants...
            </span>
          </div>
        </div>
        <div className={css.phoneBody} style={{ background: theme?.background_hex ?? "#0F1419" }}>
          {shown ? <HeroCard widget={shown} now={now} /> : <div className={css.phoneEmpty}>No hero widget in this layout</div>}
          {others.map((w) => (
            <SimpleCard key={w.widget_id} widget={w} />
          ))}
          {!payload ? <div className={css.phoneEmpty}>Publish or import a layout to preview it</div> : null}
        </div>
      </div>
      <p className={css.phoneCaption}>
        {versionNum ? `v${versionNum}` : "draft"} · server clock · ttl 60s
      </p>
    </div>
  );
}
