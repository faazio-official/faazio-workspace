import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  SELLER_JOURNEY_CHAPTERS,
  type SellerJourneyChapter,
  type SellerJourneyStep,
} from "@/lib/tutorials/seller-journey";
import { TourStage } from "./tour-stage";

const TRAVEL_MS = 520;
const PRESS_MS = 140;

/** The caption's verb, matching the stage callout's. */
const ACTION_LABEL: Record<SellerJourneyStep["action"], string> = {
  tap: "Tap",
  type: "Type in",
  scan: "Scan",
  swipe: "Swipe",
};

/**
 * Seller journey as a list of FAQ-style rows, one per chapter. Opening a row plays that chapter
 * once, top to bottom, then stops on its last screen with Replay — it never loops
 * (UI_DESIGN_SYSTEM §3 Pass 9 / §10). Only the open chapter animates, so a long page costs one
 * player at a time. The stage is decorative; the step list under it is the accessible content.
 */
export function SellerTour() {
  const [open, setOpen] = useState<string>(SELLER_JOURNEY_CHAPTERS[0]!.id);

  return (
    <Accordion
      type="single"
      collapsible
      value={open}
      onValueChange={setOpen}
      className="journey-list"
    >
      {SELLER_JOURNEY_CHAPTERS.map((chapter, index) => (
        <AccordionItem key={chapter.id} value={chapter.id} className="journey-item">
          <AccordionTrigger className="journey-trigger py-5 hover:no-underline">
            <span className="journey-trigger-inner">
              <span className="journey-num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="journey-trigger-text">
                <span className="journey-trigger-title">{chapter.title}</span>
                <span className="journey-trigger-sub">{chapter.subtitle}</span>
              </span>
              <span className="journey-count">
                {chapter.steps.length} {chapter.steps.length === 1 ? "step" : "steps"}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-7">
            <ChapterPlayer chapter={chapter} open={open === chapter.id} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function ChapterPlayer({ chapter, open }: { chapter: SellerJourneyChapter; open: boolean }) {
  const prefersReduced = useReducedMotion() ?? false;
  // useReducedMotion is false during SSR and true on the client, so branching on it directly
  // renders different markup on hydrate. Only honour it after mount.
  const [mounted, setMounted] = useState(false);
  const reduced = mounted && prefersReduced;
  const steps = chapter.steps;
  const total = steps.length;
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const step = steps[index] ?? steps[0]!;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (reduced || !visible || finished) return;
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
  }, [reduced, visible, finished, index]);

  useEffect(() => {
    if (reduced || !visible || finished) return;
    const timer = window.setTimeout(
      () => {
        if (index >= total - 1) setFinished(true);
        else setIndex((value) => value + 1);
      },
      TRAVEL_MS + PRESS_MS + step.holdMs,
    );
    return () => window.clearTimeout(timer);
  }, [reduced, visible, finished, index, step.holdMs, total]);

  const restart = useCallback(() => {
    setIndex(0);
    setFinished(false);
    setVisible(true);
    setPressed(false);
    setRippleKey(0);
  }, []);

  const next = useCallback(() => {
    if (index >= total - 1) restart();
    else setIndex((value) => value + 1);
  }, [index, restart, total]);

  return (
    <div className="journey-panel" ref={rootRef}>
      <TourStage step={step} pressed={pressed} rippleKey={rippleKey} />
      <p className="journey-caption" aria-live="polite">
        <span className="journey-caption-step">
          Step {index + 1} of {total}
        </span>
        {finished
          ? ` · ${chapter.title} complete`
          : ` · ${step.title} — ${ACTION_LABEL[step.action]} “${step.control}”`}
      </p>
      {reduced || finished ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={next}>
          {index >= total - 1 ? "Replay chapter" : "Next step"}
        </button>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
          Restart
        </button>
      )}
    </div>
  );
}
