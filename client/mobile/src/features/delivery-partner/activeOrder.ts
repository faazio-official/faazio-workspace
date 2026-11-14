import type { DeliveryOrder } from '@/services/api/GatewayClient';
import type { DeliveryActiveOrder } from '@/state/deliveryPartnerStore';

/**
 * First accepted (in-progress) job → the raised CTA model shown above the bottom bar.
 * Returns null when the rider has no active delivery.
 */
export function activeOrderFrom(orders: DeliveryOrder[]): DeliveryActiveOrder | null {
  const order = orders.find((o) => o.status === 'ACCEPTED');
  return order ? { orderId: order.orderId, label: activeOrderLabel(order) } : null;
}

function activeOrderLabel(order: DeliveryOrder): string {
  const pickup = order.stops.find((s) => s.stopType === 'PICKUP' && s.status !== 'PICKED_UP');
  const drop = order.stops.find((s) => s.stopType === 'DROP');
  if (pickup) return `Pick up from ${pickup.label || pickup.address}`;
  if (drop) return `Deliver to ${drop.label || drop.address}`;
  return 'Active delivery';
}
