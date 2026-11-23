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
   buyers, onboard at your pace), then an **"This is an enquiry, not the application"** notice that
   says plainly that no account or document upload happens here, that the verified application happens
   in the app after the call-back, and links to the seller help centre for anyone who already applied.
2. Below it, two panels set expectations before the form: **"What happens next"** (send the enquiry →
   the partner team calls → finish the application in the app) and **"What you'll need when you
   apply"** (PAN, shop address and an OTP phone, bank passbook, GSTIN if available). Both describe the
   app application, not this form.
3. Visitor fills the enquiry: business name, owner name, category (MART / FOOD / PHARMA), **platform
   fee %** (required, see step 5), contact phone, contact email and optional notes. There is **no
   typed shop-address field** and no typed district field: both are read-only readouts of the location
   the visitor shares (step 4).
4. Visitor shares the shop location — **required**:
   - With `VITE_GOOGLE_MAPS_API_KEY` set, the Google Maps JS API loads. The visitor types in the
     search field and picks from the suggestion list (`AutocompleteSuggestion`, Places API (New)),
     drags the marker onto the shop door, or presses "Use my current location"; each action
     reverse-geocodes to a street address, state and district readout. The district comes from
     `administrative_area_level_3` (the **district**; level 2 in India is the *division*, e.g.
     "Bangalore Division", and is only a fallback) — never from `locality`, so the city cannot be
     filled into the district field.
   - The district's Google `place_id` is captured with the same reverse geocode (a second call with
     `result_type=administrative_area_level_3`; `place_id` is never on `address_components`). This is
     the lead's durable district identity, sent as `districtPlaceId` so the gateway resolves the
     exact row even if the label is spelled or renamed differently.
   - The picker uses Places API (New) only. The legacy `places.Autocomplete` widget and the
     `libraries=places` script parameter are retired for new Google Cloud projects, so the loader
     pulls `maps` / `geocoding` / `places` through `importLibrary` and renders suggestions into its
     own listbox — Google's `PlaceAutocompleteElement` would replace the styled field with an
     unstylable web component.
   - Location is a **hard gate**: the submit button stays disabled and, if the form is submitted
     anyway (Enter in a text field), the page says to share the location first. Without a Maps key, or
     when Maps refuses to initialise (invalid/restricted key, auth failure, 10 s timeout, blocked
     script), the picker panel is replaced with a **prominent fallback** offering `tel:` and `mailto:`
     links to the partner team — no coordinates and no district are invented, and the enquiry cannot
     be sent from this browser.
5. The platform fee is **required**: the admin queue opens the call-back with that number, so an
   enquiry without one forces a second conversation. The field is a whole number 1–100 with a **5%
   floor for FOOD** (the same rule as `validPlatformFee` server-side). A blank or out-of-range value
   is rejected client-side with a field message; the gateway rejects it too.
6. Visitor submits. `src/lib/leads.ts` validates with zod client-side, resolves the pin's district
   name to the master's canonical `stateCode`/`districtCode` via the public district read (below),
   then calls the TanStack Start server function, which posts to the gateway `POST /seller-leads`
   (same-origin proxy; the gateway's CORS allow-list is the portal origin, not `faazio.com`). The
   payload carries `businessAddress`, `districtName`, `districtPlaceId`, `stateName`, the resolved
   `stateCode`/`districtCode` and the coordinates — all from the shared pin, none typed.
7. The gateway validates, resolves the district against its master **by `districtPlaceId` first**
   (then `districtCode`, then `districtName`), applies the per-IP daily cap and inserts the lead. The
   page swaps to the "Enquiry received" card showing the **enquiry reference** (`leadId`) to quote on
   the call, plus `/download` and `/seller-terms` actions.
8. A compact five-question FAQ ("Before you ask") closes the page: enquiry vs application, what
   happens after submit, whether the app is needed first, the shop-location requirement, and cost.

## State

- Local form state only (react-hook-form + `leadSchema`); no store, no session, no cookies.
- The picker's selected point — including `districtName`, `stateName` and `districtPlaceId` — lives
  in `SellerForm` state and is cleared after a successful submit. The visible district and address
  readouts mirror this value; neither is typed.

## Data path

- `submitSellerLead` (server function) → `postSellerLead` (plain handler body) → `POST /seller-leads`
  → `sellers.seller_leads` (`lead_id`, names, category, phone/email, address, resolved
  `state_code`/`district_code`, raw `state_name`/`district_name`, `latitude`/`longitude`,
  `platform_fee_pct`, notes, `status = NEW`, `source = web`, `ip_hash`).
- **District codes are resolved on the client, from the master.** Before posting, `resolveDistrictCodes`
  calls the new public `GET /seller-leads/districts` (in-process geo mirror, active rows only, no DB,
  `Cache-Control: public, max-age=300`, cached in-process for 10 min) and matches the pin's district
  name to `{stateCode, districtCode}`. The codes are then sent so the enquiry carries the identity the
  admin queue scopes on, instead of relying on a server-side name match. The read is best-effort: if
  it fails or the name is not in the master, the codes are omitted and the gateway resolves the name
  itself — an enquiry is never blocked by this read.
- The request body is built by `buildLeadPayload` (`src/lib/leads.ts`). The gateway decodes with
  `DisallowUnknownFields`, so the payload's key set is a wire contract: every key must be declared on
  `createLeadRequest` (`server/gateway/internal/sellers/leads.go`). `source` is **not** sent — the
  handler always stamps it, so provenance cannot be forged by a caller. `src/lib/leads.test.ts` pins
  the payload keys against the Go struct.
- **District resolution:** the gateway resolves the master by `districtPlaceId` (the district's
  Google `place_id`, `WHERE google_place_id = $1`) first, then `districtCode`, then `districtName`.
  This is the fix for name drift — "Bengaluru" vs "Bangalore", "Trichy" vs "Tiruchirappalli" resolve
  to the same row via the id. Only when Google returns no district for the coordinate does the
  `districtName` fallback run.
- No `admins.audit_logs` row: the actor is an anonymous visitor and that table's `actor_role` check
  only accepts seller/admin roles. The lead row (with the IP hash) is the trail.
- Rate limit: `faazio:v1:sellers:lead:{ipHash}:{yyyymmdd}` via `cache.Incr`, TTL 24 h, 5 per UTC day,
  fail-open when Valkey is unavailable.
- No fixture or client-side lead store is used anywhere.

## Success / error / empty

- **Success:** `201` with `{leadId, status}`; the page shows the enquiry-received card and the
  reference to quote on the call.
- **Bot:** the hidden `website` honeypot is non-empty → the gateway returns a silent `201` with no
  row written, and the client shows the same success card (without a reference, since none exists).
- **Error:**
  - `400 bad_request` — a missing/oversized field, an invalid category, a phone with fewer than 10
    digits, an invalid email, a half-supplied coordinate pair, a **missing platform fee**, a fee
    outside the category range, or a malformed `stateCode`.
  - `400 unknown_district` — a `districtPlaceId` or explicit `districtCode` that matches no active
    `admins.district_master` row.
  - `429 rate_limited` — more than 5 enquiries from one IP in a UTC day.
  - `500 lead_unavailable` — the insert failed; the visitor is asked to retry.
- **Empty:** location is required, so there is no "no pin" path — the submit button stays disabled
  until a location with a district is shared, and a submit without one is rejected client-side with a
  prompt to share it. When Maps is unavailable the enquiry cannot be sent from the browser at all
  (the panel gives our email/phone instead). This is stricter than the old intake, which accepted a typed
  address with no pin.

## Testing the intake

Three layers, cheapest first. A green run at a lower layer does **not** prove the layer above it.

```bash
# 1. Handler logic, no DB — validation, honeypot, district, fee gate, rate-limit boundary (~0.01s)
cd server/gateway && go test ./internal/sellers/ -run 'TestCreateLead'

# 2. Real SQL — the insert, the queue reads, the district filter, the lead→seller back-fill
docker compose up -d postgres valkey
TEST_DATABASE_URL='postgres://postgres:faazio@localhost:5432/faazio?sslmode=disable' \
TEST_VALKEY_URL='redis://localhost:6379/0' \
  go test -count=1 ./internal/sellers/

# 3. Live HTTP, public half — the whole response matrix against a running gateway
./scripts/simulate-seller-lead.sh http://localhost:8080

# 4. Live HTTP, admin half — the full lifecycle in the super-admin queue (needs portal auth)
PORTAL_EMAIL=... PORTAL_PASSWORD=... \
  ./scripts/simulate-seller-lead-queue.sh http://localhost:8080

# 5. Wire contract — the client payload keys vs the Go request struct, plus the handler body
cd client/web/landingpage && npx vitest run src/lib/leads.test.ts src/lib/config.test.ts \
  src/components/sell-with-us/seller-form.test.tsx
```

`testenv.Pool` **skips** DB tests when `TEST_DATABASE_URL` is unset, and the package still reports
`ok` — a green `go test ./internal/sellers/` without that variable proves only the no-DB paths. Count
the skips (`go test -v … | grep -c SKIP`) before trusting a run.

`simulate-seller-lead-queue.sh` signs in as a real `SUPER_ADMIN` and asserts: the lead appears in the
NEW queue, claim records an owner, the note and reviewer persist, a reject needs a reason, a rejected
lead can be re-opened, the final approve sets `APPROVED` and creates **no** seller account, unknown
ids are 404s, and `?district=` narrows the queue without letting a scoped admin widen it.

## Known gaps

- **Map key is not configured in the repo.** Until `VITE_GOOGLE_MAPS_API_KEY` is set on the Vercel
  project, the picker cannot run and the enquiry form is blocked (location is mandatory) — the page
  shows the phone/email fallback. This is a deployment step, not a code gap. (It is set in the current
  deployment environment; a fresh clone or preview without it still hits the fallback.)
- **The key must be a Places API (New) + Geocoding key.** Enable *Maps JavaScript API*, *Geocoding
  API* and *Places API (New)*, and restrict the key to those three plus the site's HTTP referrers.
  Enabling only the legacy *Places API* is not enough — that surface is retired for new projects and
  the picker's suggestion list will come back empty.
- **Reverse geocodes are two calls per pin.** The address lookup and the district-`place_id` lookup
  are separate (Google does not return `place_id` on `address_components`). This doubles the
  geocoding bill per shared location; acceptable at the landing page's volume, worth batching if it
  ever becomes a hot path.

## Lead → application link

An approved lead is linked to the application it becomes. When `POST /sellers` arrives with the same
contact phone or email as an open lead, `Repo.LinkLeadToSeller` (0113) back-fills
`sellers.seller_leads.seller_id`, so the admin queue shows the enquiry as applied instead of going
stale. The link is best-effort: a failed link is audited as `SELLER_LEAD_LINK_FAILED` and never fails
the application. The merchant still re-enters their details in the mobile `SellWithUs` flow — the
link records the outcome, it does not pre-fill the form.

## Linked docs

- [`seller-lead-queue.md`](./seller-lead-queue.md) — the admin follow-up queue for these leads.
- [`seller-registration.md`](./seller-registration.md) — the KYC-complete mobile application.
- [`index.md`](./index.md) — the onboarding domain index.
- `server/gateway/scripts/simulate-seller-lead.sh` — the live-HTTP simulation above.
- `docs/architecture/db-schema.md` §12.41, `monolith-breakdown.md` §1 (sellers row),
  `caching-cloudflare-valkey.md` §5.
