import type { NavigatorScreenParams } from '@react-navigation/native';
import type { SubAppId } from '@/state/uiStore';
import type { MyOrdersTab } from '@data/types';

export type MainTabParamList = {
  Home: undefined;
  Categories: undefined;
  Favourites: undefined;
  Account: undefined;
  Cart: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  LanguageSelection: undefined;
  Location: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  SubApp: { subAppId: SubAppId };
  /** Universal "Master Categories" screen with a cross-sub-app selector. */
  MasterCategories:
    | {
        initialChip?: 'ALL' | 'FA_MART' | 'GROCERY' | 'PHARMA';
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
  /** Pixel-perfect payment method picker (preferred card, UPI, cards, more). */
  PaymentOptions: undefined;
  /** "Your Details" — personal info, preferences, security (pushed from Account). */
  UserDetails: undefined;
  /** "Saved Addresses" — manage, select, add delivery locations (pushed from Account). */
  SavedAddresses: undefined;
  /** "My Orders" — status tabs, sort/filter, and order cards (pushed from Account). */
  MyOrders: { initialTab?: MyOrdersTab };
};

export type FoodStackParamList = {
  FoodHome: undefined;
  Search: { initialQuery?: string; initialMode?: string } | undefined;
  DiningDetail: { scrollToGrid?: boolean } | undefined;
  OrderDetail: undefined;
};
