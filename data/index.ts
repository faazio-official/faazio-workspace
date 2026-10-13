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

export { foodProducts, topOfWeekDishes } from './food/products';
export { foodStores } from './food/stores';
export { BOOKING_DISHES_DB } from './food/bookingDishes';
export { TODAYS_SPECIALS, dishToProduct } from './food/specials';
export { restaurantMenus, allRestaurantMenuDishes } from './food/menus';

export { pharmaProducts, PHARMA_PRODUCTS_DB, PHARMA_CATEGORIES } from './pharma/products';
export { pharmaStores } from './pharma/stores';
export { PHARMA_RECENT_ORDERS } from './pharma/recentOrders';
export type { PharmaRecentOrder } from './pharma/recentOrders';
export {
  BLOOD_DONOR_STEPS,
  BLOOD_GROUPS,
  BLOOD_DONOR_BANNER,
  AGE_RANGES,
  YES_NO_OPTIONS,
  HEALTH_YESNO_QUESTIONS,
  WEIGHT_LIMITS,
  DONATION_TYPES,
  LOCATION_MIN_LENGTH,
  NOTIFICATION_SOURCES,
  NOTIFICATIONS_BANNER,
  CONSENT_LABEL,
  PRIVACY_NOTE,
} from './pharma/bloodDonor';
export type {
  BloodGroup,
  YesNo,
  AgeRangeId,
  DonationTypeId,
  NotificationSourceId,
  BloodDonorDraft,
  BloodDonorRegistration,
  BloodDonorStep,
  HealthYesNoQuestion,
} from './pharma/bloodDonor';

export {
  BLOOD_REQUESTS,
  BLOOD_DONOR_UNREAD_ALERTS,
  BLOOD_REQUEST_DETAIL_COPY,
  ASK_BLOOD_COPY,
} from './pharma/bloodRequests';
export type { BloodRequest, BloodRequestUrgency, DonorMatchRequest } from './pharma/bloodRequests';
export { BLOOD_DONORS } from './pharma/bloodDonors';
export type { DonorProfile } from './pharma/bloodDonors';

export { exploreStacks } from './explore/stacks';

export { categoriesSearchDatabase } from './categories/searchDatabase';

export { portalSectors, topAdSlides, sponsoredAds, recentlyViewedHistory, todaysOffers, mixedRecommendations, popularDining, recentlyViewedMart, recentlyViewedFood, recentlyViewedPharma, hotBrandDeals, faMartFinds, restaurantSpecials } from './home/rails';

export { homeSections } from './home/sections';
export type { HomeSectionKind } from './home/sections';

export { nearbyOffers } from './home/nearbyOffers';

export { adCampaigns, getCampaignProducts, getCampaignStore, carouselOneCampaigns, carouselTwoCampaigns } from './home/campaigns';
export type { AdCampaign } from './types';

export { mensPicks, womensPicks, childrensPicks, hairSkinPicks } from './home/demographics';
export { instantFeed } from './home/instantFeed';

export { avatarMap, getProductReviews, getProductSpecs, getProductHighlights } from './productMeta/reviews';

export { defaultAddresses } from './cart/addresses';
export { coupons } from './cart/coupons';
export { getPickupPointsForItems, getStoreIdsForItems, NEUTRAL_PICKUP } from './cart/pickup-resolver';

export { pastOrders, myOrders, myOrdersStatusFilters, getMyOrderById } from './account/orders';
export { userProfile, saverMembership } from './account/profile';
export { orderStatusCounts } from './account/orderStatus';
export { accountNavGroups } from './account/accountNav';
export { accountDetails } from './account/details';

export {
  COIN_EARN_RATE,
  COIN_REDEEM_RATE,
  COIN_REDEEM_MIN,
  STREAK_TARGET_DAYS,
  DISCOUNT_CARD_PERCENT,
  DISCOUNT_CARD_VALIDITY_DAYS,
} from './rewards/rewards';
export type { FaazioDiscountCard } from './rewards/rewards';

export { SELLER_SETUP_FIELDS } from './seller/sellerSetup';
export type { SellerSetupField } from './seller/sellerSetup';
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

export {
  vendorDirectory,
  getVendorById,
  findVendorByName,
  resolveVendorForProduct,
  resolveVendorIdForProduct,
  resolveVendorIdByName,
} from './directory/vendors';
export type { VendorRef } from './directory/vendors';

export { diningVenues, getDiningVenueById, findDiningVenueByName } from './food/diningVenues';
export type { DiningVenue } from './food/diningVenues';

export { reviewsTable, specsTable, highlightsTable, getReviewsByProductId } from './reviews/reviews';
export type { ReviewRow, SpecRow, HighlightRow } from './reviews/reviews';

export { vendorReviewsTable, getReviewsByVendorId } from './reviews/vendorReviews';
export type { VendorReviewRow } from './reviews/vendorReviews';

export { stockTable, getStockByProductId, getStockByProductIds } from './inventory/stock';
export type { StockRow } from './inventory/stock';

export {
  usersTable,
  addressesTable,
  couponsTable,
  ordersTable,
  getOrdersByUser,
  hasPurchasedFromVendor,
  getVendorOrderIds,
  MOCK_USER_ID,
} from './checkout/orders';
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

export { seedCartItems, seedFavorites, seedLocation } from './home/seeds';
