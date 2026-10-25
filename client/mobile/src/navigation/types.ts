import type { NavigatorScreenParams } from '@react-navigation/native';
import type { SubAppId } from '@/state/uiStore';
import type { DietFilter } from '@/state/foodFilterStore';
import type { DiningRestaurant, SpecialDish } from '@/features/food/mocks/types';
import type { MyOrdersStatusFilter } from '@data/types';

export type MainTabParamList = {
  Home: undefined;
  Favourites: undefined;
  You: undefined;
  Cart: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  LanguageSelection: undefined;
  Location: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  SubApp: { subAppId: SubAppId; initialVendorStoreId?: string };
  /**
   * Category drill-in page (opened from the Home/Mart header rail). Renders one
   * main category's subgroups as a plain-text rail, each listing its vendors.
   */
  CategoryDrillIn: {
    /** `CategoryTab.id` of the tapped rail chip, resolved via `MASTER_CATEGORIES[app]`. */
    tabId: string;
    /** Header title — the tapped rail name (never "All Categories"). */
    title: string;
    /** Sub-app whose category tree + product pool backs this page. */
    app: 'FA_MART' | 'PHARMA';
  };
  /** Vendor details page — a single store's products with a live searchbar. */
  VendorDetails: {
    /** Id of the `StoreProfile` to show. */
    storeId: string;
    /** Sub-app the vendor belongs to (drives card render + product pool). */
    app: 'FA_MART' | 'PHARMA';
    /** Pre-applied search query (usually the tapped sub-category name). */
    initialQuery?: string;
  };
  FoodApp: NavigatorScreenParams<FoodStackParamList> | undefined;
  ProductDetail: { product: any };
  /** First-class cross-sub-app search. Food keeps its own nested Search. */
  Search: { subApp: 'HOME' | SubAppId; initialQuery?: string; initialMode?: string };
  /**
   * Central "Your Cart" checkout page, pushed from any app (back returns).
   * Passing `restaurantId` scopes the page to that restaurant's lines (isolated
   * cart). Every caller passes a params object explicitly — `{}` for the common
   * cart, `{ restaurantId, restaurantName }` from a restaurant page — so a stale
   * scope never leaks between entries. (The object stays `| undefined`; a
   * required-param object trips React Navigation's composite navigate typing.)
   */
  Cart: { restaurantId?: string; restaurantName?: string; couponCode?: string } | undefined;
  /** "You" — account page, pushed from any app (back returns). */
  You: undefined;
  /** Pixel-perfect payment method picker (preferred card, UPI, cards, more). */
  PaymentOptions: undefined;
  /** Secure "Add New Card" form (tokenized; PAN/CVV never stored or logged). */
  AddCard: undefined;
  /** "My Profile" — personal info, preferences, security (pushed from Account). */
  UserDetails: undefined;
  /** "Saved Addresses" — manage, select, add delivery locations (pushed from Account). */
  SavedAddresses: undefined;
  /** "My Orders" — status tabs, sort/filter, and order cards (pushed from Account). */
  MyOrders: { initialTab?: MyOrdersStatusFilter; highlightOrderId?: string } | undefined;
  /** Search-results-style Favourites page (pushed from Account). */
  Favourites: undefined;
  /** Per-order detail page, resolved by id from `@data` (pushed from My Orders). */
  OrderDetails: { orderId: string };
  /**
   * Vendor rating form — reachable from every vendor surface (My Orders, Order
   * Details, Mart vendor, Pharma shop, Food restaurant). Verified buyers only;
   * the gate is re-checked inside the screen.
   */
  RateVendor: { vendorId: string; vendorName?: string };
  /** Blood Donor registration wizard + registered dashboard (pushed from Pharma). */
  BloodDonor: undefined;
  /** Targeted donor profile opened from Ask Blood matching results. */
  BloodDonorDetails: {
    donorId: string;
    requestCity: string;
    bloodGroup: import('@data/index').BloodGroup;
    /**
     * Provenance of the search that opened this route. `live`/`empty-authoritative` restricts
     * resolution to server rows (unknown id = honest missing), so a fixture donor is never shown as
     * if consented live; `offline-fallback` also allows the fixture directory.
     */
    source?: import('@/services/api/GatewayClient').ReadSource;
  };
  /**
   * Blood request detail (pushed from the donor dashboard). `source` carries the provenance of the
   * board the tap came from so a cold deep link waits for the live board and never renders a fixture
   * row as if it were server-authoritative.
   */
  BloodRequestDescription: {
    requestId: string;
    source?: import('@/services/api/GatewayClient').ReadSource;
  };
  /** Pharma store profile with products and prescription entry point. */
  MedicalShopDetails: { storeId: string };
  /** FaazioRewards — coins, order streak, and the streak discount card. */
  FaazioRewards: undefined;
  /** Seller onboarding wizard: business, payout, private-bucket KYC and OTP signature. */
  SellWithUs: undefined;
  /** Seller: file a platform-fee change request (admin approval required). */
  SellerPlatformFeeRequest: {
    sellerId?: string;
    currentFeePct?: number;
    category?: string;
  };
  /** Admin platform-fee review queue (DISTRICT_ADMIN scoped / SUPER_ADMIN all). Role-gated in-screen. */
  FeeChangeRequests: undefined;
  /** Admin application queue (DISTRICT_ADMIN scoped / SUPER_ADMIN all). Role-gated in-screen. */
  SellerRequests: undefined;
  /** One seller application review with KYC verification + activation. Role-gated in-screen. */
  SellerRequestDetail: { sellerId: string };
  /**
   * Deals landing page — one page, four entry modes:
   * - `campaign`: a brand campaign's products (from the Home "Deals of the day" carousel).
   * - `discounts`: a vendor's discounted products (from the Mart vendor profile "View All").
   * - `martDeals` / `martEssentials`: a Mart rail's full product list (from the rail "View All"),
   *   supplied as `productIds` resolved through the catalog (no Home-owned fixture).
   */
  DealsLanding: {
    mode: 'campaign' | 'discounts' | 'martDeals' | 'martEssentials';
    campaignId?: string;
    storeId?: string;
    /** Explicit catalog id list for the `martDeals` / `martEssentials` modes. */
    productIds?: string[];
    /** Optional display title for a product-list mode (defaults to the rail label). */
    title?: string;
  };
  /** Full-bleed prescription capture flow (camera can't live in the sub-app wrapper). */
  PrescriptionFlow: { presetVendorId?: string } | undefined;
};

export type FoodStackParamList = {
  FoodHome: undefined;
  Search: { initialQuery?: string; initialMode?: string } | undefined;
  /** Full restaurant profile drill-in (hero, menu, floating cart footer). */
  RestaurantProfile: { restaurant: DiningRestaurant };
  /** "View All" — every discounted dish for a restaurant, search-result-style list. */
  RestaurantOffers: { restaurant: DiningRestaurant; offers: SpecialDish[] };
  /** Full restaurant menu page — every dish + its own search bar. */
  RestaurantMenu: { restaurant: DiningRestaurant; dietFilter: DietFilter };
};
