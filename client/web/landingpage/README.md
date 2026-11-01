# Faazio — Landing Page

Marketing landing page for the Faazio Daily SuperApp (Mart · Food · Pharma),
starting in Karaikal. An SEO-focused long-scrolling homepage at `/` plus
content pages at `/about`, `/faq`, `/partners`, `/karaikal`, `/download`, and
the legal pages `/terms`, `/privacy`, `/refunds`, `/cookies`, and `/disclaimer`.

Built with **TanStack Start** (file-based routing + SSR), **React 19**,
**Tailwind CSS v4**, and **Nitro** for the deployment bundle.

## Design system

Direction: a neighbourhood storefront, not a SaaS launch. Grounded, warm and
unhurried; the world is a shop counter (paper, cardboard, produce crates,
daylight), so the neutrals are warm rather than blue-grey.

- **One accent, never a surface.** Faazio Blue (`--brand`) is the accent and
  appears on the primary action, links and the sector dots. No section is
  filled with it. The four stacked colour slabs (blue, blue, pink, blue) that
  the page used to have are gone; sections now step between `--background` and
  `--surface` with hairline borders.
- **The moment is the photography.** The hero is a scene: the photograph fills
  the frame and the type sits in the calm left side it was composed to leave
  open. The three sector cards carry real food photographs; their chrome stays
  quiet so the images carry the colour.
- **Type** — `Instrument Serif` for display headings (`--font-display`),
  `Instrument Sans` for body and UI (`--font-sans`), `IBM Plex Mono` for meta
  and figures (`--font-mono`). Two weights, 400 and 500. Sentence case
  throughout; the ALL-CAPS tracked eyebrows are gone. Loaded via Google Fonts
  in `src/routes/__root.tsx`.
- **Signature** — the small "open now" dot (`.open-dot`) beside local
  availability. One detail, used only where the page talks about what is near
  you.
- **Theming** — every colour is a token defined in `:root` (light) and `.dark`.
  Components never hardcode a hex value. `color-scheme` is set per theme so
  native controls follow.
  - **Resolution.** `src/lib/theme.ts` owns the three-way rule (`auto` follows
    `prefers-color-scheme` live, `light` and `dark` are explicit) plus the
    `localStorage` key `faazio.theme` — the same key the partner portal uses, so
    a visitor's choice carries across both surfaces. `src/lib/hooks/useTheme.tsx`
    is the React binding (`ThemeProvider` + `useTheme`), mounted in
    `src/routes/__root.tsx`.
  - **No flash.** `themeInitScript` is injected inline in `<head>` from
    `src/routes/__root.tsx` and puts the resolved class on `<html>` before first
    paint; `<html>` carries `suppressHydrationWarning`.
  - **Control.** `src/components/theme-toggle.tsx` renders a three-option
    segmented control in the header (icons only below 900px, and inside the
    mobile menu below 560px). It is chrome, so it uses the muted ramp and never
    the brand colour.
  - **Photographs.** `.dark` pulls exposure and saturation down on the hero and
    sector photos so daylight photography sits in the dark room instead of
    glowing against it.
  - **Browser chrome.** The two media-scoped `<meta name="theme-color">` tags in
    `__root.tsx` follow the OS, not the stored preference, so an explicit Light
    choice under a dark OS would paint dark browser chrome above a light page.
    `applyTheme` rewrites both metas to the resolved theme's `--background`
    (`#fbfaf7` / `#1a1714`), and `themeInitScript` does the same before first
    paint so the chrome never flashes the wrong colour.
  - **Verify.** `npm run check:theme` asserts the resolution matrix, that the
    pre-paint script implements the same rule and syncs the chrome colour, and
    that the root shell actually injects it (15 checks).
- **Favicon** — `public/favicon.ico` _and_ `public/favicon.svg` carry the brand
  `client/faazio-logo.ico` art (the SVG embeds the 64×64 raster as base64),
  cache-bust `?v=3`.

### Layout primitives

`src/styles.css` owns the page's layout rather than scattering utilities:
`.page-width` (one container, `min(1120px, 100% - 48px)`), `.section` (one
vertical step, 96px / 64px on mobile), the type scale (`.display`, `.headline`,
`.subhead`, `.eyebrow`, `.lead`, `.meta`) and the button set (`.btn`,
`.btn-primary`, `.btn-outline`, `.btn-ghost`, `.btn-donor`). Everything sits on
a 4px grid.

## Development

Requires Node.js `>=22.12` and [Bun](https://bun.sh) (the lockfile is `bun.lock`).

```sh
bun install
bun run dev        # http://localhost:3000
```

Useful scripts:

```sh
bun run build       # production build (Nitro output)
bun run preview     # preview the production build
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run test        # vitest
```

## Deploy to Vercel

The app deploys to Vercel with **zero routing configuration**: on Vercel,
`VERCEL=1` makes Nitro emit the [Build Output API](https://vercel.com/docs/build-output-api)
bundle (`.vercel/output`). Import the repo, set the project **Root Directory**
to `client/web/landingpage`, and Vercel runs:

- Install: `bun install`
- Build: `bun run build`

`vercel.json` only adds security/caching response headers.

## SEO

- Every route sets a unique canonical URL, Open Graph/Twitter card, and JSON-LD
  (`LocalBusiness` with the FA CREATORS address, `WebSite`, `MobileApplication`,
  plus `WebPage`/`FAQPage`/`Place`/`SoftwareApplication` nodes) via the shared
  `seoHead()` helper in `src/lib/seo.ts` — built from the constants in
  `src/lib/site.ts`.
- Shared navigation lives in `src/components/site-header.tsx` /
  `src/components/site-footer.tsx`; content pages reuse them so every route is
  reachable through plain `<a>` links.
- Static: `public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest`,
  `public/og-image.jpg` and the favicon set. `sitemap.xml` lists every route.

When the production domain changes, update `SITE_URL` in `src/lib/site.ts`,
`public/robots.txt`, and `public/sitemap.xml` together.

## Structure

| Path                        | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `src/routes/__root.tsx`     | App shell, global `<head>` defaults, error/404 UI      |
| `src/routes/index.tsx`      | The landing page                                       |
| `src/routes/about.tsx`      | Company story (`/about`)                               |
| `src/routes/faq.tsx`        | FAQ page with `FAQPage` structured data (`/faq`)       |
| `src/routes/partners.tsx`   | Partner page for local businesses (`/partners`)        |
| `src/routes/karaikal.tsx`   | Karaikal location page (`/karaikal`)                   |
| `src/routes/download.tsx`   | App download page (`/download`)                        |
| `src/routes/privacy.tsx`    | Privacy policy (`/privacy`)                            |
| `src/routes/terms.tsx`      | Terms & Conditions (`/terms`)                          |
| `src/routes/refunds.tsx`    | Refund & cancellation policy (`/refunds`)              |
| `src/routes/cookies.tsx`    | Cookie policy (`/cookies`)                             |
| `src/routes/disclaimer.tsx` | Disclaimer (`/disclaimer`)                             |
| `src/components/`           | Section + shared components (incl. `faazio-logo.tsx`)  |
| `src/components/legal.tsx`  | Shared legal page helpers (`PolicyList`, section type) |
| `src/components/ui/`        | shadcn/ui primitives                                   |
| `src/styles.css`            | Tailwind entry + semantic colour tokens                |
| `src/lib/site.ts`           | Canonical SEO + business identity constants            |
| `src/lib/seo.ts`            | Shared `seoHead()` + JSON-LD graph builders            |
