export type DeliveryPartnerStackParamList = {
  PhoneEntry: undefined;
  OtpVerify: { phone: string };
  Register: undefined;
  SubmissionSuccess: undefined;
  AcceptReject: { orderId: string; expiresAt?: string };
  Dashboard: undefined;
  Route: undefined;
  Payouts: undefined;
  // Added tabs / detail routes (additive — existing routes unchanged).
  OrderHistory: undefined;
  Notifications: undefined;
  RiderProfile: undefined;
  Settings: undefined;
  Support: undefined;
  EarningsDetail: { orderId: string };
};
