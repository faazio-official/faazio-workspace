#!/usr/bin/env node
// Portal env guard. NEXT_PUBLIC_* values are inlined by `next build`, not read at request time, so a
// missing gateway URL ships a build whose every auth route 503s with `not_configured`. This warns in
// dev (`predev`) and blocks the build (`prebuild --strict`). No dependencies; never prints values.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");

function load(file) {
  const map = {};
  const path = join(root, file);
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[match[1]] = value;
  }
  return map;
}

const env = { ...load(".env"), ...load(".env.local"), ...process.env };
const gateway = (env.NEXT_PUBLIC_GATEWAY_URL ?? "").trim();
const cdn = (env.NEXT_PUBLIC_MEDIA_CDN_BASE ?? "").trim();
const hasLocal = existsSync(join(root, ".env.local"));

const blockers = [];
if (!gateway) {
  blockers.push(
    "NEXT_PUBLIC_GATEWAY_URL is unset — portal auth returns 503 not_configured. Set it in Vercel's Environment Variables (and .env.local locally), then rebuild.",
  );
}

const warnings = [];
if (cdn.endsWith("/assets")) {
  warnings.push(
    "NEXT_PUBLIC_MEDIA_CDN_BASE points at the gateway /assets path — leave it empty unless a real CDN custom domain exists.",
  );
}
if (!hasLocal && /^https:\/\//.test(gateway)) {
  warnings.push(
    "No .env.local — copy .env.example to .env.local and use http://localhost:8080 for local dev; keep https://api.faazio.com for prod preview only (and redeploy after changing it).",
  );
}

if (blockers.length > 0 || warnings.length > 0) {
  console.error(`[portal env] ${strict && blockers.length > 0 ? "BUILD BLOCKED" : "warning"}:`);
  for (const problem of [...blockers, ...warnings]) console.error(`  - ${problem}`);
  if (strict && blockers.length > 0) process.exit(1);
} else {
  console.log("[portal env] NEXT_PUBLIC_GATEWAY_URL is configured.");
}