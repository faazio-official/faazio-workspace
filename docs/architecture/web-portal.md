# Web Portal (Next.js) — architecture deep dive

The Faazio Partner Portal is the seller / state-admin / super-admin console. It
renders from a Zustand store that is seeded from `client/web/platform/src/data/**` and, when
`NEXT_PUBLIC_GATEWAY_URL` is set, hydrated from the Go Chi gateway
(`client/web/platform/src/lib/api/sync.ts`). **Auth is mocked by default** — the portal signs
in against the built-in demo directory even when Supabase credentials are present;
set `NEXT_PUBLIC_AUTH_MODE=supabase` to opt into GoTrue. The session persists in
`localStorage` under `faazio.portal.v1`. See "Data + auth" below.

## Locations

| Path | Role |
| --- | --- |
| `client/web/platform/` | **Shipping app** — Next.js App Router. All future portal work lands here. |
| `client/web/vite-reference/` | Original Vite + TanStack Start app, kept read-only as a visual diff baseline. `MIGRATION_NEXTJS.md` there is the hand-off contract. |
| `client/web/landingpage/` | Marketing landing page (TanStack Start + Nitro, deployed on Vercel). Separate app; see its own README/AGENTS. |

## Stack

Next.js (App Router) + React 19, Tailwind CSS v4 via `@tailwindcss/postcss`, the
same shadcn/ui (new-york, slate) components, Zustand, TanStack Query provider,
Recharts, Zod, react-hook-form, sonner, lucide-react.

## Routing contract

URLs extend the Vite reference (all 3 consoles; the MVP added 5 partner pages —
`seller/prescriptions`, `seller/bookings`, `admin/state/blood`,
`admin/state/bookings`, `admin/super/sdui`). Partner completion (`0017`) added
`seller/menus`, `admin/state/customers`, `admin/state/support`, `admin/super/rewards`
and `admin/super/users`. Seat bookings (`0020`) added `seller/bookings/settings`
(opt-in / total seats / timings / occupancy tracking / pause) and reworked
`seller/bookings` into a pending-first accept/reject/vacate queue. Every
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

Mutations write optimistically to the store first, then push the change to the
gateway through `pushWrite()` (`src/lib/api/index.ts` → `writeAwaited` in `src/lib/api/http.ts`)
when configured. Every money/status/Rx/menu/booking/rewards write is **awaited with rollback**:
on a rejected write the pre-mutation snapshot is restored and a toast surfaces the error, so a
change that did not persist can never linger on screen. (`writeBehind` remains the offline no-op
used when `NEXT_PUBLIC_GATEWAY_URL` is unset; seed mode reconciles on the next hydrate.)
Write bodies send **whole rupee** integers (the mapper divides paisa by 100).

A production build with `NEXT_PUBLIC_GATEWAY_URL` unset renders a fixed
`SEED MODE — not connected to gateway` badge (`SeedModeBanner`), so seed data can
never masquerade as live data. Dev builds stay quiet.

### Pharma quote → READY reveal (`seller/prescriptions`)

The prescriptions page is the control surface for the W24 quote workflow
(`db-schema.md` §12.12). Opening a row shows a drawer with the seller-safe header
(name only until READY), the Rx image keys resolved on demand via
`fetchPrescriptionImages` (short-lived signed URLs — the private bucket is never
public), a quote editor (name/qty/MRP/price/discount, live total), and an audit
trail. `savePrescriptionQuote` replaces the priced lines (→ `QUOTED`);
`setPrescriptionReady` is gated on ≥1 line and a positive total, matching the
server, and flips the Rx to `READY` — after which the customer's phone/address
appear under an amber "PII revealed — audited" banner and the customer is
notified. `Fulfil`/`Cancel` follow the same optimistic + write-behind path.

## Data + auth

`src/lib/config.ts` is the only module that reads env. Two integrations are
env-gated and degrade to local seed mode when unset:

- **Gateway reads** — `src/lib/api/http.ts` is the single fetch seam (bearer auth,
  query builder, error envelope, defensive snake→camel). `src/lib/api/sync.ts`
  implements `hydrateFromGateway()`: it best-effort fetches the gateway-owned
  slices (sellers, promo, ads, settlement, admins, prescriptions, bookings, blood,
  SDUI, reviews, and — partner completion — customers, menus, support tickets,
  rewards rates/ledger) and writes them into the store. Prescription rows carry
the quote lines, `quotedTotal`, reveal fields and status history; the seller
projection is name-only until `READY`/`FULFILLED`. Booking rows carry `seats`,
`fee` (rupees) and `paymentStatus`, and the queue issues accept/reject/vacate
decisions through awaited writes with rollback (`PUT /bookings/{id}/status`, `POST /bookings/{id}/vacate`).
  The `seller/bookings/settings` form is prefilled from `GET /seller/booking-config?vendorId=…`
  (`refreshBookingConfig`, best-effort; seed mode keeps the local default).
  In **development** an empty remote slice keeps the seeded rows (demo fallback); in
  **production** (`NODE_ENV=production`) an empty but successfully-fetched slice clears the local
  slice, so sellers/admins never see phantom demo rows. The gateway speaks **whole
  rupees**; the portal stores **paisa**, so the mapper multiplies by 100.
  The `admin/state/customers` page adds an on-demand **activity trail** panel per selected customer
  (`useUserTrail` → admin-only `GET /admin/user-trail?userId=`, ID-only `user_events`).
- **Auth (mocked by default)** — `src/lib/api/index.ts` `signIn` authenticates against
  the built-in demo directory (`src/data/auth/users.ts`) and never calls Supabase unless
  `NEXT_PUBLIC_AUTH_MODE=supabase`. `src/lib/supabase/auth.ts` is the dormant GoTrue REST
  seam (no `supabase-js` dependency): password sign-in, refresh, role-claim decode
  (`app_role`/`seller_id`/`state_code`, top-level or `app_metadata`). When Supabase mode is
  on, its bearer token is attached to every gateway call. In mock mode the calls carry no token
  and rely on the gateway's `AUTH_DISABLED=true` dev setting plus the **dev-only** `NEXT_PUBLIC_DEV_ROLE`
  / `NEXT_PUBLIC_DEV_SELLER` / `NEXT_PUBLIC_DEV_STATE` values (mapped to the gateway's `X-Dev-Role` /
  `X-Dev-Seller` / `X-Dev-State` headers; sent only when `NODE_ENV !== "production"`). Without a
  `DEV_ROLE` the mocked portal can read public data but role-gated routes reject it — set
  `NEXT_PUBLIC_DEV_ROLE=SUPER_ADMIN` to exercise the full control plane against the dev stack. The
  gateway CORS allow-list includes these `X-Dev-*` headers for `http://localhost:3000`.
- **Supabase Storage** — `src/lib/media/productImages.ts` stores a **Storage object
  key**, never a URL, and derives the public object URL at render (`PRODUCT_BUCKET`
  = `product-images`). `uploadProductImage()` uploads the session-authenticated
  compressed JPEG, falling back to a data URL when unconfigured.

Bootstrap (`app/providers.tsx`) restores the session then hydrates. Copy
`client/web/platform/.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_GATEWAY_URL=        # e.g. http://localhost:8080
NEXT_PUBLIC_AUTH_MODE=mock      # "mock" (default) | "supabase" (GoTrue)
NEXT_PUBLIC_SUPABASE_URL=       # Storage always; Auth only when AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEV_ROLE=           # dev-only X-Dev-Role override (e.g. SUPER_ADMIN); ignored in prod builds
NEXT_PUBLIC_DEV_SELLER=         # dev-only X-Dev-Seller (seller scope)
NEXT_PUBLIC_DEV_STATE=          # dev-only X-Dev-State (state scope)
```

## Verify

Run from `client/web/platform/`:

```bash
npm run ts:check   # tsc --noEmit
npm run build      # next build (must prerender all routes with no errors)
npm run lint       # eslint (prettier is `npm run format`, not a lint error)
```

## Deployment (Vercel)

The portal is a standard Next.js App Router app and deploys **zero-config** on
Vercel — set the project **Root Directory** to `client/web/platform`, framework
preset **Next.js**, build `next build`, and it produces the standard `.next`
output. There is no custom server and no build output API bundle.

Readiness config that ships with the app:

- **`vercel.json`** — security headers on every route (`X-Content-Type-Options`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`),
  mirroring the landing page. No rewrites/redirects/regions.
- **`package.json` `engines.node`** (`>=22.12.0`) — pins the Vercel build Node
  runtime (matches `client/web/landingpage`).
- **`public/robots.txt`** — `Disallow: /`; the console is private and every route
  also carries `metadata.robots: { index: false, follow: false }`.
- **`public/favicon.*`** + `app/layout.tsx` `metadata.icons` — the Faazio mark
  (same assets as the landing page), plus `viewport.themeColor` (`#1162D3`).

No secrets are baked into the build: `NEXT_PUBLIC_*` values are read at build
time, so a demo deployment that leaves them unset renders in seed mode and
shows the `SEED MODE — not connected to gateway` badge. Set them in the Vercel
project's Environment Variables for a live deployment.