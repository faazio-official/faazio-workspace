import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gatewayUrl } from "@/lib/config";
import { BUSINESS_EMAIL } from "@/lib/site";

/**
 * Public "Sell with us" enquiry intake.
 *
 * The browser never calls the gateway directly: the production gateway's CORS allow-list is
 * `app.faazio.com`, not `faazio.com`, so a cross-origin `fetch` from this page would be blocked.
 * These server functions proxy from Nitro (same-origin):
 *
 *   - `submitSellerInquiry` → `POST /seller-inquiries`, public by design, writes the INQUIRY row
 *     (`sellers.sellers`) plus its claimed shop photos.
 *   - `uploadShopPhoto`  → `POST /media/avif`, the one endpoint that accepts image bytes. Browsers do
 *     not encode AVIF, so the gateway does the conversion and returns the stored asset id. The
 *     enquiry then references that id; without it the photo would never become an AVIF object.
 *
 * No credential is involved on either route: both are public.
 */

/** One accepted shop photo: media id + its object key (URL is for the confirmation preview). */
export type ShopPhotoRef = { assetId: string; key: string; url?: string };

export const inquirySchema = z
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
    // It is still required (the gateway rejects an enquiry with no address), but it arrives from the
    // pin rather than a text field, so the minimum-length check happens at submit, not in the form UI.
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
    /**
     * Shop photos uploaded before submit. At least one is required (the gateway rejects an empty
     * gallery): a shop with no picture cannot be reviewed or shown to customers later.
     */
    shopPhotos: z
      .array(z.object({ assetId: z.string().trim().min(1), key: z.string().trim().min(1) }))
      .min(1, "Add at least one photo of your shop")
      .max(5, "Up to 5 photos"),
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

export type InquiryInput = z.infer<typeof inquirySchema>;

export type InquiryResult = { ok: true; sellerId: string | null } | { ok: false; message: string };

/**
 * The exact body posted to `POST /seller-inquiries`.
 *
 * The gateway decodes with `DisallowUnknownFields`, so a key here that `createInquiryRequest`
 * (`server/gateway/internal/sellers/inquiry.go`) does not declare makes every enquiry a 400.
 * Provenance (`source`) is server-owned — the handler always stamps it 'web' — so it is deliberately
 * not sent. `inquiries.test.ts` pins this key set against the Go contract.
 */
export function buildInquiryPayload(data: InquiryInput): Record<string, unknown> {
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
    shopPhotoIds: data.shopPhotos.map((photo) => photo.assetId),
  };
}

/** One row of the public district read (`GET /seller-inquiries/districts`). */
type InquiryDistrict = { districtCode: string; name: string; stateCode: string };

/** In-process cache of the district master, so a submit does not refetch it. */
let districtCache: { at: number; rows: InquiryDistrict[] } | null = null;
const DISTRICT_TTL_MS = 10 * 60 * 1000;

async function loadDistricts(): Promise<InquiryDistrict[]> {
  if (districtCache && Date.now() - districtCache.at < DISTRICT_TTL_MS) return districtCache.rows;
  try {
    const res = await fetch(`${gatewayUrl()}/seller-inquiries/districts`);
    if (!res.ok) return districtCache?.rows ?? [];
    const rows = (await res.json()) as InquiryDistrict[];
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
  data: Pick<InquiryInput, "districtName" | "districtCode" | "stateCode">,
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
  if (status === 409 || code === "duplicate_inquiry") {
    return "An enquiry with this email is already with our team — we'll call you. Email us if you need to change something.";
  }
  if (status === 400) {
    return "Some details didn't look right. Check the phone number, email, district, photos and platform fee, then try again.";
  }
  return "We couldn't send your enquiry just now. Please try again in a moment.";
}

/**
 * The handler body, kept as a plain function so it is unit-testable without the TanStack Start
 * runtime (the exported `submitSellerInquiry` server function is just its transport). Returns the same
 * result shape either way.
 */
export async function postSellerInquiry(input: InquiryInput): Promise<InquiryResult> {
  const data = inquirySchema.parse(input);
  if (data.website && data.website.trim() !== "") {
    return { ok: true, sellerId: null };
  }
  try {
    const codes = await resolveDistrictCodes(data);
    const res = await fetch(`${gatewayUrl()}/seller-inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildInquiryPayload({ ...data, ...codes })),
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
    const body = (await res.json()) as { sellerId?: string };
    return { ok: true, sellerId: body.sellerId ?? null };
  } catch {
    return {
      ok: false,
      message: "We couldn't reach our servers. Check your connection and try again.",
    };
  }
}

export const submitSellerInquiry = createServerFn({ method: "POST" })
  .validator((data: unknown) => inquirySchema.parse(data))
  .handler(({ data }): Promise<InquiryResult> => postSellerInquiry(data));

/* ------------------------------ shop photos ------------------------------ */

/**
 * The maximum source image the browser may hand us, after the canvas downscale. A 1600px JPEG is
 * typically 200–600 KB; 6 MiB is a generous ceiling that still fits the gateway's 12 MiB decode cap
 * with base64 (×1.33) headroom.
 */
export const MAX_SHOP_PHOTO_BYTES = 6 * 1024 * 1024;

const shopPhotoInput = z.object({
  /** base64 of the JPEG the browser already downscaled (canvas), no data: prefix. */
  data: z
    .string()
    .min(1)
    .max(Math.ceil((MAX_SHOP_PHOTO_BYTES * 4) / 3)),
  mime: z.enum(["image/jpeg", "image/png"]),
});

export type ShopPhotoResult = { ok: true; photo: ShopPhotoRef } | { ok: false; message: string };

/**
 * Forwards one image to `POST /media/avif` and returns the stored AVIF asset.
 *
 * The gateway decodes JPEG/PNG and re-encodes AVIF from pixels, which also strips EXIF/GPS — the
 * reason raw camera bytes are accepted here rather than a client-side encode nobody can do. A
 * failure is a hard failure: without an asset id the enquiry cannot carry the photo.
 */
export async function uploadShopPhotoBytes(input: {
  data: string;
  mime: "image/jpeg" | "image/png";
}): Promise<ShopPhotoResult> {
  const { data, mime } = shopPhotoInput.parse(input);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    // Decoded without Buffer so this module stays runnable in both the Nitro server and the browser
    // (the form calls the server function, but the helpers above are also imported client-side).
    const binary = atob(data);
    bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  } catch {
    return { ok: false, message: "That photo could not be read. Try picking it again." };
  }
  if (bytes.byteLength === 0) {
    return { ok: false, message: "That photo is empty. Try picking it again." };
  }
  if (bytes.byteLength > MAX_SHOP_PHOTO_BYTES) {
    return { ok: false, message: "That photo is too large. Pick a smaller one." };
  }
  try {
    const res = await fetch(`${gatewayUrl()}/media/avif`, {
      method: "POST",
      headers: { "Content-Type": mime },
      body: bytes,
    });
    if (!res.ok) {
      if (res.status === 429) {
        return {
          ok: false,
          message: "That's a lot of photo uploads from this connection. Try again tomorrow.",
        };
      }
      return {
        ok: false,
        message: "We couldn't process that photo. Try a JPG or PNG, or one taken with the camera.",
      };
    }
    const body = (await res.json()) as {
      assetId?: string;
      key?: string;
      url?: string;
    };
    if (!body.assetId || !body.key) {
      return { ok: false, message: "The photo upload did not complete. Try again." };
    }
    const photo: ShopPhotoRef = { assetId: body.assetId, key: body.key };
    if (body.url) photo.url = body.url;
    return { ok: true, photo };
  } catch {
    return { ok: false, message: "We couldn't upload that photo. Check your connection." };
  }
}

export const uploadShopPhoto = createServerFn({ method: "POST" })
  .validator((data: unknown) => shopPhotoInput.parse(data))
  .handler(({ data }): Promise<ShopPhotoResult> => uploadShopPhotoBytes(data));
