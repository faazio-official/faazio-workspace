import type { NavigatorScreenParams } from '@react-navigation/native';
import type { SubAppId } from '@/state/uiStore';

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
  Location: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  SubApp: { subAppId: SubAppId };
  FoodApp: NavigatorScreenParams<FoodStackParamList> | undefined;
  ProductDetail: { product: any };
  /** First-class cross-sub-app search. Food keeps its own nested Search. */
  Search: { subApp: 'HOME' | SubAppId; initialQuery?: string };
  /** Central "Your Cart" checkout page, pushed from any app (back returns). */
  Cart: undefined;
};

export type FoodStackParamList = {
  FoodHome: undefined;
  Search: undefined;
  DiningDetail: undefined;
  OrderDetail: undefined;
};
