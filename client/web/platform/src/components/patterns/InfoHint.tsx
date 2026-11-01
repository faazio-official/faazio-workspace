"use client";
import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Small "i" button. Hover or focus on desktop, tap on touch screens.
 * Content is plain instructions, never jargon.
 */
export function InfoHint({
  title,
  children,
  className,
  side = "bottom",
  label = "What is this?",
}: {
  title?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  side?: "top" | "right" | "bottom" | "left" | undefined;
  label?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={120}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "focus-ringed inline-flex size-5 shrink-0 cursor-help items-center justify-center self-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground",
            className,
          )}
        >
          <Info className="size-3" strokeWidth={1.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align="start"
        className="max-w-xs border border-ink-border bg-ink px-3 py-2 text-[12px] leading-relaxed text-ink-foreground"
      >
        {title ? <p className="mb-0.5 font-medium">{title}</p> : null}
        <div className="text-ink-foreground/85">{children}</div>
      </TooltipContent>
    </Tooltip>
  );
}
