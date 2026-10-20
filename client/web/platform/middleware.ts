import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge auth guard (P3.3): deep-linking a seller/admin directly to /seller/* or /admin/* with no
 * refresh cookie must land on /login with a ?next= back-link instead of a blank shell. Presence of
 * the cookie is all an edge can know (it can't verify HS256 without the secret) — real validity is
 * checked by /api/auth/portal/me + /api/gateway, whose transient/terminal handling decides whether
 * to keep or clear the session. Reads both the legacy name and the future __Host- name so this
 * keeps working across the P2 cookie rename.
 */
const REFRESH_COOKIE_NAMES = ["faazio_prt", "__Host-faazio_prt"];

export function middleware(req: NextRequest) {
  const hasRefresh = REFRESH_COOKIE_NAMES.some((name) => req.cookies.get(name)?.value);
  if (!hasRefresh) {
    const url = req.nextUrl.clone();
    const next = url.pathname + url.search;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Contracts, API routes, static assets and the /login + /security pages are exempt — the shell's
  // RoleGate and the gateway proxy own gating there.
  matcher: ["/seller/:path*", "/admin/:path*"],
};