-- Faazio — login-ready delivery test account (server-driven, no mocks).
-- Authority: docs/user-interaction-workflow/delivery/onboarding/rider-registration.md,
--            client/mobile/docs/TEST_ACCOUNTS.md.
--
-- Why: the delivery partner app routes on `GET /delivery/me` (RiderByPhone):
--   ACTIVE  -> Dashboard
--   other   -> SubmissionSuccess ("under review")
--   404     -> Register
-- Without a `delivery.delivery_boys` row for the Firebase test number, sign-in always lands on
-- Register. This seed creates the ACTIVE rider so the real OTP login flow reaches the Dashboard
-- with no fixture, no mock latency and no client-side bypass.
--
-- PHONE FORMAT IS LOAD-BEARING. `delivery.NormalizePhone` (internal/delivery/models.go) strips
-- non-digits and returns `+91` + the 10-digit national number — no spaces, no dashes. A row stored
-- as '+91 9876543210' would never match the authenticated phone and every rider call would 404.
-- The canonical stored form is therefore '+919876543210'.
--
-- user_id / auth_uid are intentionally left NULL: `checkout.ProvisionUserID` provisions
-- `checkout.users` and `accounts.profile` only — it does NOT backfill delivery_boys. Rider identity
-- resolves by phone, so login works immediately; the columns stay NULL until a rider-facing
-- linkage is built (tracked in docs/user-interaction-workflow/KNOWN_GAPS.md).
--
-- Idempotent: re-runnable. ON CONFLICT (phone) targets the unique index
-- delivery_boys_phone_idx (0042:98). Re-running resets the row to the known test state — including
-- `is_available = false`, so a rider who had gone online is taken offline again. That is deliberate
-- for a test account (a predictable starting state), but do not re-run this while a manual test
-- session is in progress.
-- NOT a runtime origin: this is bootstrap test data, applied from a dev terminal.

insert into delivery.delivery_boys (
  rider_id, user_id, auth_uid, phone, full_name, state_code, hub_zone,
  address, city, pincode, emergency_contact, vehicle_type, max_capacity,
  status, is_available, current_load, rating, completed_orders
) values (
  'rider-test-faazio-01', null, null, '+919876543210',
  'Faazio Delivery Test', 'TN', 'Tiruchirappalli',
  'Test Address, Test City', 'Tiruchirappalli', '620001', '+919876543210',
  'TWO_WHEELER', 2,
  'ACTIVE', false, 0, 0.0, 0
)
on conflict (phone) do update set
  status           = 'ACTIVE',
  full_name        = excluded.full_name,
  state_code       = excluded.state_code,
  hub_zone         = excluded.hub_zone,
  address          = excluded.address,
  city             = excluded.city,
  pincode          = excluded.pincode,
  emergency_contact = excluded.emergency_contact,
  vehicle_type     = excluded.vehicle_type,
  max_capacity     = excluded.max_capacity,
  is_available     = false,
  current_load     = 0,
  rejection_reason = '',
  updated_at       = now();
