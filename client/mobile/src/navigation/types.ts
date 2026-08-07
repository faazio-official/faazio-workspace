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
};

export type FoodStackParamList = {
  FoodHome: undefined;
  Search: undefined;
  DiningDetail: undefined;
  OrderDetail: undefined;
};
