/**
 * Theme resolution for the Faazio landing page.
 *
 * Three preferences, one applied class:
 *   auto  → follow the OS `prefers-color-scheme`, live
 *   light → `.dark` absent
 *   dark  → `.dark` present on <html>
 *
 * Mirrors `client/web/platform/src/lib/theme.ts` so the marketing site and the
 * partner console resolve the same way, and share the same storage key: a
 * visitor who picks Dark on the landing page keeps it when they sign in to the
 * console, and vice versa.
 *
 * The preference lives in localStorage because it is a property of the browser,
 * not of an account. `__root.tsx` runs `themeInitScript` inline in <head> so the
 * correct theme is on <html> before first paint — no flash of the wrong theme.
 */

export type ThemePreference = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "faazio.theme";
export const THEME_OPTIONS: readonly ThemePreference[] = ["auto", "light", "dark"] as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "auto" || value === "light" || value === "dark";
}

/** Read the stored preference. Falls back to `auto` when storage is unavailable. */
export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "auto";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode / storage disabled: the choice still applies for this page view.
  }
}

/** The OS preference, defaulting to light when the query is unsupported. */
export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "auto" ? systemTheme() : preference;
}

/**
 * Browser chrome colours, matching `--background` in each theme. The two
 * media-scoped <meta name="theme-color"> tags in `__root.tsx` cover the
 * pre-paint case, but they follow the OS, not the stored preference: a visitor
 * whose OS is dark and who picked Light would otherwise get dark browser chrome
 * above a light page. `applyTheme` rewrites the metas so the chrome always
 * matches what is actually painted.
 */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#fbfaf7",
  dark: "#1a1714",
};

function syncThemeColor(resolved: ResolvedTheme): void {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  for (const meta of metas) {
    meta.content = THEME_COLOR[resolved];
  }
}

/** Put the resolved theme on <html>. `color-scheme` is set by the CSS itself. */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  syncThemeColor(resolved);
}

/**
 * Inline pre-paint script. Kept as a string so it can be injected into <head>
 * and run before the first paint. Mirrors readThemePreference/resolveTheme/
 * applyTheme exactly.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="auto"&&p!=="light"&&p!=="dark")p="auto";var d=p==="dark"||(p==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute("content",d?"#1a1714":"#fbfaf7");}}catch(e){}})();`;
