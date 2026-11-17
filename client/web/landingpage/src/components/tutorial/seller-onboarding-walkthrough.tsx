import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { HiOutlineCheckCircle } from "react-icons/hi2";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  SELLER_ONBOARDING_REQUIREMENTS,
  SELLER_TOUR_STEPS,
} from "@/lib/tutorials/seller-onboarding";
import { TourStage } from "./tour-stage";

const TRAVEL_MS = 520;
const PRESS_MS = 140;

/**
 * One FAQ-style row holding one continuous animation. Opening the row plays
 * every screen in order when it is visible, then stops on the submitted state
 * with Replay — it never loops. The requirements for the whole application sit
 * below the animation, inside the same dropdown.
 */
export function SellerOnboardingWalkthrough() {
  return (
    <div className="onboarding">
      <Accordion type="single" collapsible defaultValue="walkthrough" className="onboarding-list">
        <AccordionItem value="walkthrough" id="step-walkthrough" className="onboarding-item">
          <AccordionTrigger className="onboarding-trigger py-5 hover:no-underline">
            Watch the full application
          </AccordionTrigger>
          <AccordionContent className="pb-7">
            <div className="onboarding-panel">
              <WalkthroughPlayer />
              <div className="onboarding-needs">
                <h3>What you&apos;ll need</h3>
                <ul>
                  {SELLER_ONBOARDING_REQUIREMENTS.map((item) => (
                    <li key={item}>
                      <HiOutlineCheckCircle aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <p className="tour-disclaimer">
        An illustration of the Faazio app. Nothing on this page submits an application.
      </p>
    </div>
  );
}

function WalkthroughPlayer() {
  const reduced = useReducedMotion() ?? false;
  const total = SELLER_TOUR_STEPS.length;
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const step = SELLER_TOUR_STEPS[index] ?? SELLER_TOUR_STEPS[0]!;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !started || finished) return;
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
  }, [reduced, started, finished, index, run]);

  useEffect(() => {
    if (reduced || !started || finished) return;
    const timer = window.setTimeout(
      () => {
        if (index >= total - 1) setFinished(true);
        else setIndex((value) => value + 1);
      },
      TRAVEL_MS + PRESS_MS + step.holdMs,
    );
    return () => window.clearTimeout(timer);
  }, [reduced, started, finished, index, run, step.holdMs, total]);

  const restart = () => {
    setIndex(0);
    setFinished(false);
    setStarted(true);
    setPressed(false);
    setRippleKey(0);
    setRun((value) => value + 1);
  };

  const next = () => {
    if (index >= total - 1) restart();
    else setIndex((value) => value + 1);
  };

  return (
    <div className="onboarding-player" ref={rootRef}>
      <TourStage key={run} step={step} pressed={pressed} rippleKey={rippleKey} />
      <p className="onboarding-caption" aria-live="polite">
        {finished ? "Sent to Faazio — Pending review" : step.title}
      </p>
      {reduced ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={next}>
          {index >= total - 1 ? "Start over" : "Next screen"}
        </button>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
          {finished ? "Replay" : "Restart"}
        </button>
      )}
    </div>
  );
}
