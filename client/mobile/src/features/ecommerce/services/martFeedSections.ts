/**
 * Mart home feed section registry — the single paid/organic contract for `FaMartScreen`.
 *
 * The Mart feed is a fixed, ordered set of sections. Each is either **paid** (fed by the ad-server
 * through `CampaignHero`/`SponsoredRail`, always AD-labelled, with closed-loop impression/click
 * events) or **organic** (catalog/SDUI-resolved merchandising, never labelled as paid). Keeping the
 * order + classification in one place means no future section can be added as "paid" without a
 * placement, and the docs (`PAGE_CATALOG.md` §2, `mobile-app.md`) have a single source to point at.
 *
 * The footer ("Local Vendors Near You") is part of the registry for documentation completeness but
 * is rendered as the list footer, not a scrollable section — hence it is excluded from
 * `MART_FEED_SECTION_IDS`.
 */
export type MartSectionKind = 'paid' | 'organic';

export interface MartFeedSection {
  id: string;
  kind: MartSectionKind;
  /** Paid placement served by the ad-server (`GET /ads/hero|live`); absent for organic sections. */
  placement?: string;
  /** Human label (docs / dev assertions). */
  label: string;
}

/** Ordered feed sections. Paid first (hero), then paid shelf, then the organic rails + footer. */
export const MART_FEED_SECTIONS: readonly MartFeedSection[] = [
  { id: 'hero', kind: 'paid', placement: 'MART_HERO', label: 'Hero carousel' },
  {
    id: 'sponsoredShowcase',
    kind: 'paid',
    placement: 'SPONSORED_SHOWCASE',
    label: 'Sponsored picks shelf',
  },
  { id: 'deals', kind: 'organic', label: 'Deals of the Day' },
  { id: 'essentials', kind: 'organic', label: 'Daily Essentials' },
  { id: 'vendors', kind: 'organic', label: 'Local Vendors Near You' },
] as const;

/** Paid placement rendered by the DealsLanding "View All" header on the Mart rails. */
export const MART_VIEW_ALL_PLACEMENT = 'SECTOR_RAIL';

/** Ordered ids of the scrollable feed sections (the footer is excluded — see the module note). */
export const MART_FEED_SECTION_IDS: string[] = MART_FEED_SECTIONS.filter(
  (s) => s.id !== 'vendors',
).map((s) => s.id);

/** Footer section id (rendered via the list footer, not the scrollable section list). */
export const MART_FOOTER_SECTION_ID = 'vendors';

/** Whether a section id is a paid placement (drives AD labelling + ad-event reporting). */
export function isPaidMartSection(id: string): boolean {
  return MART_FEED_SECTIONS.some((s) => s.id === id && s.kind === 'paid');
}

// Dev guard: a paid section without a placement would render unlabelled / uninstrumented.
if (__DEV__) {
  for (const section of MART_FEED_SECTIONS) {
    if (section.kind === 'paid' && !section.placement) {
      console.warn(
        `[faazio:martFeedSections] paid section "${section.id}" declares no placement — add one to MART_FEED_SECTIONS.`,
      );
    }
  }
}