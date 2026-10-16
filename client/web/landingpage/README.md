# Faazio — Landing Page

Marketing landing page for the Faazio Daily SuperApp (Mart · Food · Pharma),
starting in Karaikal. One long-scrolling route at `/`.

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

- Canonical URL + Open Graph/Twitter + JSON-LD (`Organization`, `WebSite`,
  `MobileApplication`) are set per route in `src/routes/index.tsx`.
- Shared metadata constants live in `src/lib/site.ts` (`SITE_URL`, etc.).
- Static: `public/robots.txt`, `public/sitemap.xml`, `public/site.webmanifest`,
  `public/og-image.jpg` and the favicon set.

When the production domain changes, update `SITE_URL` in `src/lib/site.ts`,
`public/robots.txt`, and `public/sitemap.xml` together.

## Structure

| Path                    | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `src/routes/__root.tsx` | App shell, global `<head>` defaults, error/404 UI     |
| `src/routes/index.tsx`  | The landing page                                      |
| `src/components/`       | Section + shared components (incl. `faazio-logo.tsx`) |
| `src/components/ui/`    | shadcn/ui primitives                                  |
| `src/styles.css`        | Tailwind entry + semantic colour tokens               |
| `src/lib/site.ts`       | Canonical SEO constants                               |
