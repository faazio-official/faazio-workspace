# Seller web intake — landing-page "Sell with us" enquiry

**App / route:** landing page `/sell-with-us` (`client/web/landingpage/src/routes/sell-with-us.tsx`)
**Status:** Shipped. The enquiry creates a `sellers.sellers` row with `status = 'INQUIRY'` and
`source = 'web'` (migration `0129`). It is **not** a KYC application and never collects PAN, GSTIN,
FSSAI, bank or passbook details — those stay in the KYC-complete mobile application
(`seller-registration.md`). Admins work the enquiry in the portal queue (`seller-inquiry-queue.md`);
promoting it records that the merchant is proceeding and hands the same row to normal seller review.
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
3. Visitor fills the enquiry: owner name, category (MART / FOOD / PHARMA), **platform
   fee %** (required, see step 5), contact phone, contact email, **shop photos** (step 4a) and optional
   notes. There is **no typed shop-address field** and no typed district field: both are read-only
   readouts of the location the visitor shares (step 4).
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
     the enquiry's durable district identity, sent as `districtPlaceId` so the gateway resolves the
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
4a. Visitor adds **at least one photo of the shop front** (maximum 5) via `ShopPhotosField`. Each
   photo is downscaled on a canvas to ≤1600px, then sent through the `uploadShopPhoto` server
   function to `POST /media/avif`, which decodes the JPEG/PNG, re-encodes AVIF **from pixels** (so
   EXIF/GPS never reaches storage) and returns `{assetId, key, url}`. The enquiry carries the photo
   ids as `shopPhotoIds`; the create call claims those drafts inside its own transaction. A shop with
   no picture is not reviewable, so an empty gallery is rejected client- and server-side
   (`400 bad_request`).
5. The platform fee is **required**: the admin queue opens the call-back with that number, so an
   enquiry without one forces a second conversation. The field is a whole number 1–100 with a **5%
   floor for FOOD** (the same rule as `validPlatformFee` server-side). A blank or out-of-range value
   is rejected client-side with a field message; the gateway rejects it too.
6. Visitor submits. `src/lib/inquiries.ts` validates with zod client-side, resolves the pin's district
   name to the master's canonical `stateCode`/`districtCode` via the public district read (below),
   then calls the TanStack Start server function, which posts to the gateway `POST /seller-inquiries`
   (same-origin proxy; the gateway's CORS allow-list is the portal origin, not `faazio.com`). The
   payload carries `businessAddress`, `districtName`, `districtPlaceId`, `stateName`, the resolved
   `stateCode`/`districtCode`, the coordinates and `shopPhotoIds` — all from the shared pin and the
   uploaded photos, none typed.
7. The gateway validates, resolves the district against its master **by `districtPlaceId` first**
   (then `districtCode`, then `districtName`), claims the photos, applies the per-IP daily cap and
   inserts the `INQUIRY` row. The page swaps to the "Enquiry received" card showing the **enquiry
   reference** (`sellerId`) to quote on the call, plus `/download` and `/seller-terms` actions.
8. A compact five-question FAQ ("Before you ask") closes the page: enquiry vs application, what
   happens after submit, whether the app is needed first, the shop-location requirement, and cost.

## State

- Local form state only (react-hook-form + `inquirySchema`); no store, no session, no cookies.
- The picker's selected point — including `districtName`, `stateName` and `districtPlaceId` — lives
  in `SellerForm` state and is cleared after a successful submit. The visible district and address
  readouts mirror this value; neither is typed. The uploaded `shopPhotos` refs live in the same form
  state.

## Data path

- `submitSellerInquiry` (server function) → `postSellerInquiry` (plain handler body) → `POST
  /seller-inquiries` → `sellers.sellers` (status `INQUIRY`, `source = web`, names, category,
  phone/email, address, resolved `state_code`/`district_code`, `latitude`/`longitude`,
  `inquiry_platform_fee_pct`, `inquiry_notes`, `shop_photos`) plus the claimed `SHOP` `media.assets`.
- **Photos are AVIF only.** `uploadShopPhoto` → `POST /media/avif` (the one route accepting image
  bytes; browsers and React Native cannot encode AVIF) → `internal/platform/imgconv` → a PUBLIC SHOP
  `media.assets` draft. The create call promotes those drafts to ACTIVE via `contracts.PhotoClaimer`,
  so a row can never point at an asset the submitter did not upload.
- **District codes are resolved on the client, from the master.** Before posting,
  `resolveDistrictCodes` calls the public `GET /seller-inquiries/districts` (in-process geo mirror,
  active rows only, no DB, `Cache-Control: public, max-age=300`, cached in-process for 10 min) and
  matches the pin's district name to `{stateCode, districtCode}`. The codes are then sent so the
  enquiry carries the identity the admin queue scopes on, instead of relying on a server-side name
  match. The read is best-effort: if it fails or the name is not in the master, the codes are omitted
  and the gateway resolves the name itself — an enquiry is never blocked by this read.
- The request body is built by `buildInquiryPayload` (`src/lib/inquiries.ts`). The gateway decodes
  with `DisallowUnknownFields`, so the payload's key set is a wire contract: every key must be
  declared on `createInquiryRequest` (`server/gateway/internal/sellers/inquiry.go`). `source` is
  **not** sent — the handler always stamps it, so provenance cannot be forged by a caller.
  `src/lib/inquiries.test.ts` pins the payload keys against the Go struct.
- **District resolution:** the gateway resolves the master by `districtPlaceId` (the district's
  Google `place_id`) first, then `districtCode`, then `districtName`. This is the fix for name drift —
  "Bengaluru" vs "Bangalore", "Trichy" vs "Tiruchirappalli" resolve to the same row via the id. Only
  when Google returns no district for the coordinate does the `districtName` fallback run.
- No `admins.audit_logs` row: the actor is an anonymous visitor and that table's `actor_role` check
  only accepts seller/admin roles. The row itself (with the IP hash) is the trail.
- Rate limit: `faazio:v1:sellers:lead:{ipHash}:{yyyymmdd}` via `cache.Incr`, TTL 24 h, 5 per UTC day,
  fail-open when Valkey is unavailable. `POST /media/avif` has its own 30/day per-IP cap
  (`faazio:v1:media:avif:*`).
- No fixture or client-side enquiry store is used anywhere.

## Success / error / empty

- **Success:** `201` with `{sellerId, status, shopPhotos}`; the page shows the enquiry-received card
  and the reference to quote on the call.
- **Bot:** the hidden `website` honeypot is non-empty → the gateway returns a silent `201` with no
  row written, and the client shows the same success card (without a reference, since none exists).
- **Error:**
  - `400 bad_request` — a missing/oversized field, an invalid category, a phone with fewer than 10
    digits, an invalid email, a half-supplied coordinate pair, a **missing platform fee**, a fee
    outside the category range, a malformed `stateCode`, or **no shop picture** (0 or >5 photos).
  - `409 duplicate_inquiry` — an enquiry with that email already exists.
  - `400 unknown_district` — a `districtPlaceId` or explicit `districtCode` that matches no active
    `admins.district_master` row (or a shop's state cannot be resolved).
  - `429 rate_limited` — more than 5 enquiries from one IP in a UTC day.
  - `500 inquiry_unavailable` — the insert failed; the visitor is asked to retry.
- **Empty:** location and at least one photo are required, so there is no "no pin / no photo" path —
  the submit button stays disabled until a location with a district is shared and a photo is added,
  and a submit without one is rejected client-side. When Maps is unavailable the enquiry cannot be
  sent from the browser at all (the panel gives our email/phone instead).

## Testing the intake

Three layers, cheapest first. A green run at a lower layer does **not** prove the layer above it.

```bash
# 1. Handler logic, no DB — validation, honeypot, district, fee, photo gates (~0.01s)
cd server/gateway && go test ./internal/sellers/ -run 'TestCreateInquiry'

# 2. Real SQL — the insert, photo claim, the queue reads, the district filter, enquiry→application promotion
docker compose up -d postgres valkey
TEST_DATABASE_URL='postgres://postgres:faazio@localhost:5432/faazio?sslmode=disable' \
TEST_VALKEY_URL='redis://localhost:6379/0' \
  go test -count=1 ./internal/sellers/

# 3. Live HTTP, public half — the whole response matrix against a running gateway
SHOP_PHOTO_ID='<unclaimed DRAFT AVIF id>' ./scripts/simulate-seller-inquiry.sh http://localhost:8080

# 4. Live HTTP, admin half — the full lifecycle in the super-admin queue (needs portal auth, and two
#    distinct drafts: claiming A's photo promotes it to ACTIVE, so B needs its own)
PORTAL_EMAIL=... PORTAL_PASSWORD=... SHOP_PHOTO_ID=... SHOP_PHOTO_ID_B=... \
  ./scripts/simulate-seller-inquiry-queue.sh http://localhost:8080

# 5. Wire contract — the client payload keys vs the Go request struct, plus the handler body
cd client/web/landingpage && npx vitest run src/lib/inquiries.test.ts src/lib/config.test.ts \
  src/components/sell-with-us/seller-form.test.tsx
```

`testenv.Pool` **skips** DB tests when `TEST_DATABASE_URL` is unset, and the package still reports
`ok` — a green `go test ./internal/sellers/` without that variable proves only the no-DB paths. Count
the skips (`go test -v … | grep -c SKIP`) before trusting a run.

`simulate-seller-inquiry-queue.sh` signs in as a real `SUPER_ADMIN` and asserts: the enquiry appears in
the NEW queue, claim records an owner, the note and reviewer persist, a reject needs a reason, the
final "proceeding" move sets `PENDING_REVIEW`, unknown ids are 404s, and `?district=` narrows the queue
without letting a scoped admin widen it.

## Known gaps

- **The photo is downscaled in the browser, not re-encoded client-side.** A 48 MP phone JPEG is
  resized on a canvas before upload, so image quality is whatever the browser's canvas scaler plus
  JPEG q0.82 gives; the gateway only does the AVIF step. Acceptable — the gallery is a reference for
  an admin call, not a storefront hero.
- **A photo uploaded but never submitted is an orphan.** It stays an unclaimed `SHOP` DRAFT in R2
  (nothing claims it), visible only to the media sweeper. A retried enquiry re-uploads rather than
  reusing the id.
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

## Enquiry → application promotion

An enquiry becomes the application it was always meant to be — **the same row**, no link column and no
second record. When `POST /sellers` arrives with the same contact phone or email as an open
`INQUIRY` row, `Repo.CreateExtended` (`0129`) matches it (`Repo.matchOpenInquiry`) and **updates that
row** to `PENDING_REVIEW` / `source = 'app'`, keeping the `inquiry_*` columns as the historical record
and seeding each vendor's shop gallery from `shop_photos` when the application brings no new photos.
The operator's call-back history (stage, claim) survives, and the merchant never appears twice in the
seller list.

## Linked docs

- [`seller-inquiry-queue.md`](./seller-inquiry-queue.md) — the admin follow-up queue for these enquiries.
- [`seller-registration.md`](./seller-registration.md) — the KYC-complete mobile application that promotes it.
- [`index.md`](./index.md) — the onboarding domain index.
- `server/gateway/scripts/simulate-seller-inquiry.sh` — the live-HTTP simulation above.
- `docs/architecture/db-schema.md` §12.41, `monolith-breakdown.md` §1 (sellers row),
  `caching-cloudflare-valkey.md` §5.
