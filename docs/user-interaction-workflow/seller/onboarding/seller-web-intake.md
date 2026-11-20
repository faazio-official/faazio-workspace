# Seller web intake — landing-page "Sell with us" enquiry

**App / route:** landing page `/sell-with-us` (`client/web/landingpage/src/routes/sell-with-us.tsx`)
**Status:** Shipped. The enquiry creates a `sellers.seller_leads` row; it is **not** a seller account
and never collects PAN, GSTIN, FSSAI, bank or passbook details — those stay in the KYC-complete
mobile application (`seller-registration.md`). Admins work the enquiry in the portal queue
(`seller-lead-queue.md`); approving a lead records intent only and never creates a seller.
**Trigger:** the "Sell with us" link in the landing-page header/footer, or the seller CTA on
`/partners`.

## Steps

1. Visitor opens `/sell-with-us` and reads the pitch (three benefit cards: be found nearby, repeat
   buyers, onboard at your pace).
2. Visitor fills the enquiry: business name, owner name, category (MART / FOOD / PHARMA), contact
   phone, contact email, shop address (required), district (required) and optional notes.
3. Visitor locates the shop in the map panel:
   - With `VITE_GOOGLE_MAPS_API_KEY` set, the Google Maps JS API loads. The visitor searches a place
     (Places Autocomplete), drags the marker onto the shop door, or presses "Use my current
     location"; each action reverse-geocodes to a street address, state and district readout.
   - Without a key the map panel is not rendered at all: the address + district fields carry the
     enquiry and the lead is stored with **no** pin. If a key is set but Maps refuses to initialise
     (invalid/restricted key, auth failure, 10 s timeout, blocked script), the panel collapses to the
     same single-column form with a short notice. Coordinates are never invented.
4. Visitor submits. `src/lib/leads.ts` validates with zod client-side, then calls the TanStack Start
   server function, which posts to the gateway `POST /seller-leads` (same-origin proxy; the
   gateway's CORS allow-list is the portal origin, not `faazio.com`).
5. The gateway validates, resolves the district against its master, applies the per-IP daily cap and
   inserts the lead. The page swaps to the "Enquiry received" card with `/download` and
   `/seller-terms` actions.

## State

- Local form state only (react-hook-form + `leadSchema`); no store, no session, no cookies.
- The picker's selected point lives in `SellerForm` state and is cleared after a successful submit.

## Data path

- `submitSellerLead` (server function) → `POST /seller-leads` → `sellers.seller_leads`
  (`lead_id`, names, category, phone/email, address, resolved `state_code`/`district_code`, raw
  `state_name`/`district_name`, optional `latitude`/`longitude`, optional `platform_fee_pct`,
  notes, `status = NEW`, `source = web`, `ip_hash`).
- No `admins.audit_logs` row: the actor is an anonymous visitor and that table's `actor_role` check
  only accepts seller/admin roles. The lead row (with the IP hash) is the trail.
- Rate limit: `faazio:v1:sellers:lead:{ipHash}:{yyyymmdd}` via `cache.Incr`, TTL 24 h, 5 per UTC day,
  fail-open when Valkey is unavailable.
- No fixture or client-side lead store is used anywhere.

## Success / error / empty

- **Success:** `201` with `{leadId, status}`; the page shows the enquiry-received card.
- **Bot:** the hidden `website` honeypot is non-empty → the gateway returns a silent `201` with no
  row written, and the client shows the same success card.
- **Error:**
  - `400 bad_request` — a missing/oversized field, an invalid category, a phone with fewer than 10
    digits, an invalid email, a half-supplied coordinate pair, or a platform fee outside the
    category range. The page says to check the phone, email and district.
  - `400 unknown_district` — an explicit `districtCode` not in `admins.district_master`.
  - `429 rate_limited` — more than 5 enquiries from one IP in a UTC day.
  - `500 lead_unavailable` — the insert failed; the visitor is asked to retry.
- **Empty:** no pin picked → the lead is still valid with the typed address + district; the admin
  sees a lead without coordinates. A missing address or district is a `400` (the client marks both
  required before the request is sent).

## Known gaps

- **Map key is not configured in the repo.** Until `VITE_GOOGLE_MAPS_API_KEY` is set on the Vercel
  project, the live page runs the manual-address path (no pin). This is a deployment step, not a
  code gap.
- An approved lead is **not** linked to the application it becomes: the merchant re-enters their
  details in the mobile `SellWithUs` flow, and nothing back-fills `sellers.seller_leads` with the
  resulting `seller_id`.

## Linked docs

- [`seller-lead-queue.md`](./seller-lead-queue.md) — the admin follow-up queue for these leads.
- [`seller-registration.md`](./seller-registration.md) — the KYC-complete mobile application.
- [`index.md`](./index.md) — the onboarding domain index.
- `docs/architecture/db-schema.md` §12.41, `monolith-breakdown.md` §1 (sellers row),
  `caching-cloudflare-valkey.md` §5.
