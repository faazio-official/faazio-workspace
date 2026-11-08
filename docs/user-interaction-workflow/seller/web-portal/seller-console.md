# Seller console + portal auth

**App / route:** `client/web/platform` · `/login` → role home (`/seller`, `/admin/district`,
`/admin/super`)
**Status:** Partial (auth shell shipped; fake latency and local-only surfaces remain)
**Trigger:** Browser login, seller app WebView, or a session restore on page load.

## Steps

1. `middleware.ts` checks for the refresh cookie (`faazio_prt` / `__Host-faazio_prt`) on
   `/seller/*` and `/admin/*`; absent → redirect to `/login?next=…`.
2. `/login` calls `signIn` → `POST /api/auth/portal/login` → gateway `POST /auth/portal/login`.
3. The gateway verifies credentials (`admins.portal_users`) and mints a portal HS256 JWT
   (`iss=faazio-portal`, `aud=portal`) + rotating refresh session.
4. `setAuthCookies` stores `faazio_pat` (15 min) and `faazio_prt` (30 d) as HttpOnly cookies.
5. `providers.tsx` calls `restoreSession` on mount; `armProactiveRefresh` /
   `armVisibilityRefresh` keep the session fresh. `refreshTokensSingleflight` dedupes concurrent
   refreshes.
6. `RoleGate` + `src/lib/auth/permissions.ts` route the role to its home:
   `homeFor()` → `/seller`, `/admin/district`, or `/admin/super`.
7. Seller console pages read/write via `src/lib/api/*` → `/api/gateway/[...path]` (the proxy
   forwards cookies and retries once after rotation).
8. Logout calls `POST /api/auth/portal/logout` and clears cookies.

## State

- `usePortalStore` (client store) + HttpOnly cookies (tokens never exposed to JS).
- `src/lib/portal/auth.ts` — login/restore/refresh/logout/password.
- `src/lib/portal/server.ts` — cookie contract and refresh singleflight.

## Data path

- `POST /auth/portal/login|refresh|logout`, `GET /auth/portal/me`, `PUT /auth/portal/password` →
  `admins.portal_users`, `admins.portal_sessions`.
- All console reads/writes → gateway endpoints listed in the seller/catalog/orders docs.
- No bundled demo rows; a disconnected gateway yields an empty state, not fixtures.

## Success / error / empty

- **Success:** role home renders live data.
- **Error:** `not_configured` / `gateway_unreachable` / `portal_auth_unavailable` diagnostics on the
  login page; 401 bounces to login.
- **Empty:** honest empty states.

## Known gaps

- `useMockLoading` adds 320 ms fake latency on 37 files under `app/` (plus the hook definition in
  `src/lib/api/hooks.ts`); must be removed per the no-mocks rule.
- Local-only seller surfaces: `notifications` (`INITIAL` list), `support` (local tickets),
  `hub` checklist, `restaurant-status`, `rush-hour` (client-only zustand store), and the
  "Simulate scan" toast.
- Toast-only admin actions: district `content` publish, `orders` escalate, `pricing-audit` contact,
  super `settings` save.
- `/admin/super/district-admins` is hardcoded to TTC.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/web-portal.md`
- `docs/RUNBOOKS/PORTAL_AUTH.md`
- `docs/architecture/monolith-breakdown.md` (portal auth row)
