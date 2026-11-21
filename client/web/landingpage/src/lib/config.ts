/**
 * Landing-page environment — the only module that reads env, so app code stays portable.
 *
 * Mirrors `client/web/platform/src/lib/config.ts` (the Partner Portal): one gateway origin, read on
 * the server, with a hard default so the site works with no configuration at all.
 *
 * Two different env conventions meet here because the two runtimes differ:
 *   - `GATEWAY_URL`         server-only, read at request time by the lead server function.
 *   - `VITE_GATEWAY_URL`    build-time fallback for local dev (Vite inlines `VITE_*`).
 *   - `VITE_GOOGLE_MAPS_API_KEY` build-time, public (referrer-restricted) — browser only.
 *
 * No secret belongs here. The landing page never authenticates: the enquiry route is public and the
 * admin queue is the portal's job, so there is no token, cookie or credential to configure.
 */

/** Production gateway, behind Cloudflare. */
export const DEFAULT_GATEWAY_URL = "https://api.faazio.com";

/** Trim a value and drop a trailing slash so `${base}/path` never doubles up. */
function origin(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

/**
 * Gateway origin the lead server function posts to.
 *
 * Resolved at call time (not module load) so a server process can set `GATEWAY_URL` without a
 * rebuild, and so a local `VITE_GATEWAY_URL` still works. Falls back to production — a missing env
 * var must never silently disable seller intake.
 */
export function gatewayUrl(): string {
  if (typeof process !== "undefined" && process.env) {
    const server = origin(process.env["GATEWAY_URL"]);
    if (server) return server;
  }
  const build = origin((import.meta.env as Record<string, string | undefined>)["VITE_GATEWAY_URL"]);
  return build || DEFAULT_GATEWAY_URL;
}

/**
 * Public Google Maps JS key (Maps JS + Places), restricted by HTTP referrer in the Cloudflare/Google
 * console. Absent → the map panel is not rendered and the enquiry submits no pin.
 */
export function mapsKey(): string | undefined {
  const key = (import.meta.env as Record<string, string | undefined>)["VITE_GOOGLE_MAPS_API_KEY"];
  const trimmed = (key ?? "").trim();
  return trimmed === "" ? undefined : trimmed;
}
