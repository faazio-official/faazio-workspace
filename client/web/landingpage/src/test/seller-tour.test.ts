import { describe, expect, it } from "vitest";
import { SELLER_TOUR_STEPS } from "@/lib/tutorials/seller-onboarding";
import { SELLER_JOURNEY_CHAPTERS } from "@/lib/tutorials/seller-journey";

const ACTIONS = new Set(["tap", "type", "scan", "swipe"]);

describe("seller onboarding walkthrough", () => {
  it("has the application steps in the registration screen's document order", () => {
    expect(SELLER_TOUR_STEPS.map((step) => step.id)).toEqual([
      "entry",
      "business",
      "payout",
      "contract",
      "signature",
      "shops",
      "submit",
      "review",
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

describe("seller journey walkthrough", () => {
  const chapters = SELLER_JOURNEY_CHAPTERS;
  const steps = chapters.flatMap((chapter) => chapter.steps);

  it("has every chapter in the agreed order", () => {
    expect(chapters.map((chapter) => chapter.id)).toEqual([
      "onboarding",
      "store",
      "catalog-add",
      "catalog-maintain",
      "menus-offers-addons",
      "orders",
      "notifications",
      "payouts",
      "settings",
      "more",
    ]);
  });

  it("keeps the onboarding chapter identical to the application script", () => {
    const onboarding = chapters[0]!;
    expect(onboarding.id).toBe("onboarding");
    expect(onboarding.steps).toEqual(SELLER_TOUR_STEPS);
  });

  it("has unique chapter ids and a title and subtitle for each", () => {
    expect(new Set(chapters.map((chapter) => chapter.id)).size).toBe(chapters.length);
    for (const chapter of chapters) {
      expect(chapter.title.length).toBeGreaterThan(0);
      expect(chapter.subtitle.length).toBeGreaterThan(0);
      expect(chapter.steps.length).toBeGreaterThan(0);
    }
  });

  it("has globally unique step ids", () => {
    expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
  });

  it("has a unique target within each chapter", () => {
    for (const chapter of chapters) {
      expect(new Set(chapter.steps.map((step) => step.target)).size).toBe(chapter.steps.length);
    }
  });

  it("has copy, a known action and a sane dwell time for every step", () => {
    for (const step of steps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.detail.length).toBeGreaterThan(0);
      expect(ACTIONS.has(step.action)).toBe(true);
      expect(step.holdMs).toBeGreaterThanOrEqual(1200);
      expect(step.holdMs).toBeLessThanOrEqual(3000);
    }
  });
});
