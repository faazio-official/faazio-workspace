// SDUI screen layout contract (schema 1.2) as served by GET /sdui/layout.
// The server validates every payload before storing it; the client still guards shape defensively
// because it renders a remote object. Authority: server/gateway/internal/sdui/control.go.

export type SduiMediaKind = 'image' | 'lottie' | 'video';
export type SduiExpireAction = 'SWAP_TO_FALLBACK' | 'LOCK_OVERLAY';
export type SduiStatusBarStyle = 'light' | 'dark';

export interface SduiHeaderTheme {
  background_hex: string;
  search_bar_bg_hex: string;
  status_bar_style: SduiStatusBarStyle;
}

export interface SduiWidgetMedia {
  kind: SduiMediaKind;
  url: string;
  fallback_image_url?: string;
  aspect_ratio?: string;
}

export interface SduiWidgetSchedule {
  starts_at_utc: string;
  expires_at_utc: string;
  on_expire_action: SduiExpireAction;
  fallback_widget_id?: string;
}

export interface SduiWidgetAction {
  type: 'DEEP_LINK' | 'NONE';
  route?: string;
  auto_apply_coupon?: string;
}

export interface SduiWidgetCopy {
  eyebrow?: string;
  headline?: string;
  accent_headline?: string;
  body?: string;
  code_label?: string;
  code?: string;
  cta?: string;
}

export interface SduiWidget {
  widget_id: string;
  type: 'HERO_PROMO_BANNER' | 'SPOTLIGHT_RAIL' | 'QUICK_FILTER_PILLS' | 'OFFER_STRIP';
  slot: 'top_header_theme' | 'hero_banner' | 'quick_filter_pills' | 'spotlight_rail';
  priority: number;
  media?: SduiWidgetMedia;
  schedule?: SduiWidgetSchedule;
  action?: SduiWidgetAction;
  copy?: SduiWidgetCopy;
}

export interface SduiScreenLayout {
  schema_version: string;
  server_timestamp_utc: string;
  ttl_seconds: number;
  district_id: string;
  version_num: number;
  sdui_version_epoch: number;
  header_theme: SduiHeaderTheme;
  widgets: SduiWidget[];
}

function isWidget(value: unknown): value is SduiWidget {
  if (!value || typeof value !== 'object') return false;
  const w = value as Record<string, unknown>;
  return typeof w.widget_id === 'string' && typeof w.type === 'string' && typeof w.priority === 'number';
}

/** Narrow an untrusted response into a layout, or null when the shape is unusable. */
export function parseScreenLayout(input: unknown): SduiScreenLayout | null {
  if (!input || typeof input !== 'object') return null;
  const body = input as Record<string, unknown>;
  const theme = body.header_theme as Record<string, unknown> | undefined;
  if (!theme || typeof theme.background_hex !== 'string' || !Array.isArray(body.widgets)) return null;
  const widgets = body.widgets.filter(isWidget);
  if (widgets.length === 0) return null;
  return {
    schema_version: typeof body.schema_version === 'string' ? body.schema_version : '1.2',
    server_timestamp_utc: typeof body.server_timestamp_utc === 'string' ? body.server_timestamp_utc : '',
    ttl_seconds: typeof body.ttl_seconds === 'number' ? body.ttl_seconds : 60,
    district_id: typeof body.district_id === 'string' ? body.district_id : '',
    version_num: typeof body.version_num === 'number' ? body.version_num : 0,
    sdui_version_epoch: typeof body.sdui_version_epoch === 'number' ? body.sdui_version_epoch : 0,
    header_theme: {
      background_hex: theme.background_hex,
      search_bar_bg_hex:
        typeof theme.search_bar_bg_hex === 'string' ? theme.search_bar_bg_hex : theme.background_hex,
      status_bar_style: theme.status_bar_style === 'dark' ? 'dark' : 'light',
    },
    widgets: [...widgets].sort((a, b) => a.priority - b.priority),
  };
}
