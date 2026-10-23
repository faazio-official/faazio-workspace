export type DeliveryPartnerStackParamList = {
  PhoneEntry: undefined;
  OtpVerify: { phone: string };
  Register: undefined;
  SubmissionSuccess: undefined;
  AcceptReject: { orderId: string; expiresAt?: string };
  Dashboard: undefined;
  Route: undefined;
  Payouts: undefined;
};
