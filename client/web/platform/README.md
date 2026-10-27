# Faazio Partner Portal (Next.js)

The Faazio Partner Portal — seller, state-admin and super-admin consoles — on
**Next.js App Router** + React 19 + Tailwind v4 + shadcn/ui + Zustand.

This app was migrated from the Vite/TanStack Start reference in
`../vite-reference` (see `../vite-reference/MIGRATION_NEXTJS.md`). The reference
is kept for visual diffing; this is the shipping app.

## Stack

- Next.js (App Router) + React 19
- Tailwind CSS v4 via `@tailwindcss/postcss` (single `src/styles.css`)
- shadcn/ui (new-york, slate), Radix primitives
- Zustand (persisted to `localStorage` under `faazio.portal.v1`)
- TanStack Query provider, Recharts (client-only), Zod, react-hook-form, sonner

## Branding

The brand lockup has two primitives in `src/components/brand/`:

- `FaazioMark.tsx` — `FaazioMark` (the knot glyph) + `BrandTile` (the glyph on
  the brand-gradient tile). Used for the console/favicon mark.
- `FaazioWordmark.tsx` — `FaazioWordmark` (the vector letterforms, copied
  verbatim from the landing page `client/web/landingpage/src/components/faazio-logo.tsx`,
  which mirrors the mobile brand asset `client/mobile/src/assets/logo.svg`).
  Used next to `BrandTile` in the landing header (`app/page.client.tsx`), both
  console shells, and the login screen.

The favicon/PWA raster set in `public/` is generated from the canonical mobile
knot PNG (`client/mobile/src/assets/faazio-logo.png`), filled white on the same
brand-gradient tile as `BrandTile`, by `scripts/generate-brand-icons.py`
(dev-only; python3 + Pillow, no npm dep). It writes the multi-size
`favicon.ico` (16/32/48), the PNG set and the opaque `apple-touch-icon.png`.
`favicon.svg` is the shipped vector and is left untouched. The shipped
`public/favicon.ico` is now the brand `client/faazio-logo.ico` (single 32×32
frame) — re-copy it over the generated one if the script is re-run. Icons are
wired through `app/layout.tsx` `metadata.icons` with a `?v=4` cache-bust on the
ico and `?v=3` on the rest.

## Data + auth

The Zustand store seeds from `src/data/**` for local development and hydrates
from the Go gateway when `NEXT_PUBLIC_GATEWAY_URL` is set (`src/lib/api/sync.ts`).
Pages read through `src/lib/api/*`; browser data calls go through the same-origin
`/api/gateway/*` proxy. Portal auth is the only auth mode: credentials are
issued by a superadmin (`/admin/super/credentials`) and the session lives in
HttpOnly cookies, never `localStorage`. See `docs/architecture/web-portal.md`.

Sessions are kept alive GCP-style: refresh rotation is single-flight
(`refreshTokensSingleflight`), the client pre-rotates ~80% into the access
token's life and on tab focus, and `middleware.ts` guards `/seller/*` +
`/admin/*` (cookie-presence check → `/login?next=…`; a forced password rotation
carries the deep link through `sessionStorage["faazio.next"]`). The login form's
"Stay signed in" checkbox maps to the non-secret `faazio_remember` cookie — off
means the refresh cookie is browser-session-only (shared PC).

## Development

Copy `.env.example` → `.env.local` and set `NEXT_PUBLIC_GATEWAY_URL` (e.g.
`http://localhost:8080`). `NEXT_PUBLIC_*` is inlined at build time, so changing
it needs a rebuild; `scripts/check-env.mjs` (`predev`/`prebuild`) warns in dev
and fails the build when it is unset.

```sh
npm install
npm run dev        # http://localhost:3000
npm run ts:check   # tsc --noEmit
npm run build      # next build
```

If sign-in returns `503`, `GET /api/auth/portal/status` returns a one-call
verdict (portal env / gateway reachability / gateway auth) — see
`docs/RUNBOOKS/PORTAL_AUTH.md` §0.

## Routing contract

URLs are unchanged from the Vite reference. Every route is an interactive
dashboard, so each `app/**/page.tsx` is a server component that exports
`metadata` (via `pageMetadata`) and renders a `"use client"` `page.client.tsx`
sibling holding the real UI. Dynamic segments rename `$id` → `[id]` and read
params with `useParams()` from `next/navigation`.

Console shells live in `src/components/layout/**` and are wired in
`app/seller/layout.tsx`, `app/admin/state/layout.tsx` and
`app/admin/super/layout.tsx`.