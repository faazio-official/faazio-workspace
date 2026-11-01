import { motion, useReducedMotion } from "motion/react";
import { HiArrowDownTray, HiArrowUpRight } from "react-icons/hi2";

type DownloadButtonProps = { onClick: () => void; compact?: boolean };

/**
 * The app-download control. There is no verified store link yet, so it opens an
 * informative dialog rather than pretending to download.
 */
export function DownloadButton({ onClick, compact = false }: DownloadButtonProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="download-control"
      whileHover={reduced ? {} : { y: -2 }}
      whileTap={reduced ? {} : { scale: 0.985 }}
      transition={{ duration: 0.15 }}
    >
      <button
        type="button"
        className={compact ? "download-button btn-sm" : "download-button"}
        onClick={onClick}
      >
        <span className="download-button-icon">
          <HiArrowDownTray aria-hidden="true" />
        </span>
        <span>{compact ? "Get the app" : "Get the Faazio app"}</span>
        <HiArrowUpRight aria-hidden="true" className="download-button-arrow" />
      </button>
    </motion.div>
  );
}
