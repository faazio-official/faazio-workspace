# Blood donor + request board

**App / route:** customer · `BloodDonor` (`features/pharma/blood-donor/BloodDonorScreen.tsx`),
`BloodDonorDetails`, `BloodRequestDescription`; `DonorDashboard` is an embedded component inside
`BloodDonorScreen`, not a navigator route
**Status:** Shipped
**Trigger:** Pharma home blood-donor entry, request board, or incoming match notification.

## Steps

### Donor registration wizard
1. `BloodDonorScreen` renders `BLOOD_DONOR_STEPS` (blood details → health info → availability →
   notifications → review).
2. Each step validates with `stepValidation.ts`; the header chevron goes back one step.
3. Review → `useBloodDonorStore.register()` → `gateway.saveDonorProfile(profile)`
   (`PUT /donors/me`).
4. Writes return `BloodWriteOutcome` (`synced` / `offline` / `signed-out`); offline writes go to the
   `pendingOps` outbox and reconcile on hydration/foreground (server wins).

### Request board + matching
1. `useBloodRequests` loads `gateway.fetchBloodRequests()` (`GET /blood-requests`) with no filter
   arguments.
2. `donorDirectory` loads `gateway.fetchBloodDonors(filters)` (`GET /donors`).
3. Interested/accept calls `gateway.setBloodInterest` / `clearBloodInterest`
   (`PUT/DELETE /blood-requests/{id}/interest`).
4. Targeted request: `gateway.createDonorMatch(donorUserId, bloodGroup, city)`
   (`POST /donor-match-requests`).
5. Recipient sees `gateway.getIncomingDonorMatches()` (`GET /donor-match-requests/incoming`) and
   responds with `gateway.setDonorMatchStatus(id, status)` (`PUT /donor-match-requests/{id}/status`).
6. Posting a public request: `gateway.createBloodRequest(input)` (`POST /blood-requests`).

## State

- `useBloodDonorStore` (`src/state/bloodDonorStore.ts`) — draft, registration, outgoing/incoming
  matches, interested ids, `pendingOps` outbox. Reconciliation is internal: module-private
  `hydrateFromServer()` and the foreground `flushPendingOps()` replay, not a public `reconcile()`.
- `useAuthStore` — donor identity.

## Data path

- `gateway.getDonorProfile` / `saveDonorProfile` → `GET/PUT /donors/me` → `blood.donors`.
- `gateway.getBloodDonors` → `GET /donors` → `blood.donor_directory` view.
- `gateway.getBloodRequests` / `createBloodRequest` → `GET/POST /blood-requests` →
  `blood.requests`.
- `gateway.setBloodInterest` / `clearBloodInterest` → `PUT/DELETE /blood-requests/{id}/interest` →
  `blood.interests`.
- `gateway.createDonorMatch` / `getDonorMatches` / `getIncomingDonorMatches` /
  `setDonorMatchStatus` → `blood.match_requests`.
- Cache: `faazio:v1:blood:requests:group={bloodGroup};city={city}` 60 s (public/redacted); never
  edge-cached.

## Success / error / empty

- **Success:** donor profile saved / request posted / match responded.
- **Offline:** queued in `pendingOps`, shown as pending; server-wins reconcile on reconnect.
- **Error:** inline message; no fabricated donor/match rows.
- **Empty:** no requests/donors → honest empty board.

## Known gaps

- `StepPlaceholder` is defensive dead code for an unknown step id; all current steps are
  implemented. See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (blood donor)
- `docs/architecture/monolith-breakdown.md` (blood row)
- `client/mobile/src/features/pharma/blood-donor/README.md`
