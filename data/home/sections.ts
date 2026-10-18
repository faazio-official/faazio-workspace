/**
 * @static Deliberately immutable in-code config: the ordered Home feed section registry.
 * Expected to become server-driven once the Go Chi backend (server/) is wired.
 * See data/DATA_CONTROL.md.
 */
// Ordered home screen section registry.
// Re-ordering the Home feed is a data change here — no component edits needed.

export type HomeSectionKind =
  | 'adBanner'
  | 'diningSpecials'
  | 'hotBrandDeals'
  | 'dealsOfDay'
  | 'martHero'
  | 'martDeals'
  | 'martEssentials'
  | 'foodHero'
  | 'foodSpecials'
  | 'pharmaHero'
  | 'pharmaPopular'
  | 'pharmaEssentials'
  | 'sponsoredRail'
  | 'mostRatedDining'
  | 'recentlyViewedMart'
  | 'recentlyViewedFood'
  | 'recentlyViewedPharma'
  | 'nearbyOffers'
  | 'mens'
  | 'womens'
  | 'childrens'
  | 'hairSkinCare'
  | 'filterFeed';

export interface HomeSectionDescriptor {
  id: HomeSectionKind;
}

export const homeSections: HomeSectionDescriptor[] = [
  { id: 'adBanner' },
  { id: 'diningSpecials' },
  { id: 'hotBrandDeals' },
  { id: 'dealsOfDay' },
  { id: 'sponsoredRail' },
  { id: 'mostRatedDining' },
  { id: 'recentlyViewedMart' },
  { id: 'recentlyViewedFood' },
  { id: 'recentlyViewedPharma' },
  { id: 'nearbyOffers' },
  { id: 'mens' },
  { id: 'womens' },
  { id: 'childrens' },
  { id: 'hairSkinCare' },
  { id: 'filterFeed' },
];
