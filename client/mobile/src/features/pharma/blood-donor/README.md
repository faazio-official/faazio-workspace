# Blood Donor Module

Blood Donor is a Pharma sub-app feature entered through the Droplet/Donor tab. It
supports donor registration, targeted donor discovery, user-specific requests, and the
existing hospital donation-request feed.

## Entry and navigation

- `SubAppWrapper` → Pharma → Donor: unregistered users open `BloodDonor` registration;
  registered users see `DonorDashboard` inside the Pharma wrapper.
- `BloodDonorDetails` is a root-stack route opened from Ask Blood matching results.
- `BloodRequestDescription` remains the root-stack route for hospital-originated requests.

## Current workflows

- Registration remains the five-step wizard: blood details, health and eligibility,
  availability and location, alerts, and review/consent.
- Ask Blood opens a two-stage sheet. The user enters only a city and blood group, taps
  Continue, reviews matching available donors, and opens a donor profile.
- `DonorDetailsScreen` shows safe donor information and sends a request to exactly the
  selected donor. Duplicate pending requests for the same requester/donor/search are
  ignored.
- The selected donor sees the request in the dashboard's `Requests for You` section. The
  incoming set is **recipient-scoped on the server** (`GET /donor-match-requests/incoming`,
  `blood.match_requests.donor_user_id = caller`), so it arrives on the recipient's own device,
  not only the requester's. Incoming requests are **not** added to the common hospital-request feed.
- The recipient accepts or declines a pending incoming request from
  `IncomingDonorRequestCard` (`respondToMatch` → `PUT /donor-match-requests/{id}/status`,
  recipient-only, pending-only, outcome-returning). The server enqueues a PII-free
  `MATCH_ACCEPTED`/`MATCH_DECLINED` notification to the requester; the requester's outgoing row
  shows the live status. **Contact is not disclosed on acceptance** (reveal-gated future).
- `AskBloodSheet` also offers **Post to the public board**: it writes city + blood group to
  `POST /blood-requests` (outcome-returning, never a fabricated local row) and reloads the board.
- The hospital-request feed remains server-backed with the `BLOOD_REQUESTS` fixture as the labelled
  offline fallback, and keeps its filters (chips + the funnel `FilterSheet`), search, details page,
  Interested action, Accept & Proceed action, share, phone, map, and nearby-request behavior.

## Key files

- `BloodDonorScreen.tsx` — registration wizard and registered-dashboard mode gate.
- `DonorDashboard.tsx` — incoming targeted requests plus the existing hospital feed.
- `components/AskBloodSheet.tsx` — city/blood-group search and matching-results states.
- `components/MatchingDonorCard.tsx` — safe donor search result card.
- `DonorDetailsScreen.tsx` — selected donor details and targeted request action.
- `components/IncomingDonorRequestCard.tsx` — donor-specific incoming request card.
- `services/donorDirectory.ts` — async donor discovery repository seam.
- `state/bloodDonorStore.ts` — registration, hospital interactions, targeted request state,
  persistence, hydration, and logout reset.

## State and privacy

`DonorMatchRequest` stores requester ID/name, selected donor ID/name, blood group, city,
request timestamp, and a lifecycle `status` (`pending` | `accepted` | `declined` | `completed`
— mirrors the server `match_status`). `bloodDonorStore` keeps the outgoing list
(`donorMatchRequests`) and the server-hydrated incoming list (`incomingMatchRequests`), and mirrors
responses to `PUT /donor-match-requests/{id}/status` as an outcome-returning write; the
`faazio/bloodDonor/v1` AsyncStorage blob is the optimistic cache (`register`/`interest`/
`interest-remove`/`match`/`match-status`/`request` outbox ops flush on hydration + foreground). A
queued response is never reverted by a stale server read.

Donor contact details are not exposed in search results, donor details, or on acceptance. Health
data is never logged. The gateway/`blood.*` schema is the durable home (RLS own-rows; the
`blood.donor_directory` view is the display-safe public projection).

## Data and backend seam

`data/pharma/bloodDonors.ts` contains the typed mock `DonorProfile` registry.
`services/donorDirectory.ts` exposes `findMatchingDonors(city, bloodGroup)` →
`{ donors, source }` and `getDonorById(donorId, source)`. It reads the server directory through the
no-fallback `GatewayClient.fetchBloodDonors` (`GET /donors`), so the caller can tell a live
(possibly-empty) consented directory from the offline fixture: a `200 []` is an honest
`empty-authoritative`, a failure is `offline-fallback` (fixture, labelled). The `source` rides the
`BloodDonorDetails` route so a donor opened from a live search resolves only from server rows and a
fixture donor is never shown as consented live. Un-tapping interest calls
`GatewayClient.clearBloodInterest` (`DELETE /blood-requests/{id}/interest`), queued as an
`interest-remove` outbox op when offline.

The Go Chi gateway owns donor search, authorization, targeted request creation, incoming
(recipient-scoped) reads, and status transitions; it enqueues a PII-free notification to the
requester. Still future: secure contact disclosure after an
accepted response (reveal gate), a notification inbox screen + push delivery, and real
geo distance (device coords + an earthdistance/lat-lng index).
