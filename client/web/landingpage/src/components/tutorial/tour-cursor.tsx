import { AnimatePresence, motion } from "motion/react";
import { EASE, TRANSITION } from "@/lib/motion";
import type { SellerJourneyAction } from "@/lib/tutorials/seller-journey";

type TourCursorProps = {
  x: number;
  y: number;
  pressed: boolean;
  rippleKey: number;
  action?: SellerJourneyAction;
};

/**
 * The pointing pointer. Movement is transform-only and x/y travel on slightly
 * different durations, so the hand follows an arc rather than a straight line
 * (UI_DESIGN_SYSTEM §3 Pass 9). The glyph changes with the step's action —
 * a hand for a tap, a text caret for typing, a scan frame for the QR — so the
 * gesture on screen always matches what the step says it does. The fingertip is
 * offset onto the measured target centre so the press lands where the eye
 * expects.
 */
export function TourCursor({ x, y, pressed, rippleKey, action = "tap" }: TourCursorProps) {
  const isType = action === "type";
  const isScan = action === "scan";

  return (
    <motion.div
      className="tour-cursor"
      data-action={action}
      initial={{ x: 32, y: 40, opacity: 0 }}
      animate={{ x: x + 6, y: y + 2, opacity: 1 }}
      transition={{
        x: { duration: 0.5, ease: EASE.move },
        y: { duration: 0.42, ease: EASE.move },
        opacity: { duration: 0.2, ease: EASE.entrance },
      }}
    >
      <motion.svg
        viewBox={isScan ? "0 0 24 24" : "0 0 24 28"}
        width={isScan ? 30 : 26}
        height={isScan ? 30 : 30}
        fill="none"
        aria-hidden="true"
        animate={{ scale: pressed ? 0.9 : 1 }}
        transition={TRANSITION.press}
        style={{ transformOrigin: isScan ? "50% 50%" : "32% 10%" }}
      >
        {isScan ? (
          <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
            <path d="M3 8V4.6A1.6 1.6 0 0 1 4.6 3H8" />
            <path d="M16 3h3.4A1.6 1.6 0 0 1 21 4.6V8" />
            <path d="M21 16v3.4A1.6 1.6 0 0 1 19.4 21H16" />
            <path d="M8 21H4.6A1.6 1.6 0 0 1 3 19.4V16" />
            <path d="M3 12h18" strokeDasharray="3 3" opacity="0.65" />
          </g>
        ) : isType ? (
          <g stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
            <path d="M8.5 5.5h7" />
            <path d="M12 5.5v13" />
            <path d="M8.5 18.5h7" />
          </g>
        ) : (
          <path
            d="M9.1 2.4c-.84 0-1.52.68-1.52 1.52v7.9l-1.02-.6a1.72 1.72 0 0 0-2.35.63c-.41.71-.24 1.6.4 2.12l4.85 3.96c.36.3.82.46 1.29.46h4.36a2.9 2.9 0 0 0 2.9-2.9v-5.05c0-.84-.68-1.52-1.52-1.52-.36 0-.7.13-.97.34-.13-.67-.72-1.17-1.42-1.17-.3 0-.58.09-.81.25V6.3c0-.84-.68-1.52-1.52-1.52-.3 0-.58.09-.81.25V3.92c0-.84-.68-1.52-1.52-1.52-.27 0-.52.07-.74.19V2.4z"
            fill="var(--color-card)"
            stroke="currentColor"
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
        )}
      </motion.svg>

      <AnimatePresence>
        {rippleKey > 0 ? (
          <motion.span
            key={rippleKey}
            className="tour-ripple"
            style={{ left: 0, top: 0, marginLeft: isScan ? -4 : -7, marginTop: isScan ? -8 : -12 }}
            initial={{ scale: 0.4, opacity: 0.7 }}
            animate={{ scale: 1.7, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE.entrance }}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
