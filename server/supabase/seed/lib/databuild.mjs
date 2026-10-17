/**
 * Shared @data compile step for the seed tooling.
 *
 * Compiles the root `@data/index.ts` (the mock twins) with the mobile app's tsc into a temp dir and
 * returns the loaded module so `generate.mjs` and `backfill_r2.mjs` read one identical fixture graph
 * (AGENTS.md: reuse before duplicating — no second compilation path).
 *
 * IDs are copied verbatim from @data so cache keys/CDN URLs stay stable (contract freeze,
 * docs/architecture/monolith-breakdown.md §4).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // …/seed/lib
export const seedDir = resolve(here, '..');
export const repoRoot = resolve(seedDir, '../../..');
export const buildDir = join(seedDir, '.build');
const tsc = join(repoRoot, 'client/mobile/node_modules/.bin/tsc');

/** Compile @data and return the loaded module (`d`). Exits the process on unusable output. */
export function buildData() {
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });
  const res = spawnSync(
    tsc,
    [
      join(repoRoot, 'data/index.ts'),
      '--outDir', buildDir,
      '--module', 'commonjs',
      '--target', 'es2020',
      '--moduleResolution', 'node10',
      '--ignoreDeprecations', '6.0',
      '--esModuleInterop',
      '--skipLibCheck',
      '--noEmitOnError', 'false',
    ],
    { stdio: 'inherit' },
  );
  // tsc exits non-zero on the known `__DEV__` ambient-error, but still emits. Verify output.
  globalThis.__DEV__ = false;
  const require = createRequire(import.meta.url);
  try {
    return require(join(buildDir, 'index.js'));
  } catch (err) {
    console.error('tsc produced no usable output', res.status, err);
    process.exit(1);
  }
}

/** Remove the temp build dir. Call once the caller has finished reading `d`. */
export function cleanData() {
  rmSync(buildDir, { recursive: true, force: true });
}