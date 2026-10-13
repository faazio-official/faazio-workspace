# Web Portal (Next.js) — architecture deep dive

The Faazio Partner Portal is the seller / state-admin / super-admin console. It
renders from a Zustand store that is seeded from `client/web/src/data/**` and, when
`NEXT_PUBLIC_GATEWAY_URL` is set, hydrated from the Go Chi gateway
(`client/web/src/lib/api/sync.ts`). Auth is Supabase (GoTrue) when configured; with
no env it runs in **local seed mode** (demo login + `localStorage` under
`faazio.portal.v1`). See "Data + auth" below.

## Locations

| Path | Role |
| --- | --- |
| `client/web/` | **Shipping app** — Next.js App Router. All future portal work lands here. |
| `client/vite-reference/` | Original Vite + TanStack Start app, kept read-only as a visual diff baseline. `MIGRATION_NEXTJS.md` there is the hand-off contract. |

## Stack

Next.js (App Router) + React 19, Tailwind CSS v4 via `@tailwindcss/postcss`, the
same shadcn/ui (new-york, slate) components, Zustand, TanStack Query provider,
Recharts, Zod, react-hook-form, sonner, lucide-react.

## Routing contract

URLs extend the Vite reference (all 3 consoles; the MVP added 5 partner pages —
`seller/prescriptions`, `seller/bookings`, `admin/state/blood`,
`admin/state/bookings`, `admin/super/sdui`). Every
route is an interactive dashboard, so each route is split:

- `app/**/page.tsx` — **server** component. Exports `metadata` (from
  `pageMetadata()` in `src/lib/seo.ts`) and renders the client sibling.
- `app/**/page.client.tsx` — `"use client"` component holding the real UI, a
  byte-for-byte copy of the old route component with the TanStack wrapper removed.

Dynamic segments rename `$id` → `[id]` and read params via `useParams()` from
`next/navigation`. `__root.tsx` becomes `app/layout.tsx` (html/body + root
metadata + `src/styles.css`) plus `app/providers.tsx`
(QueryClientProvider + TooltipProvider + Toaster). `notFoundComponent` /
`errorComponent` become `app/not-found.tsx` / `app/error.tsx`.

## Migration decisions (the "ditto UI" fixes)

1. **Images stay plain `<img>`.** Vite resolves image imports to a URL string;
   Next resolves them to `{ src, width, height }`. `src/lib/media/productImages.ts`
   normalises every import through `toUrl()` so seeded product photos keep
   working. `next/image` is deliberately not used (`images.unoptimized: true`).
2. **One stylesheet, one location.** `src/styles.css` stays put (Tailwind v4
   `@theme` + tokens + utilities) and is imported from `app/layout.tsx`. It
   declares `@source "../src"` **and** `@source "../app"` so utilities used in
   `app/**` are scanned. Tailwind runs through `@tailwindcss/postcss`
   (`postcss.config.mjs`); the Vite plugin is gone.
3. **Hydration.** The Zustand store keeps its SSR-safe storage shim. A local
   `src/lib/hooks/useHydrated.ts` replaces the TanStack hook; shells and
   `RoleGate` render skeletons until hydrated, so no empty flash.
4. **Charts are client-only.** `src/components/patterns/Charts.tsx` exports
   `next/dynamic(..., { ssr: false })` wrappers around `ChartsImpl.tsx` so
   Recharts never runs during `next build` prerender; pages import the same
   named exports unchanged.
5. **Router API swap.** `Link to=` → `next/link` `href=`, `useNavigate()` →
   `useRouter().push()`, `useRouterState(pathname)` → `usePathname()`, in the
   shells (`SellerShell`, `AdminShell`), `RoleGate` and `PageHeader` only.
   Active-nav highlighting is computed manually (`pathname === item.to` /
   `startsWith(item.to + "/")`).

## Data ownership

The portal reads records from `src/data/**` through `src/lib/api/*`
(`hooks.ts` reactive reads, `index.ts` mutations). Pages never import
`src/data/**` directly. This is the same seam as the mobile `GatewayClient`.

## Data + auth

`src/lib/config.ts` is the only module that reads env. Two integrations are
env-gated and degrade to local seed mode when unset:

- **Gateway reads** — `src/lib/api/http.ts` is the single fetch seam (bearer auth,
  query builder, error envelope, defensive snake→camel). `src/lib/api/sync.ts`
  implements `hydrateFromGateway()`: it best-effort fetches the gateway-owned
  slices (sellers, promo, ads, settlement, admins, prescriptions, bookings, blood,
  SDUI, reviews) and writes them into the store. The gateway speaks **whole
  rupees**; the portal stores **paisa**, so the mapper multiplies by 100.
- **Supabase Auth** — `src/lib/supabase/auth.ts` is a minimal GoTrue REST client
  (no `supabase-js` dependency) that signs in with password, refreshes, and decodes
  role claims (`app_role`/`seller_id`/`state_code`, top-level or `app_metadata`).
  The bearer token is attached to every gateway call.
- **Supabase Storage** — `src/lib/media/productImages.ts` stores a **Storage object
  key**, never a URL, and derives the public object URL at render (`PRODUCT_BUCKET`
  = `product-images`). `uploadProductImage()` uploads the session-authenticated
  compressed JPEG, falling back to a data URL when unconfigured.

Bootstrap (`app/providers.tsx`) restores the session then hydrates. Copy
`client/web/.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_GATEWAY_URL=        # e.g. http://localhost:8080
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Verify

Run from `client/web/`:

```bash
npm run ts:check   # tsc --noEmit
npm run build      # next build (must prerender all routes with no errors)
npm run lint       # eslint (prettier is `npm run format`, not a lint error)
```