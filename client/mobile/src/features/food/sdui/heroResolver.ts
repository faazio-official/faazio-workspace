import type { SduiWidget } from '@/services/api/sduiLayout';

const MAX_FALLBACK_HOPS = 4;

function windowState(
  widget: SduiWidget,
  now: number,
): 'live' | 'scheduled' | 'expired' {
  const s = widget.schedule;
  if (!s) return 'live';
  const start = Date.parse(s.starts_at_utc);
  const end = Date.parse(s.expires_at_utc);
  if (!Number.isNaN(start) && now < start) return 'scheduled';
  if (!Number.isNaN(end) && now >= end) return 'expired';
  return 'live';
}

/** Follow a SWAP_TO_FALLBACK chain to the first widget that can actually render now. */
function followFallback(byId: Map<string, SduiWidget>, id: string, now: number): SduiWidget | null {
  let current = byId.get(id);
  for (let hop = 0; current && hop < MAX_FALLBACK_HOPS; hop += 1) {
    if (windowState(current, now) === 'live') return current;
    const nextId = current.schedule?.on_expire_action === 'SWAP_TO_FALLBACK' ? current.schedule.fallback_widget_id : undefined;
    if (!nextId) return null;
    current = byId.get(nextId);
  }
  return null;
}

/**
 * Pick the hero widget the food home should render right now, server-clock ruled.
 *
 * Priority order wins among heroes whose window is open. An expired hero resolves its
 * `on_expire_action`: SWAP_TO_FALLBACK follows `fallback_widget_id` (pre-delivered in the same
 * payload, so the swap costs no network call); LOCK_OVERLAY keeps the widget so the banner can dim
 * itself with "Offer ended". A hero that has not started yet is skipped in favour of anything live.
 * Returns null when nothing renders — the caller then falls back to its own hero.
 */
export function selectHeroWidget(widgets: SduiWidget[], now: number): SduiWidget | null {
  const heroes = widgets.filter((w) => w.type === 'HERO_PROMO_BANNER');
  if (heroes.length === 0) return null;
  const byId = new Map(heroes.map((w) => [w.widget_id, w]));

  for (const widget of heroes) {
    const state = windowState(widget, now);
    if (state === 'live') return widget;
    if (state === 'expired') {
      if (widget.schedule?.on_expire_action === 'LOCK_OVERLAY') return widget;
      const fallbackId = widget.schedule?.fallback_widget_id;
      if (fallbackId) {
        const resolved = followFallback(byId, fallbackId, now);
        if (resolved) return resolved;
        continue;
      }
      // Expired with no usable fallback: keep it rendered so LOCK-style honesty survives.
      return widget;
    }
    // 'scheduled' — a not-yet-open window never blocks a live hero.
  }
  return null;
}

export interface SduiHeroTarget {
  couponCode?: string;
  route: string;
}

/**
 * Resolve a hero's deep link to a real destination. Only the offer route is defined today:
 * `faazio://food/offers/<CODE>` hands the coupon to the central cart, the one surface that
 * honours a coupon code. Unknown or NONE actions return null — the banner then renders without
 * a tappable CTA instead of promising a navigation that does not exist.
 */
export function resolveHeroTarget(widget: SduiWidget): SduiHeroTarget | null {
  const action = widget.action;
  if (!action || action.type !== 'DEEP_LINK' || !action.route) return null;
  const match = /^faazio:\/\/food\/offers\/([^/?#]+)/i.exec(action.route);
  if (!match) return null;
  return { route: action.route, couponCode: decodeURIComponent(match[1]) };
}
