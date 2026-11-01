"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/hooks/useTheme";
import { THEME_OPTIONS, type ThemePreference } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LABEL: Record<ThemePreference, string> = {
  auto: "Auto",
  light: "Light",
  dark: "Dark",
};

const HINT: Record<ThemePreference, string> = {
  auto: "Follow the device setting",
  light: "Always light",
  dark: "Always dark",
};

const ICON = { auto: Monitor, light: Sun, dark: Moon } as const;

/**
 * Segmented theme control for a settings page. Three explicit choices, each
 * with its own label, so the current state is readable without opening
 * anything. `role="radiogroup"` because exactly one option is always active.
 */
export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5",
        className,
      )}
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = ICON[option];
        const active = preference === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            title={HINT[option]}
            onClick={() => setPreference(option)}
            className={cn(
              "focus-ringed inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.08)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            {LABEL[option]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact theme menu for the shell header. The trigger shows the resolved
 * theme so the icon matches what is on screen, while the menu lists the three
 * preferences.
 */
export function ThemeMenu() {
  const { preference, resolved, setPreference } = useTheme();
  const TriggerIcon = resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Theme: ${LABEL[preference]}`}
          title={`Theme: ${LABEL[preference]}`}
        >
          <TriggerIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = ICON[option];
            return (
              <DropdownMenuRadioItem key={option} value={option} className="gap-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1">{LABEL[option]}</span>
                <span className="text-[11px] text-muted-foreground">{HINT[option]}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
