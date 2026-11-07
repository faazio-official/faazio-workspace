#!/usr/bin/env node
/**
 * UI-hygiene guard. Counts the tells the design system bans and fails when a
 * count regresses past the committed baseline (`.ui-baseline.json`):
 *
 *   - hardcoded hex colour literals (`#rgb` / `#rrggbb` / `#rrggbbaa`)
 *   - `fontSize` below the 11pt floor
 *   - `fontWeight` 700/800/900 (or `bold`)
 *   - emoji / pictographic glyphs used as UI
 *
 * The baseline is the debt that existed when this guard landed; it is a ratchet,
 * not a target. When you legitimately reduce debt, run
 * `node scripts/check-ui.mjs --update` to lower the ceiling. New code must not
 * raise any count.
 *
 * Usage:
 *   node scripts/check-ui.mjs            # fail on a regression
 *   node scripts/check-ui.mjs --update   # rewrite the baseline to current counts
 *   node scripts/check-ui.mjs --report   # print counts + worst files, always exit 0
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, '.ui-baseline.json');

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const WEIGHT_RE = /fontWeight:\s*['"](?:700|800|900|bold)['"]/g;
const FONT_MS_RE = /fontSize:\s*ms\(\s*([0-9.]+)/g;
const FONT_NUM_RE = /fontSize:\s*([0-9.]+(?!\s*\)))/g;
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

const args = new Set(process.argv.slice(2));
const update = args.has('--update');
const reportOnly = args.has('--report');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const counts = { hex: 0, tiny: 0, heavy: 0, emoji: 0 };
const perFile = { hex: [], tiny: [], heavy: [], emoji: [] };

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);

  const hex = text.match(HEX_RE)?.length ?? 0;
  const heavy = text.match(WEIGHT_RE)?.length ?? 0;
  let tiny = 0;
  for (const match of text.matchAll(FONT_MS_RE)) {
    if (Number(match[1]) < 11) tiny += 1;
  }
  for (const match of text.matchAll(FONT_NUM_RE)) {
    if (Number(match[1]) < 11) tiny += 1;
  }
  const emoji = text.match(EMOJI_RE)?.length ?? 0;

  counts.hex += hex;
  counts.tiny += tiny;
  counts.heavy += heavy;
  counts.emoji += emoji;
  if (hex) perFile.hex.push([rel, hex]);
  if (tiny) perFile.tiny.push([rel, tiny]);
  if (heavy) perFile.heavy.push([rel, heavy]);
  if (emoji) perFile.emoji.push([rel, emoji]);
}

for (const key of Object.keys(perFile)) {
  perFile[key].sort((a, b) => b[1] - a[1]);
}

if (reportOnly) {
  console.log(JSON.stringify({ counts, worst: Object.fromEntries(
    Object.entries(perFile).map(([k, v]) => [k, v.slice(0, 8)]),
  ) }, null, 2));
  process.exit(0);
}

if (update) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`[check:ui] baseline updated: ${JSON.stringify(counts)}`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : null;

if (!baseline) {
  console.error('[check:ui] no .ui-baseline.json found. Run `node scripts/check-ui.mjs --update`.');
  process.exit(1);
}

const regressions = Object.keys(counts).filter((key) => counts[key] > (baseline[key] ?? 0));

if (regressions.length === 0) {
  console.log(`[check:ui] ok — ${JSON.stringify(counts)} (baseline ${JSON.stringify(baseline)})`);
  process.exit(0);
}

console.error('[check:ui] UI-hygiene regression detected:');
for (const key of regressions) {
  console.error(`  ${key}: ${baseline[key]} → ${counts[key]}`);
  for (const [file, n] of perFile[key].slice(0, 8)) {
    console.error(`      ${file} (${n})`);
  }
}
console.error('\nMove colours onto a token, use weights 400–600, keep type ≥ 11pt, and never use emoji as an icon.');
process.exit(1);
