import { describe, expect, it } from "vitest";
import { SELLER_TOUR_STEPS } from "@/lib/tutorials/seller-onboarding";

describe("seller onboarding walkthrough", () => {
  it("has the five application steps in order", () => {
    expect(SELLER_TOUR_STEPS.map((step) => step.id)).toEqual([
      "entry",
      "business",
      "shops",
      "contract",
      "verify",
    ]);
  });

  it("has unique ids and targets", () => {
    expect(new Set(SELLER_TOUR_STEPS.map((step) => step.id)).size).toBe(SELLER_TOUR_STEPS.length);
    expect(new Set(SELLER_TOUR_STEPS.map((step) => step.target)).size).toBe(
      SELLER_TOUR_STEPS.length,
    );
  });

  it("has copy and a dwell time for every step", () => {
    for (const step of SELLER_TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.detail.length).toBeGreaterThan(0);
      expect(step.holdMs).toBeGreaterThanOrEqual(1200);
      expect(step.holdMs).toBeLessThanOrEqual(3000);
    }
  });
});
