"use client";
// SDUI layout contract (schema 1.2), mirrored from the Go validator in
// server/gateway/internal/sdui/control.go. The Go check is authoritative on publish; this Zod
// schema gives the admin inline feedback and blocks a malformed import before it leaves the browser.
import { z } from "zod";

export const SDUI_SCHEMA_VERSION = "1.2";
export const SDUI_TTL_SECONDS = 60;

export const SDUI_VERTICALS = ["home", "food", "mart", "grocery", "pharma"] as const;
export const SDUI_SCREENS = ["home", "category_landing"] as const;
export const SDUI_SLOTS = [
  "top_header_theme",
  "hero_banner",
  "quick_filter_pills",
  "spotlight_rail",
] as const;
export const SDUI_WIDGET_TYPES = [
  "HERO_PROMO_BANNER",
  "SPOTLIGHT_RAIL",
  "QUICK_FILTER_PILLS",
  "OFFER_STRIP",
] as const;
export const SDUI_MEDIA_KINDS = ["image", "lottie", "video"] as const;
export const SDUI_EXPIRE_ACTIONS = ["SWAP_TO_FALLBACK", "LOCK_OVERLAY"] as const;
export const SDUI_ASPECT_RATIOS = ["16:10", "16:9", "1:1", "4:3", "3:2", "2:3", "9:16"] as const;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "must be a #RRGGBB hex colour");
const widgetId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_]{2,63}$/, "lower-case letters, digits, underscores (3-64 chars)");
const httpsUrl = z
  .string()
  .refine((v) => v === "" || v.startsWith("https://"), "must be an https:// CDN URL");

export const sduiHeaderThemeSchema = z
  .object({
    background_hex: hex,
    search_bar_bg_hex: hex,
    status_bar_style: z.enum(["light", "dark"]),
  })
  .strict();

export const sduiMediaSchema = z
  .object({
    kind: z.enum(SDUI_MEDIA_KINDS),
    url: httpsUrl,
    fallback_image_url: httpsUrl.optional(),
    aspect_ratio: z.enum(SDUI_ASPECT_RATIOS),
  })
  .strict();

export const sduiScheduleSchema = z
  .object({
    starts_at_utc: z.string().datetime({ offset: false }).or(z.string().datetime()),
    expires_at_utc: z.string().datetime({ offset: false }).or(z.string().datetime()),
    on_expire_action: z.enum(SDUI_EXPIRE_ACTIONS),
    fallback_widget_id: z.string().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const start = Date.parse(val.starts_at_utc);
    const end = Date.parse(val.expires_at_utc);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expires_at_utc"],
        message: "must be after starts_at_utc",
      });
    }
    if (val.on_expire_action === "SWAP_TO_FALLBACK" && !val.fallback_widget_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fallback_widget_id"],
        message: "required when on_expire_action is SWAP_TO_FALLBACK",
      });
    }
  });

export const sduiActionSchema = z
  .object({
    type: z.enum(["DEEP_LINK", "NONE"]),
    route: z.string().optional(),
    auto_apply_coupon: z
      .string()
      .regex(/^[A-Z0-9]{3,24}$/, "3-24 upper-case letters or digits")
      .optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.type === "DEEP_LINK" && !val.route?.startsWith("faazio://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["route"],
        message: "must start with faazio://",
      });
    }
  });

export const sduiCopySchema = z
  .object({
    eyebrow: z.string().max(32).optional(),
    headline: z.string().max(60).optional(),
    accent_headline: z.string().max(12).optional(),
    body: z.string().max(120).optional(),
    code_label: z.string().max(12).optional(),
    code: z.string().max(24).optional(),
    cta: z.string().max(28).optional(),
  })
  .strict();

export const sduiWidgetSchema = z
  .object({
    widget_id: widgetId,
    type: z.enum(SDUI_WIDGET_TYPES),
    slot: z.enum(SDUI_SLOTS),
    priority: z.number().int().min(1, "must be 1 or greater"),
    media: sduiMediaSchema.optional(),
    schedule: sduiScheduleSchema.optional(),
    action: sduiActionSchema.optional(),
    copy: sduiCopySchema.optional(),
  })
  .strict();

export const sduiLayoutSchema = z
  .object({
    schema_version: z.literal(SDUI_SCHEMA_VERSION),
    header_theme: sduiHeaderThemeSchema,
    widgets: z.array(sduiWidgetSchema).min(1, "at least one widget is required").max(30),
  })
  .strict()
  .superRefine((val, ctx) => {
    const ids = new Set<string>();
    const priorities = new Set<number>();
    val.widgets.forEach((w, i) => {
      if (ids.has(w.widget_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["widgets", i, "widget_id"],
          message: "duplicate widget_id",
        });
      }
      ids.add(w.widget_id);
      if (priorities.has(w.priority)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["widgets", i, "priority"],
          message: "duplicate priority",
        });
      }
      priorities.add(w.priority);
    });
    val.widgets.forEach((w, i) => {
      const fb = w.schedule?.fallback_widget_id;
      if (!fb) return;
      if (fb === w.widget_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["widgets", i, "schedule", "fallback_widget_id"],
          message: "cannot point at itself",
        });
      } else if (!ids.has(fb)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["widgets", i, "schedule", "fallback_widget_id"],
          message: `fallback widget ${fb} is not in this layout`,
        });
      }
    });
  });

export type SduiLayoutPayload = z.infer<typeof sduiLayoutSchema>;
export type SduiWidget = z.infer<typeof sduiWidgetSchema>;
export type SduiHeaderTheme = z.infer<typeof sduiHeaderThemeSchema>;
export type SduiVertical = (typeof SDUI_VERTICALS)[number];
export type SduiScreen = (typeof SDUI_SCREENS)[number];

export interface LayoutIssue {
  path: string;
  message: string;
}

/** Validate a layout object and flatten its issues into `path: message` rows for the error panel. */
export function validateLayout(input: unknown): { data?: SduiLayoutPayload; issues: LayoutIssue[] } {
  const parsed = sduiLayoutSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data, issues: [] };
  return {
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join(".") : "$",
      message: issue.message,
    })),
  };
}
