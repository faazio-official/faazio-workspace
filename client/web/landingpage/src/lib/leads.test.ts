import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLeadPayload, leadSchema } from "@/lib/leads";

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
    });
  });

  it("omits optional keys instead of sending undefined", () => {
    const payload = buildLeadPayload(
      leadSchema.parse({
        ...validInput,
        latitude: undefined,
        longitude: undefined,
        notes: undefined,
        stateName: undefined,
        platformFeePct: undefined,
      }),
    );
    // JSON.stringify drops undefined values, so the wire body stays free of the optional keys.
    const wire = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    expect(Object.keys(wire)).not.toContain("latitude");
    expect(Object.keys(wire)).not.toContain("notes");
  });
});
