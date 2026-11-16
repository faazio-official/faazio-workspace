import type { DeliveryStop } from '@/services/api/GatewayClient';

/**
 * A stop that no longer needs action, shared by the Dashboard route card and the
 * Route screen. Kept next to the other delivery-order helpers so both surfaces
 * agree on what "done" means (`DELIVERED` or `FAILED`).
 */
export function isStopDone(status: DeliveryStop['status']): boolean {
  return status === 'DELIVERED' || status === 'FAILED';
}