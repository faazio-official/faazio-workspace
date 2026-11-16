import type { DeliveryVehicleType } from '@/services/api/GatewayClient';

export interface DeliveryVehicleOption {
  id: DeliveryVehicleType;
  label: string;
  /** Hard capacity cap for this vehicle, mirrored from the gateway. */
  cap: number;
}

/** Single source for the rider vehicle options and their capacity caps. */
export const DELIVERY_VEHICLES: DeliveryVehicleOption[] = [
  { id: 'BICYCLE', label: 'Bicycle', cap: 1 },
  { id: 'TWO_WHEELER', label: 'Two-wheeler', cap: 2 },
  { id: 'FOUR_WHEELER', label: 'Four-wheeler', cap: 5 },
];

export function capacityCapFor(vehicle: DeliveryVehicleType): number {
  return DELIVERY_VEHICLES.find((v) => v.id === vehicle)?.cap ?? 2;
}

export function vehicleLabel(vehicle: DeliveryVehicleType): string {
  return (
    DELIVERY_VEHICLES.find((v) => v.id === vehicle)?.label ??
    vehicle.replace(/_/g, ' ').toLowerCase()
  );
}
