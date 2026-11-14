import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * The five persistent bottom-tab destinations. Route names are the tab keys, so the
 * shared bottom bar (`DPBottomNav`) and the tab navigator stay in lockstep.
 */
export type DeliveryTabParamList = {
  Dashboard: undefined;
  Payouts: undefined;
  OrderHistory: undefined;
  Notifications: undefined;
  RiderProfile: undefined;
};

export type DeliveryPartnerStackParamList = {
  PhoneEntry: undefined;
  OtpVerify: { phone: string };
  Register: undefined;
  SubmissionSuccess: undefined;
  AcceptReject: { orderId: string; expiresAt?: string };
  /** The persistent tab navigator (Feed · Pocket · Orders · Inbox · More). */
  Main: NavigatorScreenParams<DeliveryTabParamList> | undefined;
  Route: undefined;
  EarningsDetail: { orderId: string };
  Settings: undefined;
  Support: undefined;
};
