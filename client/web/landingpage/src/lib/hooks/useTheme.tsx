import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  systemTheme,
  writeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  /** What the visitor chose: auto, light or dark. */
  preference: ThemePreference;
  /** What is actually painted right now. */
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Owns the theme preference for the landing page. The initial value is read
 * from localStorage after mount (the pre-paint script in <head> has already put
 * the right class on <html>), so server and first client render agree.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Adopt the stored preference once mounted, then keep <html> in sync with it.
  useEffect(() => {
    const stored = readThemePreference();
    setPreferenceState(stored);
    const next = resolveTheme(stored);
    setResolved(next);
    applyTheme(next);
  }, []);

  // While the preference is `auto`, follow the OS live.
  useEffect(() => {
    if (preference !== "auto" || typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setResolved(next);
      applyTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    writeThemePreference(next);
    setPreferenceState(next);
    const applied = resolveTheme(next);
    setResolved(applied);
    applyTheme(applied);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Read and set the theme. Returns a safe default when no provider is mounted so
 * a missing provider degrades to "auto" instead of throwing.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context) return context;
  return { preference: "auto", resolved: "light", setPreference: () => {} };
}
