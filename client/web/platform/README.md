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

The Faazio knot glyph lives in `src/components/brand/FaazioMark.tsx`
(`FaazioMark` + the gradient `BrandTile`) and is used by both console shells and
the login screen. The favicon/PWA icon set in `public/` is generated from that
same glyph (contours from `client/mobile/src/assets/logo.svg`) and wired through
`app/layout.tsx` `metadata.icons` + `metadata.manifest`.

## Data

All app data is mock data seeded from `src/data/**` into the Zustand store and
persisted to `localStorage`. Pages read through `src/lib/api/*`; there is no
backend and no server-side data fetching.

## Development

```sh
npm install
npm run dev        # http://localhost:3000
npm run ts:check   # tsc --noEmit
npm run build      # next build
```

## Routing contract

URLs are unchanged from the Vite reference. Every route is an interactive
dashboard, so each `app/**/page.tsx` is a server component that exports
`metadata` (via `pageMetadata`) and renders a `"use client"` `page.client.tsx`
sibling holding the real UI. Dynamic segments rename `$id` → `[id]` and read
params with `useParams()` from `next/navigation`.

Console shells live in `src/components/layout/**` and are wired in
`app/seller/layout.tsx`, `app/admin/state/layout.tsx` and
`app/admin/super/layout.tsx`.