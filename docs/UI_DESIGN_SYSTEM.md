# UI Design System — unslop

**Read this before any UI work**, on the web platform (`client/web/platform`), the
landing page (`client/web/landingpage`), or the React Native app (`client/mobile`).

This document is the repo's standing instruction set for interface craft. It is
adapted from **unslop** by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)),
licensed CC BY 4.0 — keep that credit in any copy or adaptation.

The rule is simple: **removing slop is half the job.** A screen that is clean but
could belong to any product is the next template. Every pass ends with a screen
only this product could have.

---

## 0. Scope and authority

| Surface | Stack | Styling | Token home |
|---|---|---|---|
| `client/web/platform` | Next.js App Router, React 19 | Tailwind v4 | `src/styles.css` |
| `client/web/landingpage` | TanStack Start + Nitro | Tailwind v4 | `src/styles.css` |
| `client/mobile` | Bare React Native 0.86 | `StyleSheet.create` | `src/theme/*` |

Where this doc disagrees with a surface's own `AGENTS.md`, the nearer file wins
for that surface. Where it disagrees with a hard rule in root `AGENTS.md`
(brand logo, full-viewport mobile layout, boundaries), root `AGENTS.md` wins.

---

## 1. Direction — write five lines before touching anything

Derive them from what the product does and who it is for. **Never from what is
trending.** Show the five lines and the audit to the user, then wait. Changing
the direction later means redoing every pass.

- **Product.** What it does and for whom, in one plain sentence.
- **Character.** Two or three concrete words — `calm, exact, a little warm`.
  `clean`, `modern`, `sleek`, `minimal`, `premium` are banned; they describe
  every template.
- **World.** The place or material the product belongs to. That world sets the
  neutral tint, the accent, and the visual.
- **Moments.** One or two places the screen gets rich colour, material and
  detail — a rendered card, a chart whose colours each mean a series, an object
  from the world.
- **Signature.** One small detail only this product would have, used
  consistently. One detail, not five.

### The directions already decided — do not re-derive

**Landing page** — a neighbourhood storefront, not a SaaS launch.
Product: one app for a Karaikal household's groceries, meals and pharmacy.
Character: grounded, warm, unhurried. World: a shop counter — paper, cardboard,
produce crates, daylight. Moments: the hero photograph and the three sector
cards with real food. Signature: the small "open now" dot beside local
availability. Neutrals are **warm** (hue ~70–85), because the product lives next
to paper and food.

**Partner portal** — an operations console, not a dashboard demo.
Product: the console behind the marketplace, for sellers, district admins and
super admins. Character: exact, dense, quiet. World: a back office — ledgers,
manifests, dispatch boards. Moments: the one chart that leads a page, and the
sector mix. Signature: the scope chip in the header (`TN-01 · Karaikal ·
Puducherry`). Neutrals are **cool graphite** (hue ~250–265), because people
stare at it for hours and the content must carry the colour.

**Mobile app** — the shopper's app, not the console.
Product: browse, order and receive across Mart, Food and Pharma. Character:
fast, friendly, thumb-first. World: a shopfront and a delivery bag. Moments: the
sector cards and real product photography. Signature: the sector dot + tint from
`SECTOR_VISUALS`. Per-brand colour comes from `brandTokens.ts`.

---

## 2. Decide how much to change

Read the audit honestly before planning.

- **Heavy slop** — many signs across colour, type, icons and copy. Run all nine
  passes.
- **Light slop** — mostly designed, a few signs left. Polish mode: fix only what
  the audit found, take the direction from the existing brand, keep palette,
  type, layout and visual. Bigger ideas go in the report as suggestions.
- **No slop** — say so plainly, suggest two or three refinements with exact
  values, apply only if the user agrees. **Never change a good screen just to
  make it different.**

---

## 3. The nine passes, in order

Finish a pass across the whole screen before starting the next. Order matters:
spacing first (everything reads differently once the rhythm is right), copy
before type and layout (headline length decides its size and position), visuals
and motion last (they should fit a screen that already works without them).

### Pass 1 — Spacing

- Everything on a **4px grid**. 28 and 104 are fine; 13 and 11 are not.
- Same thing, same size: all rows in a list share one height and one gap; all
  cards in a row share one padding.
- Space shows grouping: space inside a group is smaller than space between
  groups.
- Things line up: icons in one column, labels on one line, numbers right-aligned
  in one column. No stray `translate` or odd margin to fake alignment.
- Padding follows density: compact panels and sidebars ~16, cards 20–24, page
  edges 24–32.
- **Navigation is the densest part of an app.** Rows 32–36 tall, gap 2–4, icons
  in one column. A section label sits closer to its own items than to the
  section above (24 above, 8 below). Measure the sidebar after this pass — it is
  where spacing breaks most often.
- Replace one-off values (`mt-[13px]`, `py-[11px]`) with steps from the scale.

### Pass 2 — Colour

- Build from **one neutral ramp**, tinted toward the world in the direction.
- In apps and dashboards, backgrounds, surfaces, borders and text stay neutral.
  A screen whose background reads as orange, brown, blue or green has gone too
  far. The world shows in the accent, the charts and the moments — not the
  surfaces. Landing pages may tint surfaces further toward the world.
- **Three text roles only**: primary, secondary, muted. Not ten near-identical
  tints.
- **One accent**, used rarely, in the chrome. It marks the primary action, the
  selection, or the one number that matters.
- The moments are the exception: inside them colour can be rich — several hues
  in a chart, a rendered object with real materials, an image with its own light
  — as long as each colour means something.
- If the brand has a real colour, it becomes the accent and leaves the surfaces.
- Accent with text on it reaches **4.5:1**. If it does not, darken it or put dark
  text on it. Accent used as ink on a light surface needs the same.
- On dark themes the primary button can be an off-white from the ramp with dark
  text, and the accent lives somewhere smaller. Often more deliberate than a
  coloured button.
- Semantic colours only carry meaning (green = good change, red = error) and are
  toned down to sit inside the palette.
- **Remove**: hue gradients on surfaces, gradient text, coloured glows, coloured
  shadows, radial washes, blobs behind content, neon borders.
- Borders are quiet hairlines — primary text at 6–10% opacity.
- On dark, depth comes from surface steps and hairlines, not shadows. On light,
  shadows are neutral, soft and small.
- A gradient is allowed only as a small tone shift **inside one neutral** (an
  active row going `#2b2b2b` → `#1f1f1f`). Never hue to hue.

### Pass 3 — Icons

- Every emoji used as an icon or label decoration becomes a line icon from the
  set the project already has (`lucide-react` on web, `lucide-react-native` on
  mobile).
- **One size, one stroke** everywhere: 16 or 18px, stroke 1.5.
- Icons take their text role's colour (usually secondary or muted). They never
  get their own colour.
- The icon box has the same width in every row; the gap to the label is fixed at
  8 or 10, so labels align.
- Drop icons that add nothing — an emoji in every card title, an icon before
  every section label. Categories that need colour get a small status dot.

### Pass 4 — Copy

- Headlines say what the product does for whom, in plain words, so they could
  not fit another product. Use facts already on the page; **invent nothing**.
- No exclamation marks in interface text. Never `!!`.
- No greeting headlines (`Welcome back, Damir! 👋`). The title names the context
  — the page name or the period.
- Short labels: `Search`, not `Search anything...`.
- A change says what it compares to: `+12% vs last month`, `3 fewer vs last
  month`.
- Headlines, subheads, labels, buttons and captions **end without a period**.
  Only paragraphs of several sentences keep their periods.
- No hype words: supercharge, seamless, unlock, magic, revolutionize,
  game-changing, empower, leverage. And not `AI-powered` on everything.
- Claims that cannot be checked (`Loved by 10,000+ teams`, `10x faster`) become
  quiet and specific if the user confirms they are real, and are removed
  otherwise. Ask, and list them in the report.
- Mock data looks real — plausible numbers and names, never `[X]` or `123,456`.
- Badges like `PRO`, `New ✨`, `Beta 🚀` go away unless the product truly needs
  them, and then they are quiet text.

### Pass 5 — Type

- Choose type for the character in the direction. Keep the project's font when
  it is part of a real brand.
- **A few sizes from a scale, two weights (400 and 500), 600 at most for rare
  emphasis.** No 700–900 headings. No gradient text.
- Hierarchy comes from **size and colour**, not weight.
- **Sentence case everywhere.** `NAVIGATION` and `PAID THIS MONTH` become
  `Navigation` and `Paid this month`.
- Small text never gets negative letter spacing. Tight tracking is for large
  display text only (from 40px, `-0.02em`).
- Numbers use `tabular-nums` and **one format across the screen**. If one figure
  is `$48,210`, the next is not `$124,860.40`.
- No italic for emphasis.

### Pass 6 — Layout

- Keep the sections and their order. Inside a section, alignment and proportions
  may change when that makes the screen clearer.
- **Apps and dashboards keep real app proportions.** The shell fills the
  viewport, sidebar 240–280, fluid content capped ~1440–1600, and the page is as
  long as its content. Never shrink an app into a narrow centred column.
- **The strongest landing hero is a scene.** One image fills the hero edge to
  edge, its subject sits on one side, the headline sits on the calm empty part,
  and the product view rises from the bottom edge.
- Without a scene, use an asymmetric split — text on one side, visual at least
  half the width. Everything stacked and centred is the template default; keep
  it only for a short hero with no visual.
- Long headlines align left. Centred text works for one or two short lines.
- **One primary action and at most one secondary action** next to it. Anything
  else moves out of the hero.
- Navigation stays quiet: logo, existing links, one button. Log in is a quiet
  text link, not a second button. On small screens links collapse into one menu
  button.
- Compose the first screen as a whole — the hero fills the viewport height with
  no dead empty band.
- On small screens everything stacks in reading order, the headline drops to the
  mobile size, and the visual comes after the actions. A dense preview gets
  **simpler** on mobile (fewer rows and columns), not zoomed down. No text below
  11px.

### Pass 7 — Details

- **Nested radius**: inner = outer − padding, never below 4. Controls 8–10,
  cards 12–16, panels 14–20. Not everything is a pill.
- Counts and meta become quiet text, often mono and muted — not glowing pills.
- Keyboard shortcuts become small keycaps.
- Charts sit on a muted grid with muted mono labels. No rainbow bars inside one
  series, no glowing bars, no uppercase day labels. If the chart is placeholder
  noise, replace it with data that tells something real.
- Charts have hierarchy, like text. **One main chart** is clearly the biggest
  thing on the screen. Anything else showing data is smaller and different in
  kind — a ranked list with thin bars, or a short table. Never a second chart of
  the same size.
- **One accent per chart.** The thing that matters gets the accent; everything
  else sits in neutral steps of the ramp.
- **Stat cards are numbers**: a label, a big figure, and a change with what it
  compares to. No sparklines, tallies, mini bars or filler icons.
- **Vary the sizes.** Equal-width cards side by side with the same content read
  as a template. Give the grid a rhythm.
- Pick the chart type for the data: trend → line; comparison → bars; share → one
  stacked bar or a list with bars; single goal → progress bar.
- The active state is a small surface step with a hairline highlight — not a
  gradient with a glow.
- Hover and focus states exist and stay inside the palette. A visible focus ring
  for keyboard users.
- The logo is the product name in the main family plus a simple mark. No
  gradient wordmark, no sparkle tile.

### Pass 8 — Visuals

- Decorative filler goes: glossy blobs, orbs, nebulas, floating cubes, glowing
  grids, holographic brains, robots. They say nothing about the product.
- A landing hero gets a visual that shows something true.
- **Dashboards and app screens almost never need generated images.** Their
  moments come from the product itself — a chart drawn with care, figures set
  beautifully, real product photos, a status that feels alive.
- A physical thing the product deals with (a payment card, a receipt) is usually
  better built in code with real materials than generated.
- Generate images for an app only for empty states, onboarding and marketing
  moments, or when the user asks.
- Show the product: build a preview in code of what the page already promises,
  with the project's components and plausible data. Showing what the copy
  already claims is not inventing a feature.

### Pass 9 — Motion

- Remove motion that loops for no reason — `animate-pulse`, `animate-ping`,
  breathing glows, shimmer on headings, floating elements, parallax.
- Remove `transition-all`, bouncy springs, `hover:scale` on cards, and anything
  that moves more than a few pixels on hover.
- Keep motion that explains something: a hover is a quick colour or surface
  change; a press is a tiny scale down; a menu fades and rises a few pixels from
  where it opens; a changed number tweens.
- Transition **colour, background, border, opacity and transform** — named
  (`transition-colors`, `transition-[transform,opacity]`), never a catch-all.
  Never animate width, height, top, left, margins or large blurs.
- **One easing curve**, a few durations, across the whole screen:
  `cubic-bezier(0.22, 1, 0.36, 1)`. 120–180ms for feedback, 160–220ms for menus,
  300–500ms for entrances.
- At most one entrance on load — a short fade and rise with a small stagger (40–
  60ms, at most six items). Not every card flying in from a different side.

---

## 4. Signs of slop — the audit checklist

Go through every group and note each sign **with where it lives**, one line each.

**Surfaces and colour** — hue-to-hue gradients on backgrounds/cards/buttons;
gradient text; coloured glows and `drop-shadow`; radial washes and blurred
blobs; neon borders; five near-identical tints of one hue; every element
highlighted so nothing stands out; glass cards with a white inner highlight.

**Type** — headings at 800/900; uppercase tracked labels; too many sizes and
weights; mixed number formats; negative tracking on small text; italic for
emphasis.

**Icons** — emoji as nav icons, label decoration or status; emoji inside pills
and counts; many sizes and colours; icons nudged off the column; a sparkle for
anything AI.

**Spacing** — arbitrary values; rows in one list with different heights or gaps;
groups closer to their neighbours than to their own items; uneven padding in
sibling cards; a big gap above a section and cramped space below.

**Copy** — greeting headlines; exclamation marks; changes without a reference;
wordy placeholders; hype words; trailing periods on labels; fake-looking data.

**Components** — glowing pills for counts/status; `PRO` / `New ✨` / `Beta 🚀`
badges; every element a full pill; rainbow or glowing charts; every chart in
shades of the accent so nothing leads; sparklines on every stat card; equal
cards each with the same layout; a gradient tile logo with a sparkle.

**Landing and heroes** — a pill badge above the headline; a headline that could
fit any product; gradient or shimmer on the headline; floating blobs behind the
hero; everything stacked and centred; three or more buttons; unverifiable social
proof; parallax; feature cards with an emoji, a bold title and a vague line.

**Visuals** — glossy 3D blobs, liquid chrome, purple nebula; stock robots,
glowing brains, circuit lines; text or fake buttons baked into an image; an
image with a hard edge and a different black; a visual on every section.

**Motion** — `animate-pulse` on things that are not live; `transition-all` and
`hover:scale`; bouncy springs; everything flying in from different directions;
animating width/height/top/left.

**Template look** (not slop, but what a cleaned screen falls back to when nobody
decided) — pure grey page + Inter + white text + old brand on one button on a
product whose world is warm; a headline that fits another product if you swap
the name; an empty box or generic picture as the hero; every product getting the
same layout, type and palette.

---

## 5. Tokens

Starting values. When the project already has a good system, **keep its values
and only fix how they are used.**

### Spacing scale
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`

- Inside a control: 4–12 · Between related items: 2–8 · Between groups: 12–24
- Between sections: 32–64 · Landing sections: 80–128
- Row heights: 32 compact, 36 default, 40–44 touch
- Hero: 96–128 from nav to headline on desktop, 48–64 on mobile

### App layout
Sidebar 240–280, content fluid, page padding 24–32, capped ~1440–1600. Top bar
56–64 tall. Nav rows 32–36, gap 2–4, section labels 24 above / 8 below. Stat
cards in a row share one height, numbers only. The main chart spans at least two
thirds of the content width and is 280–360 tall; a second data block beside it
is a list or table, not another chart.

### Type scale
| Use | Size | Line height | Weight |
|---|---|---|---|
| Small labels, meta, counts | 12 | 16 | 400, mono welcome |
| Secondary text, captions | 13–14 | 20 | 400 |
| Body, nav items | 14–15 | 20–22 | 400–500 |
| Logo wordmark | 16–18 | 1 | 500–600 |
| Hero subhead | 18–20 | 28–30 | 400, secondary, ≤36rem |
| Card figures | 28–32 | 1 | 500, tabular |
| Page title | 28–36 | 1.15 | 400–500 |
| Hero headline | 56–72 desktop, 36–44 mobile | 1.02–1.08 | 400–500 |

Letter spacing 0 under 16px; `-0.02em` from 40px; `-0.03em` from 56px.

### Radius
Keycap/tag/small button 4–6 · Row/input/button 8–10 · Card 12–16 · Panel 14–20.
Nested: inner = outer − padding, never below 4.

### Icons
lucide, 16 or 18px, stroke 1.5, muted or secondary text colour, 8–10px gap to
the label.

### Depth
- Dark: surface steps + hairline. An active row may carry
  `inset 0 1px 0 rgba(255,255,255,0.12)`.
- Light: `0 1px 2px rgba(0,0,0,0.05)` small, `0 8px 24px rgba(0,0,0,0.06)`
  floating.

### Semantic colour
Positive `#4cc38a` dark / `#16a34a` light. Negative `#e5484d` dark / `#dc2626`
light. Toned to sit inside the ramp.

---

## 6. Surface playbooks

### 6.1 `client/web/platform` — the console

**Tokens live in `src/styles.css`.** Every surface token is defined twice:
`:root` is light, `.dark` is dark. Components read tokens only, so both themes
are complete and **no component needs a `dark:` variant to look right.**

Adding a token means: add to `:root` **and** `.dark`, then register it in
`@theme inline` as `--color-<name>: var(--<name>)`. A token registered in only
one place is a bug.

Current token families — use these, do not invent parallels:

| Family | Tokens | Use |
|---|---|---|
| Surfaces | `--background`, `--card`, `--popover`, `--secondary`, `--muted`, `--accent` | page, raised, overlay |
| Text | `--foreground`, `--muted-foreground` | the three text roles |
| Chrome | `--sidebar`, `--sidebar-foreground`, `--sidebar-muted`, `--sidebar-border`, `--sidebar-active`, `--sidebar-active-foreground` | the shell nav |
| Accent | `--primary`, `--primary-foreground`, `--interactive`, `--ring` | action, link, focus |
| Semantic | `--destructive`, `--success`, `--warning` (+ `-foreground`) | meaning only |
| Sector | `--mart`, `--food`, `--pharma` | sector labels, sector mix chart |
| Data | `--chart-1` … `--chart-5` | one accent leads, rest are neutral steps |
| Overlay | `--overlay` | dialog/sheet/drawer scrim |
| Ink | `--ink`, `--ink-foreground`, `--ink-muted`, `--ink-border` | **only** the help popover and seed banner |

**The sidebar is a surface, not a slab.** Use `bg-sidebar`,
`border-sidebar-border`, `text-sidebar-muted`, `bg-sidebar-active`. Painting the
shell with `--ink-*` is what produced the black-sidebar / white-content split —
never do it.

Utilities already defined: `surface` (card + hairline + radius + shadow), `num`
(mono + tabular), `focus-ringed` (light surfaces), `focus-ring-ink` (dark
surfaces), `brand-wordmark`.

Density: `html { font-size: 13px }`. The console is deliberately denser than the
landing page. Use the `text-[11px]` / `text-[12px]` / `text-[13px]` / `text-[14px]`
steps already in use — do not introduce a new size.

Primitives to reuse rather than re-implement, all under
`src/components/patterns/`: `SectionCard`, `KpiCard` + `KpiStrip` (both in
`KpiCard.tsx`), `PageHeader`, `DataState`, `StatusPill` + `SectorPill` (both in
`Pills.tsx`), `FilterChip`, `InfoHint`, `ComponentHelp`, `ImageUploader`,
`ProductThumb`, `SeedModeBanner`. Tables use `@/components/ui/table` — never a
raw `<table>`.

### 6.2 `client/web/landingpage` — the storefront

**Tokens live in `src/styles.css`**, same `:root` / `.dark` contract. Warm paper
ramp (hue ~70–85). Families: `--background`, `--surface`, `--surface-sunken`,
`--card`, `--popover`, `--brand`, `--brand-ink`, `--brand-soft`, `--brand-line`,
`--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--border-strong`,
`--input`, `--ring`, `--overlay`, `--destructive`, `--donor`, `--donor-soft`,
`--donor-line`, `--mart`, `--food`, `--pharma`.

Type: **Instrument Sans** for interface, **Instrument Serif** for display
headlines only (never labels or buttons), **IBM Plex Mono** for figures and meta.

Rules specific to this surface:
- One long-scrolling index route; sections are focused components. Do not
  restructure into multiple pages.
- Unavailable external actions stay in informative dialogs until verified
  destinations exist. Never fabricate a download or a submission.
- Use the shared `DownloadButton` for app-download actions.
- Motion via `motion/react` with `MotionConfig reducedMotion="user"`.
- Always render `<FaazioLogo />`, never raw text or placeholder art.
- Photographs: `.dark` pulls exposure and saturation down on hero and sector
  photos so daylight photography sits in the dark room instead of glowing.

### 6.3 `client/mobile` — the app

**Styling is `StyleSheet.create`, not Tailwind.** There is no `className` in this
app. Tokens live in `src/theme/`:

| File | Owns |
|---|---|
| `src/theme/brandTokens.ts` | Per-`AppBrand` colour: `accent`, `accentDark`, `cardBg`, `btnBg`, `btnText`, `btnAdded`, `gradient`, `headerGradient`, `headerTextColor`, `priceColor`, `pillBg` — plus the four-role ramp (`brandRamp`, `parentRamp`), `semantic` / `semanticTint`, and `neutral` |
| `src/theme/spacing.ts` | `SPACE.SECTION` / `BLOCK` / `ITEM` / `LIST_BOTTOM` — the canonical vertical rhythm |
| `src/theme/fonts.ts` | Platform fonts only (Roboto on Android, `System` on iOS). No custom font module, no font-load gate |
| `src/theme/sectorVisuals.ts` | `SECTOR_VISUALS` — sector icon, fill and icon tint, derived from `brandRamp` |
| `src/theme/categorical.ts` | `categorical` — the product-category icon palette. Not brand colour: 23 categories in one hue would be unreadable, so these are a defined, documented set that must stay clear of the brand anchors |

**The four-role ramp.** Every brand anchor is bright, so it can never carry
white text (Mart 1.63, Pharma 2.49, Food 2.80 against white). The anchor is a
fill colour only. Each brand therefore expands into roles, and the role decides
the pairing:

| Role | Use | Pairs with |
|---|---|---|
| `base` | fills, icons, chips, badges, accents | `onBase` |
| `baseLift` | second header-gradient stop only | `onBase` |
| `deep` | CTA/button fill, text on white, active tab | `onDeep` (white) |
| `pressed` | `:active` state of `deep` | `onDeep` (white) |
| `tint` | card/pill background | `onTint` |

Never put white text on `base`. Never derive `pressed` by lightening `base` —
that produces colours that fail their own rule (Mart 2.65, Food 4.23); derive it
from `deep`. `semantic` and `neutral` are shared across all sub-apps and are not
tinted per brand. `npm run check:brand-contrast` asserts every one of these rules
against the real token file.

**Legacy field mapping.** The `brandTokens` field names are kept so no consumer
had to change, but each one now projects a ramp role: `accent`, `btnBg`,
`priceColor` and `tabActiveColor` are `deep`; `badgeBg` and `accentLight` are
`base` (fill only); `accentDark` is `pressed`; `cardBg` and `pillBg` are `tint`;
`btnAdded` is `semantic.success`; `headerGradient` is `base` → `baseLift` with
`headerTextColor` = `#0F172A`. Do not reintroduce a literal here — add a role to
the ramp and project it.

**Sub-app headers are bright, not dark.** The header gradient runs `base` →
`baseLift` and carries dark ink (`#0F172A`), which is the only legal pairing on a
bright surface. Food and Pharma previously ran white text over `#FB923C` (2.26)
and `#2DD4BF` (1.86); both failed.


Rules specific to this surface:
- **`SPACE` owns section rhythm.** A boundary has exactly one owner of its gap: a
  section header owns its top gap (`SPACE.SECTION`); its parent must not also add
  `paddingTop`/`marginTop` for the same boundary.
- Icons come from `lucide-react-native`, one size and stroke.
- **Emoji are not icons.** `src/components/EnterpriseIcon.tsx` maps emoji keys to
  lucide icons — that mapping layer is the correct pattern. Do not add new emoji
  to UI copy, labels, pills or status.
- Layout stays full-viewport and non-scrollable (`h-[100dvh]` equivalent), no
  faux device borders or notches.
- Always `<FaazioLogo />`.
- **Known debt:** the app still carries ~2,300 hardcoded hex literals across ~188
  files, and per-feature theme files (`features/food/constants/theme.ts`,
  `features/ecommerce/components/vendor/theme.ts`,
  `features/pharma/blood-donor/tokens.ts`) that overlap `src/theme`. When you
  touch a screen, move its colours onto `brandTokens` / a shared token rather
  than adding another literal. Do not do a big-bang sweep unasked.
- The app is **light-only today**. There is no `useTheme` equivalent. If you add
  dark mode, follow the web contract: one token object per theme, resolved once,
  no per-component conditionals.

---

## 7. The theme contract (web)

Both web surfaces implement the same three-way preference. **This is not
optional polish — every new surface must honour it.**

- **Preferences:** `auto` (follow the OS live), `light`, `dark`.
- **Storage:** `localStorage` key `faazio.theme`, shared by both surfaces, so a
  visitor's choice carries from the landing page into the console.
- **Resolution:** `src/lib/theme.ts` on each surface — `readThemePreference`,
  `resolveTheme`, `applyTheme`. `applyTheme` toggles `.dark` on `<html>` **and**
  rewrites the `theme-color` metas so browser chrome matches what is painted.
- **No flash:** `themeInitScript` runs inline in `<head>` before first paint and
  puts the resolved class on `<html>`. `<html>` carries
  `suppressHydrationWarning`.
- **React binding:** `src/lib/hooks/useTheme.tsx` (`ThemeProvider` + `useTheme`),
  mounted in `app/providers.tsx` (platform) and `__root.tsx` (landing).
- **Controls:** platform exports `ThemeSegmentedControl` (Settings pages) and
  `ThemeMenu` (shell header). Landing exports `ThemeToggle` (header + mobile
  menu). Every role gets a setting — seller, district admin, super admin.
- **Never** hardcode a `dark:` variant to patch a token gap. Fix the token.

---

## 8. Verification — run before claiming done

**Platform** (`client/web/platform/`):
```bash
npx tsc --noEmit          # always
npm run lint              # 0 errors required
npm run check:theme       # theme resolution + pre-paint script + chrome colour
npx next build            # when routes, layouts or providers changed
```

**Landing** (`client/web/landingpage/`):
```bash
npm run typecheck
npm run check:theme
npm test
```

**Mobile** (`client/mobile/`):
```bash
npm run ts:check
npm run check:boundaries
```
Never run Gradle locally — builds are CI-only (see root `AGENTS.md`).

**Then look at it.** Typechecking proves nothing about craft. Run the dev server
and read the rendered page in both themes; measure contrast on any new
colour pair rather than eyeballing it.

---

## 9. Do not

- Do not rename the product, even when the name contains "AI". Keep a real logo
  as it is. When the logo itself is slop (emoji, sparkle in a gradient tile),
  redraw it flat: the wordmark alone, or a simple glyph in one solid colour.
  Never a glossy or gradient ball, a glow, or a gradient tile.
- Do not change what the product is. Keep features, content and section order
  unless the user asks for more. Placeholder content that means nothing may be
  replaced with content that does.
- Do not replace removed decoration with new decoration, and do not swap one
  trend for another (glass, grain, noise, neon, bento grids).
- Do not invent features, claims or data.
- Do not fall back to the same look for every product. The direction decides the
  palette tint, type and visual — not habit.
- Do not do a repo-wide sweep unasked. Scope to what the user asked for, and
  report the rest.

---

## 10. Checklist — a screen is done when

- [ ] The five-line direction is written and every pass follows it
- [ ] Every spacing value is on the 4px scale; equal things have equal sizes
- [ ] Icons, labels and numbers each sit in one aligned column
- [ ] One tinted neutral ramp, three text roles, one accent with ≥4.5:1 contrast
- [ ] No hue gradients, gradient text, glows, coloured shadows or colour blobs
- [ ] No emoji left in the interface
- [ ] One icon set at one size and stroke
- [ ] Type chosen for the character; weights 400–600; no uppercase tracked
      labels; no italic; no negative tracking on small text
- [ ] No exclamation marks, no trailing periods on short strings, no greeting
      headline, no unverified claims
- [ ] Numbers in one format with tabular figures
- [ ] Nested radii add up
- [ ] A hero has a real visual or a product preview with at least one moment —
      never filler, never a labelled placeholder
- [ ] The first screen is composed as a whole with no dead empty band
- [ ] No looping or bouncy motion; one easing curve; no animated layout
      properties
- [ ] Both themes render correctly, and the browser chrome matches
- [ ] **Template check:** swap the product name for another product's. Does the
      screen still fit? If yes, push the direction harder in the copy, the
      visual and the signature detail.

---

Adapted from **unslop** by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)),
CC BY 4.0. Keep this credit in any copy or adaptation.
