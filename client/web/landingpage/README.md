# Faazio — Landing Page

Marketing landing page for the Faazio Daily SuperApp (Mart · Food · Pharma),
starting in Karaikal. An SEO-focused long-scrolling homepage at `/` plus
content pages at `/about`, `/faq`, `/partners`, `/karaikal`, and `/download`.

Built with **TanStack Start** (file-based routing + SSR), **React 19**,
**Tailwind CSS v4**, and **Nitro** for the deployment bundle.

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

| Path                    | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `src/routes/__root.tsx` | App shell, global `<head>` defaults, error/404 UI     |
| `src/routes/index.tsx`  | The landing page                                      |
| `src/routes/about.tsx`  | Company story (`/about`)                              |
| `src/routes/faq.tsx`    | FAQ page with `FAQPage` structured data (`/faq`)      |
| `src/routes/partners.tsx` | Partner page for local businesses (`/partners`)     |
| `src/routes/karaikal.tsx` | Karaikal location page (`/karaikal`)                |
| `src/routes/download.tsx` | App download page (`/download`)                     |
| `src/components/`       | Section + shared components (incl. `faazio-logo.tsx`) |
| `src/components/ui/`    | shadcn/ui primitives                                  |
| `src/styles.css`        | Tailwind entry + semantic colour tokens               |
| `src/lib/site.ts`       | Canonical SEO + business identity constants           |
| `src/lib/seo.ts`        | Shared `seoHead()` + JSON-LD graph builders           |
