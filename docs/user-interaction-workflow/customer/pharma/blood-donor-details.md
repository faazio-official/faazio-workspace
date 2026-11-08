# Blood donor detail + request description

**App / route:** customer · `BloodDonorDetails` (`features/pharma/blood-donor/DonorDetailsScreen.tsx`),
`BloodRequestDescription` (`features/pharma/blood-donor/BloodRequestDescriptionScreen.tsx`)
**Status:** Shipped
**Trigger:** Tapping a donor card in the donor directory (`DonorDashboard.tsx`) or a request card /
   `AskBloodSheet` on the request board.

## Steps

### Donor details (`BloodDonorDetails`)
1. `DonorDetailsScreen` resolves the donor with `getDonorById(route.params.donorId, source)`.
2. It shows the donor's blood group, city and compatibility with the active request.
3. "Request this donor" calls `useBloodDonorStore.requestDonor(donor, requestCity)`, which posts a
   targeted match (`POST /donor-match-requests`).
4. The write resolves to a `BloodWriteStatus` (`synced` / `offline` / `signed-out`); offline writes
   queue in the store outbox.

### Request description (`BloodRequestDescription`)
1. `useBloodRequests()` supplies the live board; a cold deep link waits for the server board
   (`awaitLiveBoard`) so a fixture id is never rendered as a live row.
2. The screen shows the request copy (`BLOOD_REQUEST_DETAIL_COPY`), info grid, nearby requests, and
   share / call actions.
3. Interested / accept toggles call `useBloodDonorStore.toggleInterested` /
   `acceptRequest` → `PUT/DELETE /blood-requests/{id}/interest`.

## State

- `useBloodDonorStore` — donor directory, targeted matches, interested/accepted ids, `pendingOps`
  outbox (`src/state/bloodDonorStore.ts`).
- Local `writeStatus` on the donor detail screen.

## Data path

- `getDonorById` → `GET /donors` → `blood.donor_directory`.
- `requestDonor` → `POST /donor-match-requests` → `blood.match_requests`.
- `toggleInterested` / `acceptRequest` → `PUT/DELETE /blood-requests/{id}/interest` →
  `blood.interests`.
- No fabricated donor/request rows are rendered as live.

## Success / error / empty

- **Success:** match request synced; interested/accepted state persisted.
- **Offline:** queued in `pendingOps`, shown as pending; server-wins reconcile on reconnect.
- **Error:** inline message; no fabricated donor or match.
- **Empty:** missing request after the live board settles → honest "no longer available" state.

## Known gaps

- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md) (blood flow gaps).

## Linked docs

- [`blood-donor.md`](./blood-donor.md) (donor registration + request board)
- `docs/architecture/mobile-app.md` (blood donor)
- `docs/architecture/monolith-breakdown.md` (blood row)
