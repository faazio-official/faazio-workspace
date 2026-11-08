-- 0088_delivery_pickup_qr.sql — seller→rider pickup handover QR.
--
-- The rider scans the seller's order QR at the pickup stop and POST /delivery/pickup/verify
-- validates the signed token before the PICKUP stop may transition AT_PICKUP → PICKED_UP. The
-- token itself is stateless (HMAC over stop id + expiry); only the verification timestamp is
-- persisted here so the status transition gate is auditable. Additive only.

alter table delivery.delivery_stops
  add column if not exists pickup_verified_at timestamptz;

comment on column delivery.delivery_stops.pickup_verified_at is
  'Set when the rider scanned a valid seller pickup QR; required before the PICKUP stop can be PICKED_UP.';
