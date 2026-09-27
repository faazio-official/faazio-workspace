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
- The selected donor sees the request in the dashboard's `Requests for You` section.
  Incoming requests are filtered by the authenticated user's stable `user.id`; they are
  not added to the common hospital-request feed.
- The hospital-request feed remains seeded by `BLOOD_REQUESTS` and keeps its filters,
  search, details page, Interested action, Accept & Proceed action, share, phone, map,
  and nearby-request behavior.

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
request timestamp, and pending status. The store persists targeted requests in the
existing `faazio/bloodDonor/v1` AsyncStorage blob during the mock phase. Requests are
owned by both requester and recipient IDs, and the dashboard only renders requests whose
`donorUserId` matches the active account.

Donor contact details are not exposed in search results or donor details. Health data is
never logged. The current local persistence is a mock-stage tradeoff and must move to
server-side encrypted storage when the backend is wired.

## Data and backend seam

`data/pharma/bloodDonors.ts` contains the typed mock `DonorProfile` registry.
`services/donorDirectory.ts` exposes `findMatchingDonors(city, bloodGroup)` and
`getDonorById(donorId)`, so a future Go Chi donor-registry query can replace the fixture
without changing the UI contract.

The future backend must own donor search, authorization, targeted request creation,
request status transitions, secure contact disclosure, and notification delivery. The
current implementation does not provide cross-device delivery or accept/decline actions.
