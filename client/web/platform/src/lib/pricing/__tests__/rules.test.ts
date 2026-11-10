import { describe, expect, it } from "vitest";
import { optinCap, validateOptin } from "@/lib/pricing/rules";
import type { SectorCap } from "@/data/types";

const cap = (maxDiscountPercent: number, stateCode?: string): SectorCap => ({
  capId: `cap-${maxDiscountPercent}-${stateCode ?? "global"}`,
  sector: "MART",
  maxDiscountPercent,
  ...(stateCode ? { stateCode } : {}),
  updatedAt: "2026-01-01T00:00:00Z",
});

describe("optinCap", () => {
  it("treats a missing cap row as unconfigured and uses the gateway's 90% write bound", () => {
    expect(optinCap([], "MART")).toEqual({ percent: 90, configured: false });
  });

  it("prefers a state override over the global row", () => {
    expect(optinCap([cap(10), cap(25, "MH")], "MART", "MH")).toEqual({
      percent: 25,
      configured: true,
    });
  });

  it("keeps an explicit 0% cap configured", () => {
    expect(optinCap([cap(0)], "MART")).toEqual({ percent: 0, configured: true });
  });
});

describe("validateOptin", () => {
  it("rejects non-integer input instead of accepting NaN", () => {
    expect(validateOptin([], "MART", Number.NaN).ok).toBe(false);
    expect(validateOptin([], "MART", 12.5).ok).toBe(false);
  });

  it("rejects zero and values above the gateway bound", () => {
    expect(validateOptin([], "MART", 0).ok).toBe(false);
    expect(validateOptin([], "MART", 91).ok).toBe(false);
  });

  it("allows a positive discount when no cap is configured", () => {
    expect(validateOptin([], "MART", 20).ok).toBe(true);
  });

  it("enforces the configured cap and the state override", () => {
    const caps = [cap(10), cap(25, "MH")];
    expect(validateOptin(caps, "MART", 20).ok).toBe(false);
    expect(validateOptin(caps, "MART", 20, "MH").ok).toBe(true);
    expect(validateOptin([cap(0)], "MART", 1).ok).toBe(false);
  });
});
