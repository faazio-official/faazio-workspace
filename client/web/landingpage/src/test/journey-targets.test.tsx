import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SELLER_JOURNEY_CHAPTERS, type SellerJourneyScreen } from "@/lib/tutorials/seller-journey";
import { SCREENS } from "@/components/tutorial/tour-stage";

/**
 * Every step names the control it presses (`step.target`), and the stage finds
 * that control by `data-tour-target`. A target with no matching element renders
 * a chapter with a missing ring and a vanished cursor, so the script must never
 * outrun the screens. This renders each screen once per step's active target and
 * asserts the target is in the markup.
 */
const render = (screen: SellerJourneyScreen, activeTarget: string) =>
  renderToStaticMarkup(
    // The stage wraps every screen in the same decorative context.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (SCREENS as any)[screen]({ activeTarget }),
  );

describe("seller journey screens", () => {
  it("mounts a screen for every screen id in the script", () => {
    const used = new Set(SELLER_JOURNEY_CHAPTERS.flatMap((c) => c.steps.map((s) => s.screen)));
    for (const screen of used) {
      expect(SCREENS[screen], `no component for screen "${screen}"`).toBeTruthy();
      expect(render(screen, "")).toMatch(/class="t[ap]-device"/);
    }
  });

  it("renders the control each step presses", () => {
    const missing: string[] = [];
    for (const chapter of SELLER_JOURNEY_CHAPTERS) {
      for (const step of chapter.steps) {
        const html = render(step.screen, step.target);
        if (!html.includes(`data-tour-target="${step.target}"`)) {
          missing.push(`${chapter.id}/${step.id} → ${step.screen} [${step.target}]`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
  // The portal screens mark the pressed control. The customer-app screens (chapter 1
  // and the fee request) rely on the ring alone — the app kit has no `data-active`.
  const APP_SCREENS = new Set<SellerJourneyScreen>([
    "account",
    "registration",
    "review",
    "fee-request",
  ]);

  it("highlights the control the step presses", () => {
    const missing: string[] = [];
    for (const chapter of SELLER_JOURNEY_CHAPTERS) {
      for (const step of chapter.steps) {
        if (APP_SCREENS.has(step.screen)) continue;
        const html = render(step.screen, step.target);
        const marked =
          new RegExp(`data-tour-target="${step.target}"[^>]*data-active="true"`).test(html) ||
          new RegExp(`data-active="true"[^>]*data-tour-target="${step.target}"`).test(html);
        if (!marked) missing.push(`${chapter.id}/${step.id} → ${step.screen} [${step.target}]`);
      }
    }
    expect(missing).toEqual([]);
  });
});
