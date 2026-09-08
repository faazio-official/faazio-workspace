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
export { MART_DEALS, dealToProduct } from './mart/deals';

export { groceryProducts } from './grocery/products';
export { groceryStores } from './grocery/stores';

export { foodProducts, topOfWeekDishes } from './food/products';
export { foodStores } from './food/stores';
export { BOOKING_DISHES_DB } from './food/bookingDishes';
export { TODAYS_SPECIALS, dishToProduct } from './food/specials';

export { pharmaProducts, PHARMA_PRODUCTS_DB, PHARMA_CATEGORIES } from './pharma/products';
export { pharmaStores } from './pharma/stores';

export { exploreStacks } from './explore/stacks';

export { categoriesSearchDatabase } from './categories/searchDatabase';

export { portalSectors, topAdSlides, sponsoredAds, recentlyViewedHistory, todaysOffers, mixedRecommendations, popularDining, recentlyViewedMart, recentlyViewedFood, recentlyViewedGrocery, recentlyViewedPharma, hotBrandDeals, faMartFinds, restaurantSpecials } from './home/rails';

export { homeSections } from './home/sections';
export type { HomeSectionKind } from './home/sections';

export { nearbyOffers } from './home/nearbyOffers';

export { mensPicks, womensPicks, childrensPicks, hairSkinPicks } from './home/demographics';
export { instantFeed } from './home/instantFeed';

export { avatarMap, getProductReviews, getProductSpecs, getProductHighlights } from './productMeta/reviews';

export { defaultAddresses } from './cart/addresses';
export { coupons } from './cart/coupons';
export { getPickupPointsForItems, NEUTRAL_PICKUP } from './cart/pickup-resolver';

export { pastOrders, myOrders, myOrdersStatusFilters, getMyOrderById } from './account/orders';
export { userProfile, saverMembership } from './account/profile';
export { orderStatusCounts } from './account/orderStatus';
export { accountNavGroups } from './account/accountNav';
export { accountDetails } from './account/details';
export { savedAddresses } from './account/addresses';

// Normalized microservice-shaped tables (new surface, wired via GatewayClient).
export {
  catalogIndex,
  getCatalogEntryById,
  getCatalogEntriesByIds,
  getProductById,
  pharmaFacetCategories,
} from './catalog/products';
export type { CatalogEntry, CatalogFacetCategory } from './catalog/products';

export { storeDirectory, getStoreById, getStoresByApp } from './directory/stores';
export type { StoreRecord } from './directory/stores';

export { reviewsTable, specsTable, highlightsTable, getReviewsByProductId } from './reviews/reviews';
export type { ReviewRow, SpecRow, HighlightRow } from './reviews/reviews';

export { stockTable, getStockByProductId, getStockByProductIds } from './inventory/stock';
export type { StockRow } from './inventory/stock';

export { usersTable, addressesTable, couponsTable, ordersTable, getOrdersByUser } from './checkout/orders';
export type { UserRow, AddressRow, CouponRow, OrderRow, OrderLineItem } from './checkout/orders';

export {
  profileTable,
  membershipTable,
  orderStatusTable,
  navTable,
  detailsTable,
  getProfileByUserId,
} from './accounts/profile';
export type { ProfileRow, MembershipRow, OrderStatusRow, NavRowGroup, DetailsTable } from './accounts/profile';

export { homeSdui, sduiSectionOrder, getSduiSection } from './home/sdui';
export type { SduiSection } from './home/sdui';
