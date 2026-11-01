/**
 * Contrast assertions for the four-role brand ramp.
 *
 * Reads the real `src/theme/brandTokens.ts` source and re-derives every ratio, so
 * it fails if a token is edited to something that breaks its rule.
 *
 *   node scripts/check-brand-contrast.mjs
 *
 * Rules enforced:
 *  - base carries onBase at >= 4.5
 *  - deep carries onDeep at >= 4.5
 *  - pressed carries onDeep at >= 4.5 and is darker than deep
 *  - tint carries onTint at >= 4.5
 *  - deep clears 3:1 on tint (non-text icon minimum), and base is rejected there
 *  - base is rejected as a white-text background (the rule that drives the ramp)
 *  - every semantic role carries white at >= 4.5 and sits >= 20 dE from every anchor
 *  - semantic roles are mutually separated and readable on their own tint
 *  - neutrals clear their surfaces
 *  - every legacy brandTokens btnBg carries its btnText
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(process.cwd(), 'src/theme/brandTokens.ts'), 'utf8');

function lin(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
function toLab(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(h.slice(i, i + 2), 16)));
  const X = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.95047);
  const fy = f(Y / 1.0);
  const fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function deltaE(a, b) {
  const la = toLab(a);
  const lb = toLab(b);
  return Math.sqrt(la.reduce((s, v, i) => s + Math.pow(v - lb[i], 2), 0));
}

function hexIn(block, key) {
  const re = new RegExp(`${key}:\\s*'(#[0-9A-Fa-f]{6})'`);
  const m = block.match(re);
  if (!m) throw new Error(`token not found: ${key}`);
  return m[1].toUpperCase();
}
function block(name, within) {
  const haystack = within ?? SRC;
  const start = haystack.indexOf(name);
  if (start < 0) throw new Error(`block not found: ${name}`);
  const open = haystack.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < haystack.length; i++) {
    if (haystack[i] === '{') depth++;
    else if (haystack[i] === '}') {
      depth--;
      if (depth === 0) return haystack.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced block: ${name}`);
}

const RAMP = block('export const brandRamp');
const rampBlock = (key) => block(`${key}: {`, RAMP);
const parent = block('parentRamp');
const LEGACY = block('export const brandTokens');
const brands = [
  ['MART', 'MART'],
  ['PHARMA', 'PHARMA'],
  ['FOOD', 'FOOD'],
];

let failures = 0;
let checks = 0;
function assert(ok, label, detail) {
  checks++;
  if (!ok) {
    failures++;
    console.log(`  FAIL  ${label} — ${detail}`);
  } else {
    console.log(`  ok    ${label} — ${detail}`);
  }
}

console.log('\n=== Ramp: text roles ===');
for (const [label, key] of brands) {
  const b = rampBlock(key);
  const base = hexIn(b, 'base');
  const onBase = hexIn(b, 'onBase');
  const deep = hexIn(b, 'deep');
  const onDeep = hexIn(b, 'onDeep');
  const pressed = hexIn(b, 'pressed');
  const tint = hexIn(b, 'tint');
  const onTint = hexIn(b, 'onTint');

  assert(contrast(base, onBase) >= 4.5, `${label} base/onBase`, contrast(base, onBase).toFixed(2));
  assert(contrast(deep, onDeep) >= 4.5, `${label} deep/onDeep`, contrast(deep, onDeep).toFixed(2));
  assert(contrast(pressed, onDeep) >= 4.5, `${label} pressed/onDeep`, contrast(pressed, onDeep).toFixed(2));
  assert(contrast(tint, onTint) >= 4.5, `${label} tint/onTint`, contrast(tint, onTint).toFixed(2));
  assert(contrast(deep, tint) >= 3.0, `${label} deep on tint (icon)`, contrast(deep, tint).toFixed(2));
  assert(contrast(base, tint) < 3.0, `${label} base rejected on tint`, contrast(base, tint).toFixed(2));
  assert(contrast(base, '#FFFFFF') < 4.5, `${label} base rejects white text`, contrast(base, '#FFFFFF').toFixed(2));
  assert(luminance(pressed) < luminance(deep), `${label} pressed darker than deep`, 'ok');
}

console.log('\n=== Ramp: parent ===');
{
  const base = hexIn(parent, 'base');
  const onBase = hexIn(parent, 'onBase');
  const deep = hexIn(parent, 'deep');
  const onDeep = hexIn(parent, 'onDeep');
  const pressed = hexIn(parent, 'pressed');
  const tint = hexIn(parent, 'tint');
  const onTint = hexIn(parent, 'onTint');
  assert(contrast(base, onBase) >= 4.5, 'PARENT base/onBase', contrast(base, onBase).toFixed(2));
  assert(contrast(deep, onDeep) >= 4.5, 'PARENT deep/onDeep', contrast(deep, onDeep).toFixed(2));
  assert(contrast(pressed, onDeep) >= 4.5, 'PARENT pressed/onDeep', contrast(pressed, onDeep).toFixed(2));
  assert(contrast(tint, onTint) >= 4.5, 'PARENT tint/onTint', contrast(tint, onTint).toFixed(2));
}

console.log('\n=== Semantic: white text + no brand collision ===');
{
  const sem = block('export const semantic');
  const anchors = [
    ['MART', hexIn(rampBlock('MART'), 'base')],
    ['PHARMA', hexIn(rampBlock('PHARMA'), 'base')],
    ['FOOD', hexIn(rampBlock('FOOD'), 'base')],
    ['PARENT', hexIn(parent, 'base')],
  ];
  const roles = ['success', 'danger', 'warning', 'info', 'neutral'];
  for (const role of roles) {
    const hex = hexIn(sem, role);
    assert(contrast(hex, '#FFFFFF') >= 4.5, `semantic.${role} white text`, contrast(hex, '#FFFFFF').toFixed(2));
    const nearest = anchors
      .map(([n, a]) => [n, deltaE(hex, a)])
      .sort((x, y) => x[1] - y[1])[0];
    assert(nearest[1] >= 20, `semantic.${role} clear of anchors`, `min dE ${nearest[1].toFixed(1)} (${nearest[0]})`);
  }
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const a = hexIn(sem, roles[i]);
      const b = hexIn(sem, roles[j]);
      assert(deltaE(a, b) >= 20, `semantic.${roles[i]} vs ${roles[j]}`, `dE ${deltaE(a, b).toFixed(1)}`);
    }
  }
}

console.log('\n=== Semantic tints carry their role colour ===');
{
  const sem = block('export const semantic');
  const tint = block('export const semanticTint');
  for (const role of ['success', 'danger', 'warning', 'info', 'neutral']) {
    const fg = hexIn(sem, role);
    const bg = hexIn(tint, role);
    assert(contrast(fg, bg) >= 4.5, `semantic.${role} on its tint`, contrast(fg, bg).toFixed(2));
  }
}

console.log('\n=== Neutrals ===');
{
  const n = block('export const neutral');
  const ink = hexIn(n, 'ink');
  const inkMuted = hexIn(n, 'inkMuted');
  const inkSubtle = hexIn(n, 'inkSubtle');
  const surface = hexIn(n, 'surface');
  const surfaceAlt = hexIn(n, 'surfaceAlt');
  const card = hexIn(n, 'card');
  assert(contrast(ink, card) >= 4.5, 'neutral ink on card', contrast(ink, card).toFixed(2));
  assert(contrast(inkMuted, card) >= 4.5, 'neutral inkMuted on card', contrast(inkMuted, card).toFixed(2));
  assert(contrast(ink, surface) >= 4.5, 'neutral ink on surface', contrast(ink, surface).toFixed(2));
  assert(contrast(inkSubtle, card) >= 3.0, 'neutral inkSubtle on card (3:1)', contrast(inkSubtle, card).toFixed(2));
  assert(contrast(inkSubtle, surfaceAlt) >= 3.0, 'neutral inkSubtle on surfaceAlt (3:1)', contrast(inkSubtle, surfaceAlt).toFixed(2));
}

console.log('\n=== Legacy brandTokens: every field carries its own pairing ===');
for (const [label, key] of brands) {
  const b = block(`${key}: {`, LEGACY);
  const btnBg = hexIn(b, 'btnBg');
  const btnText = hexIn(b, 'btnText');
  assert(contrast(btnBg, btnText) >= 4.5, `brandTokens.${label}.btnBg/btnText`, contrast(btnBg, btnText).toFixed(2));

  // accent / priceColor / tabActiveColor are all read as text on white or as a
  // fill under white text, so each must clear 4.5 against white.
  for (const field of ['accent', 'priceColor', 'tabActiveColor', 'accentDark']) {
    const v = hexIn(b, field);
    assert(contrast(v, '#FFFFFF') >= 4.5, `brandTokens.${label}.${field} on white`, contrast(v, '#FFFFFF').toFixed(2));
  }

  // badgeBg / accentLight are base fills: they must NOT be used under white
  // text, which is exactly why they are allowed to fail it.
  for (const field of ['badgeBg', 'accentLight']) {
    const m = b.match(new RegExp(`${field}:\\s*'(#[0-9A-Fa-f]{6})'`));
    if (!m) continue; // accentLight is optional
    const v = m[1].toUpperCase();
    assert(contrast(v, '#FFFFFF') < 4.5, `brandTokens.${label}.${field} is a base fill (no white text)`, contrast(v, '#FFFFFF').toFixed(2));
  }

  // btnAdded is a fill under white text.
  const added = hexIn(b, 'btnAdded');
  assert(contrast(added, '#FFFFFF') >= 4.5, `brandTokens.${label}.btnAdded on white`, contrast(added, '#FFFFFF').toFixed(2));

  // The header gradient carries headerTextColor across BOTH stops.
  const grad = b.match(/headerGradient:\s*\['(#[0-9A-Fa-f]{6})',\s*'(#[0-9A-Fa-f]{6})'\]/);
  if (!grad) throw new Error(`headerGradient not found for ${label}`);
  const hdrText = hexIn(b, 'headerTextColor');
  for (const stop of [grad[1], grad[2]]) {
    const s = stop.toUpperCase();
    assert(contrast(s, hdrText) >= 4.5, `brandTokens.${label}.header ${s} / headerTextColor`, contrast(s, hdrText).toFixed(2));
  }
}

console.log('\n=== Badge fills carry white badge text ===');
{
  const src = readFileSync(join(process.cwd(), 'src/components/shared/format.ts'), 'utf8');
  const map = src.slice(src.indexOf('const badgeHexMap'), src.indexOf('export function resolveBadgeBg'));
  const hexes = [...map.matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1].toUpperCase());
  if (hexes.length === 0) throw new Error('no badge hexes found');
  for (const h of hexes) {
    assert(contrast(h, '#FFFFFF') >= 4.5, `badge ${h} carries white text`, contrast(h, '#FFFFFF').toFixed(2));
  }
}

console.log('\n=== Categorical icon palette: readable, and clear of every anchor ===');
{
  const src = readFileSync(join(process.cwd(), 'src/theme/categorical.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const categorical'));
  const entries = [...body.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2].toUpperCase()]);
  if (entries.length === 0) throw new Error('no categorical colours found');
  const anchors = [
    ...brands.map(([, key]) => hexIn(rampBlock(key), 'base')),
    hexIn(parent, 'base'),
  ];
  for (const [name, hex] of entries) {
    assert(contrast(hex, '#FFFFFF') >= 3.0, `categorical.${name} on white (3:1 icon)`, contrast(hex, '#FFFFFF').toFixed(2));
    const nearest = Math.min(...anchors.map((a) => deltaE(hex, a)));
    assert(nearest >= 10, `categorical.${name} clear of brand anchors`, `dE ${nearest.toFixed(1)}`);
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log(`${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('All brand contrast rules hold.');
