#!/usr/bin/env node
/**
 * ci-build.mjs — one entry point for "build the <app> APK as debug|prod in CI".
 *
 * This machine never runs Gradle (systemd-oomd SIGKILLs it — see
 * docs/RUNBOOKS/TROUBLESHOOTING.md). Both build types are therefore dispatched to GitHub Actions:
 *
 *   debug -> .github/workflows/android-debug.yml   (assemble<App>Debug, Metro shell)
 *   prod  -> .github/workflows/release-apk.yml     (assemble<App>Release, signed release)
 *
 * Each workflow sets BUILD_VARIANT to match the Gradle build type it runs, so the generated
 * src/lib/config.ts (transport + BUILD_VARIANT) always agrees with the shell being produced.
 *
 * Usage:
 *   node scripts/ci-build.mjs --app=delivery --build=debug
 *   node scripts/ci-build.mjs --app=delivery --build=prod --version=1.0.1 --include-aab
 *   node scripts/ci-build.mjs --app=customer --build=prod --dry-run     # print the gh command only
 *   node scripts/ci-build.mjs --app=seller --build=debug --watch        # dispatch, then gh run watch
 *
 * Flags:
 *   --app=customer|delivery|seller   (required)
 *   --build=debug|prod               (required)
 *   --dry-run                        print the command instead of running it
 *   --watch                          run `gh run watch` after dispatching
 *   prod only: --version, --version-code, --tag, --prerelease, --include-aab
 *
 * Nothing here is secret; the workflows read the keystore/Firebase secrets from the repo.
 */
import { spawnSync } from 'node:child_process';

const APPS = new Set(['customer', 'delivery', 'seller']);
const BUILDS = new Set(['debug', 'prod']);
const PROD_FLAGS = new Set(['version', 'version-code', 'tag', 'prerelease', 'include-aab']);

function usage(message) {
  if (message) console.error(`[ci-build] ERROR: ${message}`);
  console.error(
    'usage: node scripts/ci-build.mjs --app=<customer|delivery|seller> --build=<debug|prod> ' +
      '[--dry-run] [--watch] [--version=1.0.1] [--version-code=N] [--tag=v1.0.1] ' +
      '[--prerelease] [--include-aab]',
  );
  process.exit(1);
}

const opts = { watch: false, dryRun: false, inputs: {} };
for (const arg of process.argv.slice(2)) {
  const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
  if (!match) usage(`unrecognised argument '${arg}'`);
  const [, key, value] = match;
  if (key === 'dry-run') opts.dryRun = true;
  else if (key === 'watch') opts.watch = true;
  else if (key === 'prerelease' || key === 'include-aab') opts.inputs[key] = 'true';
  else if (key === 'app' || key === 'build') {
    if (value === undefined || value === '') usage(`--${key} needs a value`);
    opts[key] = value;
  } else if (PROD_FLAGS.has(key)) {
    if (value === undefined || value === '') usage(`--${key} needs a value`);
    opts.inputs[key] = value;
  } else usage(`unrecognised flag '--${key}'`);
}

const app = opts.app;
const build = opts.build;
if (!APPS.has(app)) usage(`--app must be one of customer|delivery|seller (got '${app ?? ''}')`);
if (!BUILDS.has(build)) usage(`--build must be debug|prod (got '${build ?? ''}')`);

const releaseInputs = Object.entries(opts.inputs);
if (build === 'debug' && releaseInputs.length > 0) {
  usage(`release inputs (${releaseInputs.map(([k]) => `--${k}`).join(', ')}) are prod-only`);
}

const workflow = build === 'debug' ? 'android-debug.yml' : 'release-apk.yml';
const args = ['workflow', 'run', workflow, '-f', `app=${app}`];
for (const [key, value] of releaseInputs) args.push('-f', `${key}=${value}`);

const printable = `gh ${args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`;
console.log(`[ci-build] ${app} ${build} -> ${workflow}`);
console.log(`[ci-build] ${printable}`);

if (opts.dryRun) process.exit(0);

const run = spawnSync('gh', args, { stdio: 'inherit' });
if (run.error) {
  console.error(
    `[ci-build] failed to run gh (${run.error.message}). Install the GitHub CLI and run ` +
      `'gh auth status', or run the printed command by hand.`,
  );
  process.exit(1);
}
if (run.status !== 0) process.exit(run.status ?? 1);

if (opts.watch) {
  const watch = spawnSync('gh', ['run', 'watch'], { stdio: 'inherit' });
  process.exit(watch.status ?? 1);
}
console.log('[ci-build] dispatched — follow it with: gh run watch');
