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
  /** The persistent tab navigator (Home · Earnings · Orders · Alerts · Profile). */
  Main: NavigatorScreenParams<DeliveryTabParamList> | undefined;
  Route: undefined;
  /** Full-screen masked call surface (VOIP or PSTN fallback). */
  ActiveCall: undefined;
  EarningsDetail: { orderId: string };
  EditProfile: undefined;
  Settings: undefined;
  Support: undefined;
};
