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

export const leadSchema = z
  .object({
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
    /**
     * Canonical master codes resolved from `districtName` by `resolveDistrictCodes` (below), so the
     * enquiry carries the same identity the admin queue scopes on. Absent when the pin's district is
     * not in the master — the gateway then resolves the name itself.
     */
    stateCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, "Invalid state code")
      .optional(),
    districtCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}[A-Z0-9]{1,3}$/, "Invalid district code")
      .optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    /**
     * The seller's expected commission. Mandatory: the admin queue uses it to open the call-back with
     * a concrete number, and the gateway rejects an enquiry without one. FOOD has a 5% floor.
     */
    platformFeePct: z
      .number({
        required_error: "Enter your expected platform fee",
        invalid_type_error: "Enter your expected platform fee",
      })
      .int("Use a whole number")
      .min(1, "Enter a fee between 1 and 100")
      .max(100, "Enter a fee between 1 and 100"),
    notes: z.string().trim().max(500).optional(),
    /** Honeypot — hidden from people, filled by bots. */
    website: z.string().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    // Mirrors the gateway's validPlatformFee: 1–100 everywhere, 5–100 for food.
    if (value.category === "FOOD" && value.platformFeePct < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["platformFeePct"],
        message: "Food sellers: minimum 5%",
      });
    }
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
    stateCode: data.stateCode,
    districtCode: data.districtCode,
    districtName: data.districtName,
    districtPlaceId: data.districtPlaceId,
    stateName: data.stateName,
    latitude: data.latitude,
    longitude: data.longitude,
    platformFeePct: data.platformFeePct,
    notes: data.notes,
  };
}

/** One row of the public district read (`GET /seller-leads/districts`). */
type LeadDistrict = { districtCode: string; name: string; stateCode: string };

/** In-process cache of the district master, so a submit does not refetch it. */
let districtCache: { at: number; rows: LeadDistrict[] } | null = null;
const DISTRICT_TTL_MS = 10 * 60 * 1000;

async function loadDistricts(): Promise<LeadDistrict[]> {
  if (districtCache && Date.now() - districtCache.at < DISTRICT_TTL_MS) return districtCache.rows;
  try {
    const res = await fetch(`${gatewayUrl()}/seller-leads/districts`);
    if (!res.ok) return districtCache?.rows ?? [];
    const rows = (await res.json()) as LeadDistrict[];
    if (!Array.isArray(rows)) return districtCache?.rows ?? [];
    districtCache = { at: Date.now(), rows };
    return rows;
  } catch {
    // Fail soft: the gateway still resolves the district by name, so an enquiry is never blocked by
    // this read. The stale snapshot is better than none when the master is briefly unreachable.
    return districtCache?.rows ?? [];
  }
}

/**
 * Maps the pin's district name onto the master's canonical `stateCode`/`districtCode`, so the
 * enquiry carries the codes the admin queue scopes on instead of relying on a name match server-side.
 * Returns `{}` when the name is not in the master (a new district, or Google's spelling differs) —
 * the gateway then falls back to `districtName`/`districtPlaceId`.
 */
export async function resolveDistrictCodes(
  data: Pick<LeadInput, "districtName" | "districtCode" | "stateCode">,
): Promise<{ stateCode?: string; districtCode?: string }> {
  if (data.districtCode) {
    const out: { stateCode?: string; districtCode?: string } = { districtCode: data.districtCode };
    if (data.stateCode) out.stateCode = data.stateCode;
    return out;
  }
  const want = data.districtName.trim().toLowerCase();
  if (!want) return {};
  const rows = await loadDistricts();
  const hit = rows.find((row) => row.name.trim().toLowerCase() === want);
  if (!hit) return {};
  return { stateCode: hit.stateCode, districtCode: hit.districtCode };
}

function messageForStatus(status: number, code: string | undefined): string {
  if (status === 429 || code === "rate_limited") {
    return `That's a few enquiries from this connection today. Try again tomorrow, or email us at ${BUSINESS_EMAIL}.`;
  }
  if (status === 400) {
    return "Some details didn't look right. Check the phone number, email, district and platform fee, then try again.";
  }
  return "We couldn't send your enquiry just now. Please try again in a moment.";
}

/**
 * The handler body, kept as a plain function so it is unit-testable without the TanStack Start
 * runtime (the exported `submitSellerLead` server function is just its transport). Returns the same
 * result shape either way.
 */
export async function postSellerLead(input: LeadInput): Promise<LeadResult> {
  const data = leadSchema.parse(input);
  if (data.website && data.website.trim() !== "") {
    return { ok: true, leadId: null };
  }
  try {
    const codes = await resolveDistrictCodes(data);
    const res = await fetch(`${gatewayUrl()}/seller-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildLeadPayload({ ...data, ...codes })),
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
}

export const submitSellerLead = createServerFn({ method: "POST" })
  .validator((data: unknown) => leadSchema.parse(data))
  .handler(({ data }): Promise<LeadResult> => postSellerLead(data));
