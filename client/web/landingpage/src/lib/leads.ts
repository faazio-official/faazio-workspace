import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public "Sell with us" lead intake.
 *
 * The browser never calls the gateway directly: the production gateway's CORS allow-list is
 * `app.faazio.com`, not `faazio.com`, so a cross-origin `fetch` from this page would be blocked.
 * This server function proxies the enquiry from Nitro (same-origin) to `POST /seller-leads`, which
 * is public by design and stores a lead only (never a seller account — no KYC fields here).
 *
 * The gateway URL is read on the server: `GATEWAY_URL` (deploy) then `VITE_GATEWAY_URL` (local
 * override), defaulting to production.
 */
const DEFAULT_GATEWAY_URL = "https://api.faazio.com";

export const leadSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(160),
  ownerName: z.string().trim().min(2, "Enter the owner's name").max(160),
  category: z.enum(["MART", "FOOD", "PHARMA"]),
  contactPhone: z
    .string()
    .trim()
    .refine(
      (v) => v.replace(/\D/g, "").length >= 10 && v.length <= 20,
      "Enter a valid phone number",
    ),
  contactEmail: z.string().trim().email("Enter a valid email").max(254),
  businessAddress: z.string().trim().min(5, "Enter your shop's street address").max(500),
  districtName: z.string().trim().min(2, "Enter your district").max(80),
  stateName: z.string().trim().max(80).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  platformFeePct: z.number().int().min(1).max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  /** Honeypot — hidden from people, filled by bots. */
  website: z.string().max(200).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;

export type LeadResult = { ok: true; leadId: string | null } | { ok: false; message: string };

function gatewayUrl(): string {
  const env = process.env as Record<string, string | undefined>;
  const raw = env["GATEWAY_URL"] || env["VITE_GATEWAY_URL"] || DEFAULT_GATEWAY_URL;
  return raw.replace(/\/+$/, "");
}

function messageForStatus(status: number, code: string | undefined): string {
  if (status === 429 || code === "rate_limited") {
    return "That's a few enquiries from this connection today. Try again tomorrow, or message us on WhatsApp.";
  }
  if (status === 400) {
    return "Some details didn't look right. Check the phone number, email and district, then try again.";
  }
  return "We couldn't send your enquiry just now. Please try again in a moment.";
}

export const submitSellerLead = createServerFn({ method: "POST" })
  .validator((data: unknown) => leadSchema.parse(data))
  .handler(async ({ data }): Promise<LeadResult> => {
    const { website, ...payload } = data;
    if (website && website.trim() !== "") {
      return { ok: true, leadId: null };
    }
    try {
      const res = await fetch(`${gatewayUrl()}/seller-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, source: "web" }),
      });
      if (!res.ok) {
        let code: string | undefined;
        try {
          const body = (await res.json()) as { code?: string };
          code = body.code;
        } catch {
          code = undefined;
        }
        return { ok: false, message: messageForStatus(res.status, code) };
      }
      const body = (await res.json()) as { leadId?: string };
      return { ok: true, leadId: body.leadId ?? null };
    } catch {
      return {
        ok: false,
        message: "We couldn't reach our servers. Check your connection and try again.",
      };
    }
  });
