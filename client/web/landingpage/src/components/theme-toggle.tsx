import { HiComputerDesktop, HiMoon, HiSun } from "react-icons/hi2";
import { useTheme } from "@/lib/hooks/useTheme";
import { THEME_OPTIONS, type ThemePreference } from "@/lib/theme";

const LABEL: Record<ThemePreference, string> = {
  auto: "Auto",
  light: "Light",
  dark: "Dark",
};

const HINT: Record<ThemePreference, string> = {
  auto: "Follow your device",
  light: "Always light",
  dark: "Always dark",
};

const ICON = { auto: HiComputerDesktop, light: HiSun, dark: HiMoon } as const;

/**
 * Theme control for the landing page header.
 *
 * Three explicit choices rather than a two-state switch, because "auto" is a
 * real preference and a visitor should be able to see which one is active.
 * `role="radiogroup"` because exactly one option is always selected.
 *
 * The trigger shows the resolved theme so the icon matches what is on screen.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={className ? `theme-toggle ${className}` : "theme-toggle"}
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
            aria-label={`${LABEL[option]} theme`}
            title={HINT[option]}
            onClick={() => setPreference(option)}
            className="theme-toggle-option"
            data-active={active ? "true" : undefined}
          >
            <Icon aria-hidden="true" />
            <span className="theme-toggle-label">{LABEL[option]}</span>
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {`Theme: ${LABEL[preference]} (${resolved})`}
      </span>
    </div>
  );
}
