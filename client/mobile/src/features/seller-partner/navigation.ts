export type SellerStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Orders: { status?: string } | undefined;
  OrderDetail: { orderId: string };
};
