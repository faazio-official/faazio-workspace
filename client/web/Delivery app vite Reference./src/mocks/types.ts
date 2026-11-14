export type OrderStatus = "assigned" | "at_store" | "picked_up" | "at_dropoff" | "delivered";
export type PaymentMode = "online" | "cod";
export interface OrderItem { name: string; qty: number; price: number }
export interface Order {
  id: string;
  restaurant: { name: string; address: string; phone: string };
  customer: { name: string; address: string; phone: string };
  items: OrderItem[];
  deliveryFee: number;
  packingCharge: number;
  tip: number;
  payment: PaymentMode;
  type: "Standard" | "Express";
  status: OrderStatus;
  createdAt: string; // ISO
}
export interface Partner {
  initials: string; name: string; role: string; email: string; phone: string;
  delivered: number; rating: number; upiId: string; password: string;
}
