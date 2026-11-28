import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInquiryPayload,
  inquirySchema,
  postSellerInquiry,
  resolveDistrictCodes,
  uploadShopPhotoBytes,
} from "@/lib/inquiries";

/**
 * The landing page and the gateway are separate deployables with no shared type. The gateway decodes
 * the enquiry with `DisallowUnknownFields`, so a payload key it does not declare turns every real
 * submission into a 400 while hand-written Go tests still pass. This pins the two together by reading
 * the Go request struct straight from the repo.
 */
const GO_INQUIRY = (() => {
  const relative = path.join("server", "gateway", "internal", "sellers", "inquiry.go");
  let dir = __dirname;
  for (;;) {
    const candidate = path.join(dir, relative);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`could not locate ${relative} above ${__dirname}`);
    dir = parent;
  }
})();

/** JSON keys declared on createInquiryRequest, read from the Go source. */
function goRequestFields(): Set<string> {
  const src = readFileSync(GO_INQUIRY, "utf8");
  const start = src.indexOf("type createInquiryRequest struct");
  if (start === -1) throw new Error("createInquiryRequest not found in inquiry.go");
  const body = src.slice(start, src.indexOf("\n}", start));
  const fields = new Set<string>();
  for (const match of body.matchAll(/json:"([^"]+)"/g)) {
    fields.add(match[1]!.split(",")[0]!);
  }
  return fields;
}

const validInput = {
  ownerName: "Ravi Kumar",
  category: "MART" as const,
  contactPhone: "9876543210",
  contactEmail: "ravi@example.com",
  businessAddress: "12 Bharathiar Street, Karaikal",
  districtName: "Karaikal",
  latitude: 10.9254,
  longitude: 79.838,
  platformFeePct: 10,
  notes: "",
  shopPhotos: [{ assetId: "img_shop1", key: "media/aa/shop.avif" }],
  website: "",
};

describe("seller enquiry wire contract", () => {
  it("sends only fields the gateway's createInquiryRequest declares", () => {
    const accepted = goRequestFields();
    expect(accepted.size).toBeGreaterThan(0);
    const sent = Object.keys(buildInquiryPayload(inquirySchema.parse(validInput)));
    const unknown = sent.filter((key) => !accepted.has(key));
    expect(unknown).toEqual([]);
  });

  it("never sends the honeypot to the gateway", () => {
    expect(buildInquiryPayload(inquirySchema.parse(validInput))).not.toHaveProperty("website");
  });

  it("leaves provenance to the server", () => {
    // The handler always stamps source='web'; sending it is redundant and would be an unknown key.
    expect(buildInquiryPayload(inquirySchema.parse(validInput))).not.toHaveProperty("source");
  });

  it("sends shop photo ids, not the whole photo object", () => {
    const payload = buildInquiryPayload(inquirySchema.parse(validInput));
    expect(payload["shopPhotoIds"]).toEqual(["img_shop1"]);
    expect(payload).not.toHaveProperty("shopPhotos");
  });

  it("carries the fields the enquiry needs", () => {
    const payload = buildInquiryPayload(inquirySchema.parse(validInput));
    expect(payload).toMatchObject({
      ownerName: "Ravi Kumar",
      category: "MART",
      contactPhone: "9876543210",
      contactEmail: "ravi@example.com",
      businessAddress: "12 Bharathiar Street, Karaikal",
      districtName: "Karaikal",
      latitude: 10.9254,
      longitude: 79.838,
      platformFeePct: 10,
    });
  });

  it("carries the district place_id so the gateway resolves the district by identity", () => {
    const payload = buildInquiryPayload(
      inquirySchema.parse({
        ...validInput,
        districtPlaceId: "ChIJkaraikal",
        stateName: "Puducherry",
      }),
    );
    expect(payload).toMatchObject({
      districtPlaceId: "ChIJkaraikal",
      stateName: "Puducherry",
    });
    // It must be a real declared field, not a silently-dropped extra.
    expect(goRequestFields().has("districtPlaceId")).toBe(true);
  });

  it("carries the canonical master codes the form resolved from the pin", () => {
    const payload = buildInquiryPayload(
      inquirySchema.parse({ ...validInput, stateCode: "PY", districtCode: "PY1" }),
    );
    expect(payload).toMatchObject({ stateCode: "PY", districtCode: "PY1" });
    // Both are real Go fields, so they decode rather than 400 as unknown keys.
    expect(goRequestFields().has("stateCode")).toBe(true);
    expect(goRequestFields().has("districtCode")).toBe(true);
  });

  it("omits optional keys instead of sending undefined", () => {
    const payload = buildInquiryPayload(
      inquirySchema.parse({
        ...validInput,
        latitude: undefined,
        longitude: undefined,
        notes: undefined,
        stateName: undefined,
        stateCode: undefined,
        districtCode: undefined,
      }),
    );
    // JSON.stringify drops undefined values, so the wire body stays free of the optional keys.
    const wire = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    expect(Object.keys(wire)).not.toContain("latitude");
    expect(Object.keys(wire)).not.toContain("notes");
    expect(Object.keys(wire)).not.toContain("stateCode");
    expect(Object.keys(wire)).not.toContain("districtCode");
  });
});

describe("shop photo requirement", () => {
  it("requires at least one photo", () => {
    const result = inquirySchema.safeParse({ ...validInput, shopPhotos: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("shopPhotos"))).toBe(true);
    }
  });

  it("caps the gallery at five", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      assetId: `img_${i}`,
      key: `media/aa/${i}.avif`,
    }));
    expect(inquirySchema.safeParse({ ...validInput, shopPhotos: six }).success).toBe(false);
  });
});

describe("platform fee validation", () => {
  it("requires a fee", () => {
    const result = inquirySchema.safeParse({ ...validInput, platformFeePct: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("platformFeePct"))).toBe(true);
    }
  });

  it("rejects a fee outside 1–100", () => {
    expect(inquirySchema.safeParse({ ...validInput, platformFeePct: 0 }).success).toBe(false);
    expect(inquirySchema.safeParse({ ...validInput, platformFeePct: 101 }).success).toBe(false);
  });

  it("enforces the 5% floor for food and not for other categories", () => {
    expect(
      inquirySchema.safeParse({ ...validInput, category: "FOOD", platformFeePct: 4 }).success,
    ).toBe(false);
    expect(
      inquirySchema.safeParse({ ...validInput, category: "FOOD", platformFeePct: 5 }).success,
    ).toBe(true);
    expect(
      inquirySchema.safeParse({ ...validInput, category: "MART", platformFeePct: 4 }).success,
    ).toBe(true);
  });
});

describe("district code resolution", () => {
  const rows = [
    { districtCode: "PY1", name: "Karaikal", stateCode: "PY" },
    { districtCode: "TTC", name: "Tiruchirappalli", stateCode: "TN" },
  ];

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps a district name to its master codes, case-insensitively", async () => {
    await expect(resolveDistrictCodes({ districtName: " karaikal " })).resolves.toEqual({
      stateCode: "PY",
      districtCode: "PY1",
    });
  });

  it("passes an explicit code through instead of looking it up", async () => {
    await expect(
      resolveDistrictCodes({ districtName: "Whatever", districtCode: "PY1", stateCode: "PY" }),
    ).resolves.toEqual({ stateCode: "PY", districtCode: "PY1" });
  });

  it("returns {} for a name outside the master", async () => {
    await expect(resolveDistrictCodes({ districtName: "Nowhere" })).resolves.toEqual({});
  });
});

describe("postSellerInquiry", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/seller-inquiries/districts")) {
          return new Response("[]", { status: 200 });
        }
        return new Response(JSON.stringify({ sellerId: "sel-abc123", status: "INQUIRY" }), {
          status: 201,
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts to /seller-inquiries and returns the seller id", async () => {
    await expect(postSellerInquiry(validInput)).resolves.toEqual({
      ok: true,
      sellerId: "sel-abc123",
    });
    const calls = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const [url, init] = calls[calls.length - 1]!;
    expect(String(url)).toMatch(/\/seller-inquiries$/);
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body["shopPhotoIds"]).toEqual(["img_shop1"]);
  });

  it("drops a honeypot submission silently", async () => {
    await expect(postSellerInquiry({ ...validInput, website: "http://spam" })).resolves.toEqual({
      ok: true,
      sellerId: null,
    });
  });

  it("surfaces a duplicate enquiry as guidance, not a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ code: "duplicate_inquiry" }), { status: 409 }),
      ),
    );
    const result = await postSellerInquiry(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/already with our team/i);
  });
});

describe("uploadShopPhotoBytes", () => {
  const onePixelJpeg = "ffd8ffe000104a46494600010100000100010000ffd9";

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts raw bytes to /media/avif and returns the stored asset", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              assetId: "img_shop1",
              key: "media/aa/shop.avif",
              url: "https://cdn.example/shop.avif",
              width: 1600,
              height: 1200,
              bytes: 40000,
            }),
            { status: 201 },
          ),
      ),
    );
    const result = await uploadShopPhotoBytes({ data: onePixelJpeg, mime: "image/jpeg" });
    expect(result).toEqual({
      ok: true,
      photo: {
        assetId: "img_shop1",
        key: "media/aa/shop.avif",
        url: "https://cdn.example/shop.avif",
      },
    });
    const calls = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
    const [url, init] = calls[0]!;
    expect(String(url)).toMatch(/\/media\/avif$/);
    expect(init.headers).toMatchObject({ "Content-Type": "image/jpeg" });
    expect(init.body).toBeInstanceOf(Uint8Array);
  });

  it("turns a rate limit into a readable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429 })),
    );
    const result = await uploadShopPhotoBytes({ data: onePixelJpeg, mime: "image/jpeg" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/photo uploads/i);
  });

  it("rejects an empty payload before calling the gateway", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await uploadShopPhotoBytes({ data: "=", mime: "image/jpeg" });
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
