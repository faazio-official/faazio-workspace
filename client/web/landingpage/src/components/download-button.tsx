import { motion, useReducedMotion } from "motion/react";
import { HiArrowDownTray, HiArrowUpRight } from "react-icons/hi2";
import { Button } from "@/components/ui/button";

type DownloadButtonProps = { onClick: () => void; compact?: boolean };

export function DownloadButton({ onClick, compact = false }: DownloadButtonProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="download-control"
      whileHover={reduced ? {} : { y: -3 }}
      whileTap={reduced ? {} : { scale: 0.97 }}
    >
      <Button
        variant="download"
        size={compact ? "default" : "lg"}
        className={compact ? "download-button download-button-compact" : "download-button"}
        onClick={onClick}
      >
        <span className="download-button-icon">
          <HiArrowDownTray aria-hidden="true" />
        </span>
        <span>{compact ? "Get the app" : "Get the Faazio app"}</span>
        <HiArrowUpRight aria-hidden="true" className="download-button-arrow" />
      </Button>
    </motion.div>
  );
}
