# AGENTS.md — Faazio Landing Page

## Application rules

- Keep the requested landing experience as one long-scrolling index route with focused section components; this preserves the approved in-page exploration flow.
- Store presentation colors and reusable visual styles in global semantic tokens; this keeps the brand consistent without component-level color literals.
- Keep unavailable external actions in informative dialogs until verified destinations are supplied; this prevents fabricated downloads or submissions.
- Use the shared DownloadButton for app-download actions and Motion for scroll/interaction animation with reduced-motion support; this keeps conversion controls and accessibility consistent.
- Always render the Faazio wordmark with `<FaazioLogo />` (`src/components/faazio-logo.tsx`), never raw text or placeholder art. The glyph contours are copied from the mobile brand asset (`client/mobile/src/assets/logo.svg`).

## Deployment

- Target is Vercel, using Nitro's zero-config Build Output API bundle. On Vercel
  (`VERCEL=1`) `vite.config.ts` pins the Nitro `vercel` preset; other hosts stay
  on the generic Node target. Keep `vercel.json` limited to headers.
- Keep runtime metadata in one place: `SITE_URL` and friends in
  `src/lib/site.ts`. When the domain changes, update it plus `public/robots.txt`
  and `public/sitemap.xml` in the same change.
