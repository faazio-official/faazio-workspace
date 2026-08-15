export * from './types';
export type {
  CardVariant,
  BannerProps,
  PortalItem,
  CategoryItem,
  ProductCardLayout,
  SDUINode,
} from './schema';

export { martProducts } from './mart/products';
export { martStores } from './mart/stores';

export { groceryProducts } from './grocery/products';

export { foodProducts, topOfWeekDishes } from './food/products';
export { foodStores } from './food/stores';
export { BOOKING_DISHES_DB } from './food/bookingDishes';
export { TODAYS_SPECIALS } from './food/specials';

export { pharmaProducts, PHARMA_PRODUCTS_DB, PHARMA_CATEGORIES } from './pharma/products';

export { exploreStacks } from './explore/stacks';

export { categoriesSearchDatabase } from './categories/searchDatabase';

export { portalSectors, topAdSlides, sponsoredAds, recentlyViewedHistory, todaysOffers, mixedRecommendations, popularDining, recentlyViewedMart, recentlyViewedFood, recentlyViewedGrocery, recentlyViewedPharma, hotBrandDeals, faMartFinds, restaurantSpecials } from './home/rails';

export { homeSections } from './home/sections';
export type { HomeSectionKind } from './home/sections';

export { storeOffers } from './home/storeOffers';
export { nearbyOffers } from './home/nearbyOffers';

export { mensPicks, womensPicks, childrensPicks, hairSkinPicks } from './home/demographics';
export { instantFeed } from './home/instantFeed';

export { avatarMap, getProductReviews, getProductSpecs, getProductHighlights } from './productMeta/reviews';

export { defaultAddresses } from './cart/addresses';
export { coupons } from './cart/coupons';

export { pastOrders, myOrders, myOrdersTabs } from './account/orders';
export { userProfile, saverMembership } from './account/profile';
export { orderStatusCounts } from './account/orderStatus';
export { accountNavGroups } from './account/accountNav';
export { accountDetails } from './account/details';
export { savedAddresses } from './account/addresses';
