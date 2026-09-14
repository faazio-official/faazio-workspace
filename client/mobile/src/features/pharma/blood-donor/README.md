# Blood Donor Module

Blood Donor is a Pharma sub-app feature (entry: the `Droplet` tab in the Pharma bottom
navbar) that lets a user register as a blood donor through a 5-step wizard and view a
registered-donor dashboard.

## Entry & navigation

- `SubAppWrapper` PHARMA tabs → `Donor` (Droplet): not registered → pushes the `BloodDonor`
  wizard route; registered → `setActiveTab('Donor')` and the dashboard renders **inside
  the Pharma wrapper** (pharma bottom navbar kept, gradient app header hidden).
- `BloodDonor` is a root-stack route (`RootStackParamList`), pushed with `fade` like other
  separate pages (Cart, Search, MyOrders). It owns its own header + back chevron.
  `BloodRequestDescription` (request detail placeholder) is a second root-stack route,
  pushed from the dashboard cards.
- When `>4` tabs are present the tab bar widens each item to share the bar width evenly so
  the 5th tab fits narrow (320dp) screens.

## Key files

- `BloodDonorScreen.tsx` — mode-gated single screen: `registration === null` → register
  wizard, otherwise → `DonorDashboard` (in-route success landing, navbar-less). Wizard
  renders `StepperHeader` + a step switch map over the config-driven `BLOOD_DONOR_STEPS`
  registry. Header chevron steps back within the wizard (exits only on step 1); the info
  banner renders only on steps flagged `showBanner`; `canProceed` is delegated to
  `stepValidation.isStepComplete`.
- `DonorDashboard.tsx` — registered-donor dashboard: "Hi, …" greeting (from `authStore`),
  bell with unread-badge seed (+ one per "Ask Blood" post — simulated fan-out), red
  gradient impact banner, filter chips (Donation Requests / Nearby / Urgent), search over
  hospital/city/state/blood group, the `BLOOD_REQUESTS` seed feed, and a floating **"Ask
  Blood"** FAB. User-posted requests lead the feed as `UserBloodRequestCard`. Rendered
  in-wrapper from the Pharma Donor tab (navbar kept, gradient header hidden) and in-route
  right after wizard completion.
- `stepValidation.ts` — `isStepComplete(stepId, draft)` — single validation owner for the
  wizard (scales to steps 3–5).
- `components/StepperHeader.tsx` — 5-step progress UI rendered from the registry.
- `components/BloodDetailsStep.tsx` — step 1 UI (blood-group chip grid).
- `components/HealthInfoStep.tsx` — step 2 "Health & Eligibility" UI (age select, weight
  field, four Yes/No eligibility questions).
- `components/AvailabilityStep.tsx` — step 3 "Availability & Location" UI (location field
  with GPS, willing-to-travel Yes/No, donation type radio). The donation-type radio row
  wraps so all three options (incl. "Both") stay visible on narrow screens.
- `components/NotificationsStep.tsx` — step 4 "Notification Preferences" UI (three alert-
  preference switch rows + an info banner). The design's "Primary Purpose" section was
  intentionally dropped, so the step was renamed to Alerts (id `notifications`).
- `components/ReviewStep.tsx` — step 5 "Review & Confirm" UI: "Your Details" card (pencil
  → step 1), honest review rows rendered from the collected draft, consent checkbox
  (unchecked by default), privacy note under the Complete Registration CTA.
- `components/LabeledSwitchRow.tsx` — red-tint icon chip + label + native `Switch` row;
  reusable for the profile's future notification-settings screen.
- `components/BloodRequestCard.tsx` — donor-dashboard request card (urgency badge, posted
  time, hospital + location, droplet + blood group + units, "For: …" line, deadline +
  verified chips, chevron). Tap pushes `BloodRequestDescription`. Exports `postedLabel`
  and `URGENCY_BADGE` for reuse on the details page.
- `components/UserBloodRequestCard.tsx` — feed card for a user-posted "Ask Blood" request:
  mirrors `BloodRequestCard`'s design (reusing `postedLabel` / `URGENCY_BADGE`) but
  **non-navigating** (no chevron, no detail push — the full `BloodRequest` detail page
  needs hospital-owned fields the Ask form never collects) and shows a **"Your Request"**
  chip instead of "Verified Hospital" (never fake-verified). Relative time is computed
  from the ISO `postedAt`.
- `components/AskBloodSheet.tsx` — "Ask Blood" form on the shared `SlideUpSheet` (same
  pattern as `FoodAddModeSheet`): blood-group chip grid (`OptionChipGrid`), units stepper
  (`ASK_BLOOD_UNITS`-bounded), hospital / city / contact (`AppTextInput`, contact
  prefilled from the account phone), deadline chip row (`ASK_BLOOD_URGENCY_OPTIONS`), and
  an optional note. A local `canAsk` gate enables the pinned **Ask** button; on submit it
  calls `bloodDonorStore.postAskRequest` and swaps to an honest success state. Rendered
  from the wizard and the dashboard FABs.
- `components/BloodRequestInfoGrid.tsx` — 2×2 info-tile grid (icon chip, label, value with
  red/dark accent) used by the request-details page.
- `components/NearbyRequestCard.tsx` — compact request card for the details page's
  "Other Requests Nearby" list (droplet + group, hospital, km, urgency badge, units, chevron).
- `BloodRequestDescriptionScreen.tsx` — request-details page: hospital card (photo,
  verified chip, location, phone FAB), info grid, Purpose + Additional Information,
  save-a-life banner, Mark Interested / Accept & Proceed actions (store-backed, persisted),
  privacy note, and the nearby-requests list sorted by `distanceKm`. Share/phone/map are
  real device integrations (`Share`, `tel:`, Google Maps search).
- `components/LocationField.tsx` — free-text preferred-location input with a **real** GPS
  locate button (`expo-location`: consent → permission → position → reverse geocode →
  fills "City PINCODE"). All failures surface as honest alerts; the field stays editable.
- `components/OptionChipGrid.tsx`, `RadioGroupField.tsx`, `RadioRow.tsx`, `YesNoField.tsx`,
  `SelectField.tsx`, `InfoBanner.tsx`, `WizardFooter.tsx`, `StepPlaceholder.tsx` — reusable
  wizard primitives. `YesNoField` is a thin wrapper over `RadioGroupField`. `InfoBanner`
  takes optional `icon`/`message` props (no props = the step-1 droplet banner).

## State

`bloodDonorStore` (Zustand) holds the in-progress `draft`, the committed `registration`
(null until submitted), the donor's request interactions (`interestedRequestIds` /
`acceptedRequestIds`) and the user-posted **"Ask Blood" requests** (`askRequests`, newest
first). All persist to AsyncStorage (`faazio/bloodDonor/v1`, hand-rolled
hydration — merges stored drafts over `EMPTY_DRAFT` so schema additions get sane defaults),
so mid-fill exits survive restarts (the wizard resumes at `firstIncompleteStep`), a
completed registration keeps the Donor tab on the Registered view, interested/accepted
requests survive restarts, and posted Ask requests persist too. `register()` stamps
`accountPhone` from the auth session; `postAskRequest(input)` stamps a `uba-` id + ISO
`postedAt` and prepends to `askRequests`. Reset
on logout (`services/logout.ts`) clears the storage key (per-account semantics). Health
data is never written to plain logs.

## Data contract

Types, blood-group options, health/eligibility option lists, step registry and banner copy
live in `data/pharma/bloodDonor.ts` (`@data/*`), per the SDUI direction — the feature and
store both consume it. `BloodDonorRegistration` snapshots the full `profile` at submit so no
entered data is silently dropped. The registered-donor dashboard feed (donation requests,
`BLOOD_REQUESTS` + `BLOOD_DONOR_UNREAD_ALERTS` badge seed) and the details-page copy
(`BLOOD_REQUEST_DETAIL_COPY`) live in `data/pharma/bloodRequests.ts`; the backend feed
replaces the seed later — the `BloodRequest` shape stays stable (detail fields are
required, never optional). "Nearby" matches request city against the donor's registered
`preferredLocation` until real geo exists. The **Ask Blood** shape + copy
(`UserBloodRequest`, `ASK_BLOOD_URGENCY_OPTIONS`, `ASK_BLOOD_COPY`, `ASK_BLOOD_UNITS`) live
in the same file — `UserBloodRequest` is deliberately lighter than `BloodRequest` (only the
fields the form collects; `uba-` id prefix) so user asks are stored/rendered honestly;
fan-out to other donors is simulated client-side until the backend owns it.

## Implementation standards

- Blood-donor red (`#EF4444`) is its own domain color (distinct from pharma coral), defined
  in `tokens.ts`.
- Layout uses the standard `hs`/`vs`/`ms` responsive scale; full-viewport, non-scrollable
  chrome with the step body scrollable.
