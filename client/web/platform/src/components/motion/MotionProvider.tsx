"use client";

import { LazyMotion, MotionConfig, domMax } from "motion/react";
import type { ReactNode } from "react";

import { DURATION, EASE } from "@/lib/motion";

/**
 * The single motion provider for the console. `reducedMotion="user"` follows the
 * OS setting; the default transition is the entrance curve. `LazyMotion` keeps
 * the bundle tree-shaken, and `strict` forces `m` components only (never the
 * full `motion` set). See docs/UI_DESIGN_SYSTEM.md §3 Pass 9.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: DURATION.enter, ease: EASE.entrance }}
    >
      <LazyMotion features={domMax} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
