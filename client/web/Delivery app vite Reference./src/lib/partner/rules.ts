import { deliveryVerificationThreshold, demoTrip, type Order, type OrderStatus } from "@/mocks";

export const itemTotal = (o: Order) => o.items.reduce((sum, item) => sum + item.qty * item.price, 0);
export const grandTotal = (o: Order) => itemTotal(o) + o.deliveryFee + o.packingCharge + o.tip;
export const earnings = (o: Order) => o.deliveryFee + o.tip;
export const stages: OrderStatus[] = ["assigned", "at_store", "picked_up", "at_dropoff", "delivered"];
export const needsPin = (o: Order) => o.payment === "cod" || grandTotal(o) >= deliveryVerificationThreshold;
export function nextStatus(o: Order, checked: string[], pin: string, cashCollected: boolean): OrderStatus | null {
  if (o.status === "delivered") return null;
  if (o.status === "at_store" && !o.items.every((item) => checked.includes(item.name))) return null;
  if (o.status === "at_dropoff" && needsPin(o) && pin !== demoTrip.deliveryPin) return null;
  if (o.status === "at_dropoff" && o.payment === "cod" && !cashCollected) return null;
  return stages[stages.indexOf(o.status) + 1] ?? null;
}