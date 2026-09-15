#!/usr/bin/env bash
#
# configure-release-signing.sh
#
# Wires the Android `release` build type to the release keystore by editing
# `android/app/build.gradle` in place. This runs in CI AFTER `expo prebuild
# --clean` regenerates the gitignored `android/` dir (which wipes any manual
# signing edits), so it re-applies the signing config deterministically.
#
# It reads `keystore/keystore.properties` (restored from GitHub secrets by
# restore-keystore.sh) and injects:
#   - a `release` signingConfig keyed off those properties
#   - `signingConfig signingConfigs.release` on the `release` build type
#
# Note: this wiring matters — without it the generated `release` buildType
# defaults to the DEBUG keystore, producing a different signing cert. Anyone
# who previously installed a debug-signed build could then no longer update
# (signature conflict → "App not installed"). See plugins/with-release-signing.js,
# the version-controlled equivalent applied during prebuild.
#
# Usage:  scripts/configure-release-signing.sh
# Run from:  client/mobile/  (the Expo project root)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRADLE_APP="$ROOT/android/app/build.gradle"
PROPS="$ROOT/keystore/keystore.properties"

if [[ ! -f "$GRADLE_APP" ]]; then
  echo "[configure-release-signing] ERROR: $GRADLE_APP not found. Run 'expo prebuild --clean' first." >&2
  exit 1
fi

if [[ ! -f "$PROPS" ]]; then
  echo "[configure-release-signing] ERROR: $PROPS not found. Run restore-keystore.sh first." >&2
  exit 1
fi

# Source the properties file (STORE_FILE, KEYSTORE_PASS, KEY_ALIAS, ALIAS_PASS)
set -a
# shellcheck disable=SC1090
source "$PROPS"
set +a

: "${STORE_FILE:?keystore.properties missing STORE_FILE}"
: "${KEYSTORE_PASS:?keystore.properties missing KEYSTORE_PASS}"
: "${KEY_ALIAS:?keystore.properties missing KEY_ALIAS}"
: "${ALIAS_PASS:?keystore.properties missing ALIAS_PASS}"

# Resolve STORE_FILE to an absolute path relative to the android/ dir.
# keystore.properties normally holds a relative path from android/app/.
STORE_ABS="$ROOT/keystore/$(basename "$STORE_FILE")"
if [[ ! -f "$STORE_ABS" ]]; then
  echo "[configure-release-signing] ERROR: keystore not found at $STORE_ABS" >&2
  exit 1
fi

# 1. Add a `release` signingConfig block (if not already present).
if grep -q 'signingConfigs.release' "$GRADLE_APP"; then
  echo "[configure-release-signing] release signingConfig already present; skipping injection."
else
  python3 - "$GRADLE_APP" "$STORE_ABS" "$KEYSTORE_PASS" "$KEY_ALIAS" "$ALIAS_PASS" <<'PY'
import re
import sys

path, store_abs, store_pass, key_alias, alias_pass = sys.argv[1:]
with open(path, "r") as f:
    src = f.read()

# Escape for use inside a double-quoted Groovy string.
def esc(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"')

release_block = (
    "\n        release {\n"
    f"            storeFile file('{store_abs}')\n"
    f"            storePassword \"{esc(store_pass)}\"\n"
    f"            keyAlias \"{esc(key_alias)}\"\n"
    f"            keyPassword \"{esc(alias_pass)}\"\n"
    "        }\n"
)

# Insert the release signingConfig right after the debug one's closing brace.
pattern = re.compile(r"(\s*debug \{[^}]*?\}\n)")
m = pattern.search(src)
if not m:
    print("[configure-release-signing] ERROR: could not locate debug signingConfig", file=sys.stderr)
    sys.exit(1)
idx = m.end()
src = src[:idx] + release_block + src[idx:]

# 2. Point the `release` build type at the release signingConfig, leaving the
#    `debug` build type untouched. Match the release block then swap its
#    signingConfig line.
release_m = re.search(
    r"buildTypes \{\s*\n\s*debug \{[^}]*\}\s*\n\s*release \{", src
)
if not release_m:
    print("[configure-release-signing] ERROR: could not locate release buildType", file=sys.stderr)
    sys.exit(1)
# Only replace the first signingConfig line AFTER the release block start.
rel_start = release_m.end()
head, tail = src[:rel_start], src[rel_start:]
tail, n = re.subn(
    r"signingConfig signingConfigs\.debug",
    "signingConfig signingConfigs.release",
    tail,
    count=1,
)
if n != 1:
    print("[configure-release-signing] ERROR: could not swap release signingConfig", file=sys.stderr)
    sys.exit(1)
src = head + tail

with open(path, "w") as f:
    f.write(src)
print("[configure-release-signing] injected release signingConfig.")
PY
fi

echo "[configure-release-signing] done."
