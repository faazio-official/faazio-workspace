import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { SellerTourStep } from "@/lib/tutorials/seller-onboarding";
import { TourStage } from "./tour-stage";

const TRAVEL_MS = 520;
const PRESS_MS = 140;

/**
 * One step, one animation. Mounted only while its accordion item is open, so
 * opening a step plays the hand once; Replay restarts it. The animation never
 * loops (UI_DESIGN_SYSTEM §3 Pass 9 / §10).
 */
export function StepDemo({ step }: { step: SellerTourStep }) {
  const reduced = useReducedMotion() ?? false;
  const [run, setRun] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);

  useEffect(() => {
    if (reduced) return;
    setPressed(false);
    const press = window.setTimeout(() => setPressed(true), TRAVEL_MS);
    const release = window.setTimeout(() => {
      setPressed(false);
      setRippleKey((key) => key + 1);
    }, TRAVEL_MS + PRESS_MS);
    return () => {
      window.clearTimeout(press);
      window.clearTimeout(release);
    };
  }, [reduced, run, step.id]);

  return (
    <div className="onboarding-demo">
      <TourStage key={run} step={step} pressed={pressed} rippleKey={rippleKey} />
      {reduced ? null : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setRun((value) => value + 1)}
        >
          Replay
        </button>
      )}
    </div>
  );
}
