import { describe, expect, it } from "vitest";
import { demoTrip, historyOrders, incomingPool, offerDurationSeconds, type Order } from "@/mocks";
import { earnings, grandTotal, needsPin, nextStatus } from "@/lib/partner/rules";

const base = incomingPool[0];
if (!base) throw new Error("Missing mock offer");
const order: Order = { ...base, createdAt: "2026-11-14T10:00:00", status: "assigned" };
describe("Delivery safeguards", () => {
  it("uses a 30-second offer window", () => expect(offerDurationSeconds).toBe(30));
  it("requires arrival at the store before pickup", () => expect(nextStatus(order, [], "", false)).toBe("at_store"));
  it("blocks pickup until every item is checked", () => {
    expect(nextStatus({ ...order, status: "at_store" }, [order.items[0]?.name ?? ""], "", false)).toBeNull();
    expect(nextStatus({ ...order, status: "at_store" }, order.items.map((i) => i.name), "", false)).toBe("picked_up");
  });
  it("requires arrival at drop-off before delivery", () => expect(nextStatus({ ...order, status: "picked_up" }, [], "", false)).toBe("at_dropoff"));
  it("requires the correct four-digit PIN for cash deliveries", () => {
    expect(nextStatus({ ...order, status: "at_dropoff" }, [], "9999", true)).toBeNull();
    expect(nextStatus({ ...order, status: "at_dropoff" }, [], demoTrip.deliveryPin, true)).toBe("delivered");
  });
  it("requires cash collection confirmation", () => expect(nextStatus({ ...order, status: "at_dropoff" }, [], demoTrip.deliveryPin, false)).toBeNull());
  it("requires a PIN for online orders worth at least ₹500", () => {
    expect(needsPin({ ...order, payment: "online", items: [{ name: "Meal", qty: 1, price: 435 }] })).toBe(true);
    expect(needsPin({ ...order, payment: "online", items: [{ name: "Meal", qty: 1, price: 434 }] })).toBe(false);
  });
  it("keeps earnings separate from customer payment", () => {
    expect(earnings(order)).toBe(50);
    expect(grandTotal(order)).toBe(245);
  });
  it("does not progress an already delivered order", () => {
    const completed = historyOrders[0];
    if (!completed) throw new Error("Missing completed order");
    expect(nextStatus(completed, [], demoTrip.deliveryPin, true)).toBeNull();
  });
});