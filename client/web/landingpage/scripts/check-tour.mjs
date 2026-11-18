// Walks every chapter of the seller walkthrough in a real browser and checks
// that each step's ring lands on the control the step names.
//
//   1. bun run dev            # or: bun run build && bun run preview
//   2. bun run check:tour    # add CHAPTER=11 to inspect one row
//
// Why a browser and not a unit test: the ring's position is computed from
// layout offsets inside the phone frame, so only a rendered, laid-out page can
// prove it sits on the right element. src/test/journey-targets.test.tsx covers
// the markup half (the target exists and carries data-active); this covers the
// geometry half.
//
// Uses a system Chrome via playwright-core — no browser download. It is a
// devDependency so the audit runs without a manual install.
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";

const URL = process.env.TOUR_URL ?? "http://localhost:3000/help-centre";
const ONLY = process.env.CHAPTER ? Number(process.env.CHAPTER) : null;
const CHROME =
  process.env.CHROME_PATH ??
  ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => {
    try {
      execSync(`test -x ${p}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });

if (!CHROME) {
  console.error("No Chrome found. Set CHROME_PATH to a Chrome/Chromium binary.");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 420, height: 1000 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

// Reduced motion replaces the auto-advance timer with a "Next step" button, so
// the audit walks exactly one step at a time instead of racing a timer.
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(URL, { waitUntil: "networkidle" });

const items = page.locator(".journey-item");
const count = await items.count();
if (!count) {
  console.error(`No chapters at ${URL}. Is the dev server running?`);
  process.exit(1);
}

const problems = [];
let checked = 0;

for (let i = ONLY ? ONLY - 1 : 0; ONLY ? i < ONLY : i < count; i++) {
  const item = items.nth(i);
  const trigger = item.locator(".journey-trigger");
  await trigger.scrollIntoViewIfNeeded();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
    await page.waitForTimeout(250);
  }

  const title = (await item.locator(".journey-trigger-title").innerText()).trim();
  const panel = item.locator(".journey-panel");
  const btn = panel.locator("button.btn");
  const total = Number(
    (await panel.locator(".journey-caption-step").innerText()).match(/of (\d+)/)?.[1] ?? 0,
  );

  for (let s = 1; s <= total; s++) {
    await page.waitForTimeout(120);
    const shot = await panel.evaluate((el) => {
      const stage = el.querySelector(".tour-stage");
      const ring = el.querySelector(".tour-ring");
      const callout = el.querySelector(".tour-callout");
      const target = el.querySelector('[data-tour-target][data-active="true"]');
      const caption = el.querySelector(".journey-caption")?.textContent?.trim() ?? "";
      const sb = stage?.getBoundingClientRect();
      const rb = ring?.getBoundingClientRect();
      const xb = callout?.getBoundingClientRect();
      const out = {
        caption,
        target: target?.getAttribute("data-tour-target") ?? null,
        issues: [],
      };

      if (!ring) out.issues.push("no ring");
      if (!target) out.issues.push("no data-active target");
      if (!callout) out.issues.push("no callout");

      if (sb && rb) {
        // The ring is drawn 4px outside the target, so it must never leave the
        // phone frame; one pixel of slack absorbs sub-pixel rounding.
        if (
          rb.left < sb.left - 1 ||
          rb.right > sb.right + 1 ||
          rb.top < sb.top - 1 ||
          rb.bottom > sb.bottom + 1
        ) {
          out.issues.push("ring outside phone");
        }
        if (rb.width < 12 || rb.height < 12) {
          out.issues.push(`ring tiny ${rb.width.toFixed(0)}x${rb.height.toFixed(0)}`);
        }
        if (target) {
          const tb = target.getBoundingClientRect();
          const dx = Math.abs((tb.left + tb.right) / 2 - (rb.left + rb.right) / 2);
          const dy = Math.abs((tb.top + tb.bottom) / 2 - (rb.top + rb.bottom) / 2);
          if (dx > 12 || dy > 12) {
            out.issues.push(`ring off-centre dx=${dx.toFixed(0)} dy=${dy.toFixed(0)}`);
          }
          const phone = target.closest(".tp-device, .ta-device");
          if (phone) {
            const pb = phone.getBoundingClientRect();
            if (tb.bottom < pb.top + 4 || tb.top > pb.bottom - 4) {
              out.issues.push("target scrolled out of view");
            }
          }
        }
      }

      if (sb && xb && rb) {
        if (xb.top < rb.bottom && xb.bottom > rb.top && xb.left < rb.right && xb.right > rb.left) {
          out.issues.push("callout covers ring");
        }
      }

      const actives = el.querySelectorAll('[data-tour-target][data-active="true"]').length;
      if (actives > 1) out.issues.push(`${actives} active targets`);
      return out;
    });

    checked++;
    for (const issue of shot.issues) {
      problems.push(`${i + 1}/${s} ${title} — ${issue} [${shot.target ?? "?"}] :: ${shot.caption}`);
    }

    if (s < total) {
      await btn.click();
      await page.waitForTimeout(90);
    }
  }
}

console.log(`checked ${checked} steps across ${ONLY ? 1 : count} chapter(s)`);
if (errors.length) console.log(`console errors:\n${errors.slice(0, 5).join("\n")}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  await browser.close();
  process.exit(1);
}
console.log("every ring landed on the control its step names");
await browser.close();
