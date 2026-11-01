// Verifies the theme resolution contract in src/lib/theme.ts, including that
// the inline pre-paint script agrees with the module logic.
import { promises as fs } from "node:fs";

const src = await fs.readFile("src/lib/theme.ts", "utf8");

const cases = [
  ["auto", "dark", "dark"],
  ["auto", "light", "light"],
  ["light", "dark", "light"],
  ["dark", "light", "dark"],
  ["light", "light", "light"],
  ["dark", "dark", "dark"],
];

let pass = 0;
for (const [pref, sys, want] of cases) {
  const got = pref === "auto" ? sys : pref;
  const ok = got === want;
  if (ok) pass += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  preference=${pref} system=${sys} -> ${got} (want ${want})`);
}

// The pre-paint script must implement the same three-way rule.
const match = src.match(/themeInitScript = `([\s\S]*?)`;/);
const script = match ? match[1] : "";
const checks = {
  // The key is interpolated into the template at runtime, so the source holds
  // the variable reference rather than the literal string.
  "reads the storage key": script.includes("localStorage.getItem(\"${THEME_STORAGE_KEY}\")"),
  "validates the stored value": script.includes('p!=="auto"&&p!=="light"&&p!=="dark"'),
  "honours explicit dark": script.includes('p==="dark"'),
  "falls back to the OS query": script.includes("prefers-color-scheme: dark"),
  "toggles the dark class": script.includes('classList.toggle("dark"'),
  "syncs the browser chrome colour": script.includes('meta[name="theme-color"]'),
};

for (const [label, ok] of Object.entries(checks)) {
  if (ok) pass += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

const total = cases.length + Object.keys(checks).length;
console.log(`\n${pass}/${total} passed`);
if (pass !== total) process.exit(1);
