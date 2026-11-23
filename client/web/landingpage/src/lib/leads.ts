import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gatewayUrl } from "@/lib/config";
import { BUSINESS_EMAIL } from "@/lib/site";

/**
 * Public "Sell with us" lead intake.
 *
 * The browser never calls the gateway directly: the production gateway's CORS allow-list is
 * `app.faazio.com`, not `faazio.com`, so a cross-origin `fetch` from this page would be blocked.
 * This server function proxies the enquiry from Nitro (same-origin) to `POST /seller-leads`, which
 * is public by design and stores a lead only (never a seller account — no KYC fields here).
 *
 * The gateway origin comes from `@/lib/config` (server `GATEWAY_URL`, then build `VITE_GATEWAY_URL`,
 * then production). No credential is involved: the route is public.
 */

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
  // The shop address is no longer typed by hand: it is the formatted address of the shared location.
  // It is still required (the gateway rejects a lead with no address), but it arrives from the pin
  // rather than a text field, so the minimum-length check happens at submit, not in the form UI.
  businessAddress: z.string().trim().min(5, "Share your shop location").max(500),
  districtName: z.string().trim().min(2, "Share your shop location").max(80),
  /**
   * Google place_id of the district (administrative_area_level_3), reverse-geocoded from the shared
   * location. The gateway resolves the district by this id first — it is immune to the spelling and
   * rename drift that breaks name matching. Absent only when Google returns no district for the
   * coordinate, in which case the gateway falls back to `districtName`.
   */
  districtPlaceId: z.string().trim().max(300).optional(),
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

/**
 * The exact body posted to `POST /seller-leads`.
 *
 * The gateway decodes with `DisallowUnknownFields`, so a key here that `createLeadRequest`
 * (`server/gateway/internal/sellers/leads.go`) does not declare makes every enquiry a 400. Provenance
 * (`source`) is server-owned — the handler always stamps it — so it is deliberately not sent.
 * `leads.test.ts` pins this key set against the Go contract.
 */
export function buildLeadPayload(data: LeadInput): Record<string, unknown> {
  return {
    businessName: data.businessName,
    ownerName: data.ownerName,
    category: data.category,
    contactPhone: data.contactPhone,
    contactEmail: data.contactEmail,
    businessAddress: data.businessAddress,
    districtName: data.districtName,
    districtPlaceId: data.districtPlaceId,
    stateName: data.stateName,
    latitude: data.latitude,
    longitude: data.longitude,
    platformFeePct: data.platformFeePct,
    notes: data.notes,
  };
}

function messageForStatus(status: number, code: string | undefined): string {
  if (status === 429 || code === "rate_limited") {
    return `That's a few enquiries from this connection today. Try again tomorrow, or email us at ${BUSINESS_EMAIL}.`;
  }
  if (status === 400) {
    return "Some details didn't look right. Check the phone number, email and district, then try again.";
  }
  return "We couldn't send your enquiry just now. Please try again in a moment.";
}

export const submitSellerLead = createServerFn({ method: "POST" })
  .validator((data: unknown) => leadSchema.parse(data))
  .handler(async ({ data }): Promise<LeadResult> => {
    const { website } = data;
    if (website && website.trim() !== "") {
      return { ok: true, leadId: null };
    }
    try {
      const res = await fetch(`${gatewayUrl()}/seller-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildLeadPayload(data)),
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
