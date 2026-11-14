export interface TripEstimate { pickupKm: number; dropKm: number; minutes: number; activeMinutes: number; deliveryPin: string }
export const demoTrip: TripEstimate = { pickupKm: 1.1, dropKm: 3.4, minutes: 18, activeMinutes: 24, deliveryPin: "1234" };
export const offerDurationSeconds = 30;
export const deliveryVerificationThreshold = 500;