#!/usr/bin/env bash
#
# Home feed performance baseline harness (Phase 0).
# Measures a release build so dev-mode (Metro) noise doesn't hide regressions.
#
# Usage:
#   npx expo run:android --variant release        # first, on a device/emulator
#   bash scripts/perf-baseline.sh                 # then run this
#
# Outputs (record these before/after any perf change):
#   1. Cold start → interactive Home  (stopwatch)
#   2. dumpsys gfxinfo jank (after a scripted fling) — Janky frames %, 95th %ile frame time
#   3. Note: FilterFeedSection re-render count is read from React DevTools Profiler, not CLI.
set -euo pipefail

PKG="com.faazio.customer"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> 1/2 Cold start → interactive (start app, stopwatch until Home is tappable)"
adb shell am force-stop "$PKG"
echo "   App stopped. Launch it manually and time from icon tap to interactive Home."

echo
echo "==> 2/2 Scroll jank (after a 10-swipe fling through the collapse zone + to feed bottom)"
adb shell am start -n "$PKG/.MainActivity" >/dev/null 2>&1 || true
sleep 3
# Fling the home feed: swipe up (scroll down) through the header collapse + to the bottom.
for _ in $(seq 1 10); do
  adb shell input swipe 540 1600 540 400 90
done
sleep 1
# Reset to top.
adb shell input swipe 540 400 540 1600 60

echo
echo "==> gfxinfo summary"
adb shell dumpsys gfxinfo "$PKG" reset >/dev/null 2>&1 || true
# Flings again so the frame stats capture real scrolling.
for _ in $(seq 1 10); do
  adb shell input swipe 540 1600 540 400 90
done
sleep 2
adb shell dumpsys gfxinfo "$PKG" | grep -E "Janky frames|Total frames|95th percentile" || \
  echo "   (gfxinfo unavailable — confirm a release build is installed)"

echo
echo "==> React DevTools: profile a Home scroll; FilterFeedSection re-render count should be 0"
echo "   (pure scroll only — chip-switch / add-feedback legitimately re-render it)"
