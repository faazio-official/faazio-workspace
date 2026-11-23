import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLeadPayload, leadSchema, postSellerLead, resolveDistrictCodes } from "@/lib/leads";

/**
 * The landing page and the gateway are separate deployables with no shared type. The gateway decodes
 * the enquiry with `DisallowUnknownFields`, so a payload key it does not declare turns every real
 * submission into a 400 while hand-written Go tests still pass. This pins the two together by reading
 * the Go request struct straight from the repo.
 */
const GO_LEADS = (() => {
  const relative = path.join("server", "gateway", "internal", "sellers", "leads.go");
  let dir = __dirname;
  for (;;) {
    const candidate = path.join(dir, relative);
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`could not locate ${relative} above ${__dirname}`);
    dir = parent;
  }
})();

/** JSON keys declared on createLeadRequest, read from the Go source. */
function goRequestFields(): Set<string> {
  const src = readFileSync(GO_LEADS, "utf8");
  const start = src.indexOf("type createLeadRequest struct");
  if (start === -1) throw new Error("createLeadRequest not found in leads.go");
  const body = src.slice(start, src.indexOf("\n}", start));
  const fields = new Set<string>();
  for (const match of body.matchAll(/json:"([^"]+)"/g)) {
    fields.add(match[1]!.split(",")[0]!);
  }
  return fields;
}

const validInput = {
  businessName: "Karaikal Spice Mart",
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
  website: "",
};

describe("seller lead wire contract", () => {
  it("sends only fields the gateway's createLeadRequest declares", () => {
    const accepted = goRequestFields();
    expect(accepted.size).toBeGreaterThan(0);
    const sent = Object.keys(buildLeadPayload(leadSchema.parse(validInput)));
    const unknown = sent.filter((key) => !accepted.has(key));
    expect(unknown).toEqual([]);
  });

  it("never sends the honeypot to the gateway", () => {
    expect(buildLeadPayload(leadSchema.parse(validInput))).not.toHaveProperty("website");
  });

  it("leaves provenance to the server", () => {
    // The handler always stamps source; sending it is redundant and was the original 400.
    expect(buildLeadPayload(leadSchema.parse(validInput))).not.toHaveProperty("source");
  });

  it("carries the fields the enquiry needs", () => {
    const payload = buildLeadPayload(leadSchema.parse(validInput));
    expect(payload).toMatchObject({
      businessName: "Karaikal Spice Mart",
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
    const payload = buildLeadPayload(
      leadSchema.parse({
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
    const payload = buildLeadPayload(
      leadSchema.parse({ ...validInput, stateCode: "PY", districtCode: "PY1" }),
    );
    expect(payload).toMatchObject({ stateCode: "PY", districtCode: "PY1" });
    // Both are real Go fields, so they decode rather than 400 as unknown keys.
    expect(goRequestFields().has("stateCode")).toBe(true);
    expect(goRequestFields().has("districtCode")).toBe(true);
  });

  it("omits optional keys instead of sending undefined", () => {
    const payload = buildLeadPayload(
      leadSchema.parse({
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

describe("platform fee validation", () => {
  it("requires a fee", () => {
    const result = leadSchema.safeParse({ ...validInput, platformFeePct: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("platformFeePct"))).toBe(true);
    }
  });

  it("rejects a fee outside 1–100", () => {
    expect(leadSchema.safeParse({ ...validInput, platformFeePct: 0 }).success).toBe(false);
    expect(leadSchema.safeParse({ ...validInput, platformFeePct: 101 }).success).toBe(false);
  });

  it("enforces the 5% floor for food and not for other categories", () => {
    expect(
      leadSchema.safeParse({ ...validInput, category: "FOOD", platformFeePct: 4 }).success,
    ).toBe(false);
    expect(
      leadSchema.safeParse({ ...validInput, category: "FOOD", platformFeePct: 5 }).success,
    ).toBe(true);
    expect(
      leadSchema.safeParse({ ...validInput, category: "MART", platformFeePct: 4 }).success,
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

describe("postSellerLead", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/seller-leads/districts")) {
          return new Response(
            JSON.stringify([{ districtCode: "PY1", name: "Karaikal", stateCode: "PY" }]),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ leadId: "lead-abc123", status: "NEW" }), {
          status: 201,
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the payload with resolved codes and returns the lead id", async () => {
    const result = await postSellerLead(validInput);
    expect(result).toEqual({ ok: true, leadId: "lead-abc123" });

    const leadCall = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith("/seller-leads"));
    expect(leadCall).toBeTruthy();
    const body = JSON.parse(String((leadCall![1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      districtName: "Karaikal",
      stateCode: "PY",
      districtCode: "PY1",
      platformFeePct: 10,
    });
  });

  it("accepts a honeypot submission silently without calling the gateway", async () => {
    const result = await postSellerLead({ ...validInput, website: "http://spam" });
    expect(result).toEqual({ ok: true, leadId: null });
    const leadCall = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith("/seller-leads"));
    expect(leadCall).toBeUndefined();
  });

  it("maps a 400 to a check-your-details message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/seller-leads/districts")) {
          return new Response("[]", { status: 200 });
        }
        return new Response(JSON.stringify({ code: "bad_request" }), { status: 400 });
      }),
    );
    const result = await postSellerLead(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/didn't look right/i);
  });
});
