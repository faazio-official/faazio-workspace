import type { NavigatorScreenParams } from '@react-navigation/native';
import type { SubAppId } from '@/state/uiStore';
import type { MyOrdersStatusFilter } from '@data/types';

export type MainTabParamList = {
  Home: undefined;
  Categories: undefined;
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
  /** Universal "Master Categories" screen with a cross-sub-app selector. */
  MasterCategories:
    | {
        initialChip?: 'ALL' | 'FA_MART' | 'PHARMA';
        /** Deep-link: sidebar tab id to mount as active (e.g. from a home rail card). */
        initialTabId?: string;
      }
    | undefined;
  FoodApp: NavigatorScreenParams<FoodStackParamList> | undefined;
  ProductDetail: { product: any };
  /** First-class cross-sub-app search. Food keeps its own nested Search. */
  Search: { subApp: 'HOME' | SubAppId; initialQuery?: string; initialMode?: string };
  /** Central "Your Cart" checkout page, pushed from any app (back returns). */
  Cart: undefined;
  /** "You" — account page, pushed from any app (back returns). */
  You: undefined;
  /** Pixel-perfect payment method picker (preferred card, UPI, cards, more). */
  PaymentOptions: undefined;
  /** "my profile" — personal info, preferences, security (pushed from Account). */
  UserDetails: undefined;
  /** "Saved Addresses" — manage, select, add delivery locations (pushed from Account). */
  SavedAddresses: undefined;
  /** "My Orders" — status tabs, sort/filter, and order cards (pushed from Account). */
  MyOrders: { initialTab?: MyOrdersStatusFilter } | undefined;
  /** Per-order detail page, resolved by id from `@data` (pushed from My Orders). */
  OrderDetails: { orderId: string };
  /** Blood Donor registration wizard + registered dashboard (pushed from Pharma). */
  BloodDonor: undefined;
  /** Blood request detail placeholder (pushed from the donor dashboard). */
  BloodRequestDescription: { requestId: string };
  /** FaazioRewards — coins, order streak, and the streak discount card. */
  FaazioRewards: undefined;
  /** Mock "Sell with us" partner onboarding — required details (no backend yet). */
  SellWithUs: undefined;
};

export type FoodStackParamList = {
  FoodHome: undefined;
  Search: { initialQuery?: string; initialMode?: string } | undefined;
  DiningDetail: { scrollToGrid?: boolean } | undefined;
  /** Full restaurant profile drill-in (hero, menu, floating cart footer). */
  RestaurantProfile: { restaurant: any };
  OrderDetail: undefined;
};
