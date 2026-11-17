import { AnimatePresence, motion } from "motion/react";
import { EASE, TRANSITION } from "@/lib/motion";

type TourCursorProps = {
  x: number;
  y: number;
  pressed: boolean;
  rippleKey: number;
};

/**
 * The tapping hand. Movement is transform-only and x/y travel on slightly
 * different durations, so the hand follows an arc rather than a straight line
 * (UI_DESIGN_SYSTEM §3 Pass 9). The SVG's fingertip is offset onto the measured
 * target centre so the tap lands where the eye expects.
 */
export function TourCursor({ x, y, pressed, rippleKey }: TourCursorProps) {
  return (
    <motion.div
      className="tour-cursor"
      initial={{ x: 32, y: 40, opacity: 0 }}
      animate={{ x: x + 6, y: y + 2, opacity: 1 }}
      transition={{
        x: { duration: 0.5, ease: EASE.move },
        y: { duration: 0.42, ease: EASE.move },
        opacity: { duration: 0.2, ease: EASE.entrance },
      }}
    >
      <motion.svg
        viewBox="0 0 24 28"
        width={26}
        height={30}
        fill="none"
        aria-hidden="true"
        animate={{ scale: pressed ? 0.9 : 1 }}
        transition={TRANSITION.press}
        style={{ transformOrigin: "32% 10%" }}
      >
        <path
          d="M9.1 2.4c-.84 0-1.52.68-1.52 1.52v7.9l-1.02-.6a1.72 1.72 0 0 0-2.35.63c-.41.71-.24 1.6.4 2.12l4.85 3.96c.36.3.82.46 1.29.46h4.36a2.9 2.9 0 0 0 2.9-2.9v-5.05c0-.84-.68-1.52-1.52-1.52-.36 0-.7.13-.97.34-.13-.67-.72-1.17-1.42-1.17-.3 0-.58.09-.81.25V6.3c0-.84-.68-1.52-1.52-1.52-.3 0-.58.09-.81.25V3.92c0-.84-.68-1.52-1.52-1.52-.27 0-.52.07-.74.19V2.4z"
          fill="var(--color-card)"
          stroke="currentColor"
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      </motion.svg>

      <AnimatePresence>
        {rippleKey > 0 ? (
          <motion.span
            key={rippleKey}
            className="tour-ripple"
            style={{ left: 0, top: 0, marginLeft: -7, marginTop: -12 }}
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
