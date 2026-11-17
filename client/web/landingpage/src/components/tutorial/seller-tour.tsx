import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useReducedMotion } from "motion/react";
import { SELLER_TOUR_STEPS } from "@/lib/tutorials/seller-onboarding";
import { TourControls } from "./tour-controls";
import { TourStage } from "./tour-stage";

const TRAVEL_MS = 520;
const PRESS_MS = 140;

/**
 * User-driven step machine. Watch plays the walkthrough once and stops; it
 * never loops (UI_DESIGN_SYSTEM §3 Pass 9 / §10). Playback also stops as soon
 * as the section leaves the viewport or the tab is hidden.
 */
export function SellerTour() {
  const reduced = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const total = SELLER_TOUR_STEPS.length;
  const step = SELLER_TOUR_STEPS[index] ?? SELLER_TOUR_STEPS[0]!;

  const goTo = useCallback(
    (next: number, announce: boolean) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      setIndex(clamped);
      if (announce) {
        const target = SELLER_TOUR_STEPS[clamped]!;
        setAnnouncement(`Step ${clamped + 1} of ${total}: ${target.title}`);
      }
    },
    [total],
  );

  const select = useCallback(
    (next: number) => {
      setPlaying(false);
      goTo(next, true);
    },
    [goTo],
  );

  useEffect(() => {
    if (reduced) {
      setPressed(false);
      return;
    }
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
  }, [index, reduced]);

  useEffect(() => {
    if (!playing) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => goTo(index + 1, false),
      TRAVEL_MS + PRESS_MS + step.holdMs,
    );
    return () => window.clearTimeout(timer);
  }, [playing, index, total, step.holdMs, goTo]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              if (entry && !entry.isIntersecting) setPlaying(false);
            },
            { threshold: 0.25 },
          );
    observer?.observe(root);

    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (index >= total - 1) goTo(0, true);
    setPlaying(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      select(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      select(index - 1);
    }
  };

  return (
    <div className="tour" ref={rootRef} onKeyDown={onKeyDown}>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="tour-layout">
        <ol className="tour-rail">
          {SELLER_TOUR_STEPS.map((item, i) => (
            <li key={item.id} id={`step-${item.id}`}>
              <button
                type="button"
                aria-current={i === index ? "step" : undefined}
                onClick={() => select(i)}
              >
                <span className="tour-rail-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="tour-rail-text">
                  <span className="tour-rail-title">{item.title}</span>
                  <span className="tour-rail-detail">{item.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="tour-main">
          <TourStage step={step} pressed={pressed} rippleKey={rippleKey} />
          <TourControls
            index={index}
            labels={SELLER_TOUR_STEPS.map((item) => item.title)}
            playing={playing}
            reduced={reduced}
            onPrev={() => select(index - 1)}
            onNext={() => select(index + 1)}
            onSelect={select}
            onTogglePlay={togglePlay}
          />
        </div>
      </div>
    </div>
  );
}
