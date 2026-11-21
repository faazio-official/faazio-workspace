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
   - With `VITE_GOOGLE_MAPS_API_KEY` set, the Google Maps JS API loads. The visitor types in the
     search field and picks from the suggestion list (`AutocompleteSuggestion`, Places API (New)),
     drags the marker onto the shop door, or presses "Use my current location"; each action
     reverse-geocodes to a street address, state and district readout.
   - The picker uses Places API (New) only. The legacy `places.Autocomplete` widget and the
     `libraries=places` script parameter are retired for new Google Cloud projects, so the loader
     pulls `maps` / `geocoding` / `places` through `importLibrary` and renders suggestions into its
     own listbox — Google's `PlaceAutocompleteElement` would replace the styled field with an
     unstylable web component.
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
- The request body is built by `buildLeadPayload` (`src/lib/leads.ts`). The gateway decodes with
  `DisallowUnknownFields`, so the payload's key set is a wire contract: every key must be declared on
  `createLeadRequest` (`server/gateway/internal/sellers/leads.go`). `source` is **not** sent — the
  handler always stamps it, so provenance cannot be forged by a caller. `src/lib/leads.test.ts` pins
  the payload keys against the Go struct.
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

# 5. Wire contract — the client payload keys vs the Go request struct
cd client/web/landingpage && npx vitest run src/lib/leads.test.ts src/lib/config.test.ts
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
  project, the live page runs the manual-address path (no pin). This is a deployment step, not a
  code gap.
- **The key must be a Places API (New) key.** Enable *Maps JavaScript API*, *Geocoding API* and
  *Places API (New)*, and restrict the key to those three plus the site's HTTP referrers. Enabling
  only the legacy *Places API* is not enough — that surface is retired for new projects and the
  picker's suggestion list will come back empty.

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
