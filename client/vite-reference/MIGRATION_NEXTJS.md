# Faazio Partner Portal — Vite/TanStack Start → Next.js Migration Contract

This is the authoritative hand-off document for an LLM (or human) performing the
migration. **The user must not notice any difference.** Same URLs, same data,
same copy, same colours, same hover help, same behaviour. Only the framework
underneath changes.

Current stack: React 19 + Vite 8 + TanStack Start/Router v1 + Tailwind v4 +
shadcn/ui (new-york, slate) + Zustand (localStorage persist) + TanStack Query +
Recharts + Zod + react-hook-form + sonner + lucide-react.

Target stack: Next.js (App Router) + React 19 + Tailwind v4 + the same shadcn/ui
components, Zustand, TanStack Query, Recharts, Zod, react-hook-form, sonner,
lucide-react.

---

## 0. Golden rules

1. **No behavioural drift.** Every page must render the same content, in the
   same order, with the same labels, tone colours and "i" hover help.
2. **Do not touch these directories' contents** except for import-path fixes:
   `src/data/**`, `src/lib/**`, `src/components/patterns/**`,
   `src/components/ui/**`, `src/styles.css`. All of it is framework-agnostic
   React/TS and must survive the migration byte-for-byte where possible.
3. **All app data is mock data.** No backend, no fetch, no server DB. Everything
   is seeded from `src/data/**` into a Zustand store persisted to
   `localStorage` under the key from `src/lib/config.ts` (`faazio.portal.v1`).
   Do not "improve" this into server-side data during the migration.
4. **Client-first.** The portal is an authenticated dashboard; there is no SEO
   requirement (routes emit `robots: noindex`). Every interactive page is a
   Client Component. Do not attempt RSC data fetching.
5. **One concern per commit/step.** Follow the phase order in §6. Typecheck
   after each phase.

---

## 1. Route inventory (URL contract — must not change)

| Current file (`src/routes/`) | URL | Next.js file (`app/`) |
| --- | --- | --- |
| `__root.tsx` | shell | `app/layout.tsx` + `app/providers.tsx` |
| `index.tsx` | `/` | `app/page.tsx` |
| `login.tsx` | `/login` | `app/login/page.tsx` |
| `seller/route.tsx` | layout | `app/seller/layout.tsx` |
| `seller/index.tsx` | `/seller` | `app/seller/page.tsx` |
| `seller/onboarding.tsx` | `/seller/onboarding` | `app/seller/onboarding/page.tsx` |
| `seller/products/index.tsx` | `/seller/products` | `app/seller/products/page.tsx` |
| `seller/products/new.tsx` | `/seller/products/new` | `app/seller/products/new/page.tsx` |
| `seller/products/$id/edit.tsx` | `/seller/products/:id/edit` | `app/seller/products/[id]/edit/page.tsx` |
| `seller/pricing.tsx` | `/seller/pricing` | `app/seller/pricing/page.tsx` |
| `seller/inventory.tsx` | `/seller/inventory` | `app/seller/inventory/page.tsx` |
| `seller/orders/index.tsx` | `/seller/orders` | `app/seller/orders/page.tsx` |
| `seller/orders/$id.tsx` | `/seller/orders/:id` | `app/seller/orders/[id]/page.tsx` |
| `seller/returns.tsx` | `/seller/returns` | `app/seller/returns/page.tsx` |
| `seller/payments.tsx` | `/seller/payments` | `app/seller/payments/page.tsx` |
| `seller/promotions.tsx` | `/seller/promotions` | `app/seller/promotions/page.tsx` |
| `seller/ads.tsx` | `/seller/ads` | `app/seller/ads/page.tsx` |
| `seller/stores.tsx` | `/seller/stores` | `app/seller/stores/page.tsx` |
| `seller/analytics.tsx` | `/seller/analytics` | `app/seller/analytics/page.tsx` |
| `seller/reviews.tsx` | `/seller/reviews` | `app/seller/reviews/page.tsx` |
| `seller/settings.tsx` | `/seller/settings` | `app/seller/settings/page.tsx` |
| `seller/support.tsx` | `/seller/support` | `app/seller/support/page.tsx` |
| `admin/state/route.tsx` | layout | `app/admin/state/layout.tsx` |
| `admin/state/index.tsx` | `/admin/state` | `app/admin/state/page.tsx` |
| `admin/state/sellers/index.tsx` | `/admin/state/sellers` | `app/admin/state/sellers/page.tsx` |
| `admin/state/sellers/$id.tsx` | `/admin/state/sellers/:id` | `app/admin/state/sellers/[id]/page.tsx` |
| `admin/state/products/index.tsx` | `/admin/state/products` | `app/admin/state/products/page.tsx` |
| `admin/state/products/queue.tsx` | `/admin/state/products/queue` | `app/admin/state/products/queue/page.tsx` |
| `admin/state/pricing-audit.tsx` | `/admin/state/pricing-audit` | `app/admin/state/pricing-audit/page.tsx` |
| `admin/state/festival.tsx` | `/admin/state/festival` | `app/admin/state/festival/page.tsx` |
| `admin/state/content.tsx` | `/admin/state/content` | `app/admin/state/content/page.tsx` |
| `admin/state/coupons.tsx` | `/admin/state/coupons` | `app/admin/state/coupons/page.tsx` |
| `admin/state/orders.tsx` | `/admin/state/orders` | `app/admin/state/orders/page.tsx` |
| `admin/state/analytics.tsx` | `/admin/state/analytics` | `app/admin/state/analytics/page.tsx` |
| `admin/state/audit.tsx` | `/admin/state/audit` | `app/admin/state/audit/page.tsx` |
| `admin/super/route.tsx` | layout | `app/admin/super/layout.tsx` |
| `admin/super/index.tsx` | `/admin/super` | `app/admin/super/page.tsx` |
| `admin/super/state-admins.tsx` | `/admin/super/state-admins` | `app/admin/super/state-admins/page.tsx` |
| `admin/super/states.tsx` | `/admin/super/states` | `app/admin/super/states/page.tsx` |
| `admin/super/sellers.tsx` | `/admin/super/sellers` | `app/admin/super/sellers/page.tsx` |
| `admin/super/products.tsx` | `/admin/super/products` | `app/admin/super/products/page.tsx` |
| `admin/super/festival.tsx` | `/admin/super/festival` | `app/admin/super/festival/page.tsx` |
| `admin/super/sectors.tsx` | `/admin/super/sectors` | `app/admin/super/sectors/page.tsx` |
| `admin/super/coupons.tsx` | `/admin/super/coupons` | `app/admin/super/coupons/page.tsx` |
| `admin/super/ads.tsx` | `/admin/super/ads` | `app/admin/super/ads/page.tsx` |
| `admin/super/settings.tsx` | `/admin/super/settings` | `app/admin/super/settings/page.tsx` |
| `admin/super/analytics.tsx` | `/admin/super/analytics` | `app/admin/super/analytics/page.tsx` |
| `admin/super/audit.tsx` | `/admin/super/audit` | `app/admin/super/audit/page.tsx` |
| `admin/super/coverage.tsx` | `/admin/super/coverage` | `app/admin/super/coverage/page.tsx` |

Also required: `app/not-found.tsx` (port the 404 markup from `__root.tsx`) and
`app/error.tsx` (port the error markup, `"use client"`, `reset` prop).

---

## 2. Mechanical API mapping

| TanStack Start / Router | Next.js App Router |
| --- | --- |
| `createFileRoute("/x")({ component })` | default-exported component in `app/x/page.tsx` |
| `createFileRoute(...)({ head: () => pageMeta(...) })` | `export const metadata` (see §3) |
| `Outlet` in `route.tsx` | `children` prop in `layout.tsx` |
| `Link` from `@tanstack/react-router` with `to=` | `Link` from `next/link` with `href=` |
| `activeProps` / `activeOptions` on `Link` | compare `usePathname()` and apply classes manually (already the pattern in the shells) |
| `useRouter().navigate({ to })` | `useRouter().push()` from `next/navigation` |
| `useRouter().invalidate()` | delete — store is client state, no cache to bust |
| `Route.useParams()` | `useParams()` from `next/navigation` (values are `string \| string[]`; narrow with `String(params.id)`) |
| `useLocation().pathname` | `usePathname()` from `next/navigation` |
| `useSearch()` | `useSearchParams()` |
| `useHydrated()` from `@tanstack/react-router` | local `useHydrated()` hook (see §4) |
| `createRootRouteWithContext` + `QueryClientProvider` | `app/providers.tsx` client component |
| `redirect({ to })` in route guards | `redirect()` from `next/navigation`, or client-side `router.replace()` inside the gate |
| `?url` CSS import (`appCss`) | `import "@/styles.css"` in `app/layout.tsx` |
| `import.meta.env.VITE_*` | `process.env.NEXT_PUBLIC_*` |
| image imports from `src/assets/**` | same static imports; render with plain `<img src={img.src} />` or `next/image` — pick ONE and keep `ProductThumb` the only place that decides |

Dynamic-segment rename: `$id` → `[id]`. Splats `$` → `[...slug]` (none used today).

---

## 3. Metadata

`src/lib/seo.ts` currently returns a TanStack `head()` object. Add a sibling
helper instead of deleting it:

```ts
// src/lib/seo.ts
import type { Metadata } from "next";

export function pageMetadata(title: string, description: string): Metadata {
  const fullTitle = `${title} — Faazio Partner Portal`;
  return {
    title: fullTitle,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: fullTitle, description },
  };
}
```

Each `page.tsx` keeps its own unique title/description — copy the exact strings
from the current route's `head()`. Since pages are `"use client"`, put
`export const metadata` in the `page.tsx` only if it stays a server file;
otherwise split: `page.tsx` (server, exports `metadata`, renders `<PageClient />`)
and `page.client.tsx` (`"use client"`, the real UI). **Use this split for every
route** — it preserves per-page titles without turning the tree into RSC work.

---

## 4. Hydration and localStorage (highest-risk area)

The Zustand store persists to `localStorage`. Next.js prerenders every page at
build time, so the first render has no store data. Rules:

- Keep the SSR-safe storage shim already present in `src/lib/api/store.ts`
  (returns nulls when `typeof window === "undefined"`) — do not delete it.
- Add `src/lib/hooks/useHydrated.ts`:

  ```ts
  "use client";
  import { useEffect, useState } from "react";
  export function useHydrated() {
    const [h, setH] = useState(false);
    useEffect(() => setH(true), []);
    return h;
  }
  ```

  and point `RoleGate` and any other consumer at it instead of the TanStack one.
- Never read `localStorage` in a `useState` initializer or during render.
- Anything session-dependent (shells, gates, dashboards) renders its skeleton
  until `useHydrated()` is true. `RoleGate` already does this — preserve it.

---

## 5. Config files

- Delete `vite.config.ts`, `src/router.tsx`, `src/routeTree.gen.ts`,
  `src/server.ts`, `src/start.ts`, `src/lib/error-capture.ts`,
  `src/lib/error-page.ts`, `src/lib/lovable-error-reporting.ts`
  (the last three are Lovable/Vite-specific; drop their imports too).
- Remove deps: `@tanstack/react-router`, `@tanstack/react-start`,
  `@tanstack/router-plugin`, `@tailwindcss/vite`, `vite`, `vite-tsconfig-paths`,
  `@vitejs/plugin-react`, `nitro`, `@lovable.dev/vite-tanstack-config`.
- Add: `next`, `@tailwindcss/postcss`, `postcss`.
- `postcss.config.mjs`: `export default { plugins: { "@tailwindcss/postcss": {} } };`
- Scripts: `dev: next dev`, `build: next build`, `start: next start`,
  `lint: eslint .`.
- `tsconfig.json`: keep `paths` (`@/*` → `./src/*`), `strict`, and the strict
  extras (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) — the code
  depends on them. Add `"plugins": [{ "name": "next" }]`, `"jsx": "preserve"`,
  `"moduleResolution": "Bundler"`, include `next-env.d.ts` and `app/**/*`.
- Fonts/stylesheets currently loaded via `<link>` in `__root.tsx` move to
  `app/layout.tsx` head or `next/font`.
- `src/styles.css` stays as-is (Tailwind v4 `@theme`, tone tokens, `wash`,
  `rail`, `gradient-brand`, `focus-ringed`). Do not restructure it.

---

## 6. Phase order

1. **Scaffold** — add Next deps, `postcss.config.mjs`, `next.config.ts`,
   `app/layout.tsx` + `app/providers.tsx` (QueryClientProvider, TooltipProvider,
   `<Toaster position="top-right" />`), `app/not-found.tsx`, `app/error.tsx`.
   Import `src/styles.css` in the layout. Verify a blank page renders.
2. **Shared hooks** — add `useHydrated`, swap `Link`/`useRouter`/`useParams`/
   `usePathname` inside `src/components/layout/**` (`SellerShell`, `AdminShell`,
   `RoleGate`, `nav.ts`) and `src/components/patterns/PageHeader.tsx`.
3. **Layouts** — port the three `route.tsx` layouts.
4. **Pages, one console at a time** — `/` + `/login`, then all seller pages,
   then state admin, then super admin. For each page: create the server
   `page.tsx` with `metadata`, move the component into `page.client.tsx` with
   `"use client"` at the top, fix router imports, change nothing else.
5. **Cleanup** — delete the Vite/TanStack files and deps from §5.
6. **Verify** — §7.

---

## 7. Definition of done

- `npx tsc --noEmit` clean.
- `next build` succeeds with zero prerender errors.
- All 49 URLs in §1 load with no console errors, in all three consoles.
- Sign-in chips on `/` still route straight into the right console; the session
  survives a full page reload; `RoleGate` still blocks the wrong role.
- Every page still shows: tone-coloured header rail, the "i" hover help on the
  title / each section / each metric tile, real product photos (never icons),
  paisa-formatted money, and working charts.
- Product photo upload on add/edit still compresses, previews, reorders, and
  survives a reload.
- No page flashes empty content before hydration; skeletons appear instead.

---

## 8. Known traps

- `"use client"` must be the first line of the file, above all imports.
- `next/link` has no `activeProps`; forgetting this silently kills the active
  nav highlight — check the sidebar in every console.
- `useSearchParams()` requires a `<Suspense>` boundary during prerender; wrap
  any page that reads it.
- Recharts must render client-side only; if `next build` complains about
  `window`, wrap the chart in a `dynamic(..., { ssr: false })` import — keep
  that inside `src/components/patterns/Charts.tsx` so pages stay untouched.
- `exactOptionalPropertyTypes` is on: keep `foo?: string | undefined` shapes when
  moving code; do not "simplify" them.
- Do not convert mock services into Server Actions or route handlers. The store
  is client-only by design.
