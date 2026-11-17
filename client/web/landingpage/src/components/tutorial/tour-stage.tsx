import { useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE } from "@/lib/motion";
import type { SellerTourScreen, SellerTourStep } from "@/lib/tutorials/seller-onboarding";
import { TourCursor } from "./tour-cursor";
import {
  AccountScreen,
  BusinessScreen,
  ContractScreen,
  ShopsScreen,
  VerifyScreen,
  type ScreenProps,
} from "./screens";

const SCREENS: Record<SellerTourScreen, ComponentType<ScreenProps>> = {
  account: AccountScreen,
  business: BusinessScreen,
  shops: ShopsScreen,
  contract: ContractScreen,
  verify: VerifyScreen,
};

type TargetRect = { x: number; y: number; width: number; height: number };

export function TourStage({
  step,
  pressed,
  rippleKey,
}: {
  step: SellerTourStep;
  pressed: boolean;
  rippleKey: number;
}) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const Screen = SCREENS[step.screen];

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const target = stage.querySelector<HTMLElement>(`[data-tour-target="${step.target}"]`);
      if (!target) {
        setRect(null);
        return;
      }
      const a = target.getBoundingClientRect();
      const b = stage.getBoundingClientRect();
      setRect({
        x: a.left - b.left + a.width / 2,
        y: a.top - b.top + a.height / 2,
        width: a.width,
        height: a.height,
      });
    };

    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(stage);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [step.id, step.target]);

  return (
    <div className="tour-stage-wrap">
      <div className="tour-stage" ref={stageRef} aria-hidden="true">
        <AnimatePresence initial={false}>
          <motion.div
            key={step.id}
            className="tour-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: DURATION.exit, ease: EASE.entrance } }}
            transition={{ duration: DURATION.enter, ease: EASE.entrance }}
          >
            <Screen activeTarget={step.target} />
          </motion.div>
        </AnimatePresence>

        {rect ? (
          <span
            key={step.id}
            className="tour-ring"
            style={{
              left: rect.x - rect.width / 2 - 4,
              top: rect.y - rect.height / 2 - 4,
              width: rect.width + 8,
              height: rect.height + 8,
            }}
          />
        ) : null}

        {!reduced && rect ? (
          <TourCursor
            x={rect.width > 220 ? rect.x + rect.width / 2 - 30 : rect.x}
            y={rect.y}
            pressed={pressed}
            rippleKey={rippleKey}
          />
        ) : null}
      </div>
    </div>
  );
}
