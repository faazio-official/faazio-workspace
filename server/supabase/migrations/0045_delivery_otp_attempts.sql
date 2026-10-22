-- 0045_delivery_otp_attempts.sql — bound brute-force attempts on the 4-digit handover OTP.
--
-- The rider verifies the customer's OTP through POST /delivery/otp/verify. A 4-digit space is only
-- 10,000 codes, so an authenticated rider could otherwise exhaust it inside the 10-minute validity
-- window. Every verification attempt increments this counter atomically; the gateway locks the stop
-- after 5 attempts (HTTP 429 otp_locked) and clears the OTP fields on successful delivery so a code
-- can never be replayed. Additive only.

alter table delivery.delivery_stops
  add column if not exists otp_attempts int4 not null default 0
    check (otp_attempts >= 0);

comment on column delivery.delivery_stops.otp_attempts is
  'Failed+total OTP verification attempts; the gateway rejects further attempts at 5. Reset on delivery.';
