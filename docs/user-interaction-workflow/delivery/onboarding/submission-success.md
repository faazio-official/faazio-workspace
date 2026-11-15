# Application status (SubmissionSuccess)

**App / route:** delivery · `SubmissionSuccess` (`screens/SubmissionSuccessScreen.tsx`)
**Status:** Shipped
**Trigger:** A rider finishes `Register`, or a signed-in rider opens the app with an application that
is not yet `ACTIVE` (`PhoneEntry` / `Dashboard` route here by `GET /delivery/me` status).
**Visual layer:** `DPPage` + `DPPageHeader` (Faazio wordmark leading), a `RiderSummary`
(`DPSectionCard` + `DPKpiStrip`), the status copy card, a primary action per status and a sign-out
link — all from `components/shared/dp/`.

## Steps

1. The screen resolves the rider: it reads `useDeliveryPartnerStore.rider`; if absent it calls
   `gateway.getDeliveryPartnerMe()` (`GET /delivery/me`) and stores the result.
2. If the returned status is `ACTIVE`, it calls `resetToTab(navigation, 'Dashboard')` — activation
   completes here (a super admin performs `PUT /delivery/register/{id}/activate`).
3. The status copy is chosen from the `COPY` map by status: `APPLIED`, `PENDING_REVIEW`, `VERIFIED`,
   `ACTIVE`, `SUSPENDED`, `BLACKLISTED`, `REJECTED`; `rider.rejectionReason` renders when present.
4. Primary action by status:
   - `ACTIVE` → **Open dashboard** (`resetToTab('Dashboard')`).
   - `REJECTED` → **Correct & re-apply** (`replace('Register')`).
   - any other status → **Refresh status** (re-runs `GET /delivery/me`, `loading` on the button).
   - no rider → **Start application** (`replace('Register')`).
5. Sign out → `useAuthStore.logout()`, `useDeliveryPartnerStore.reset()`, `replace('PhoneEntry')`.

## State

- `useDeliveryPartnerStore` — `rider` projection (`setRider`, `reset`).
- `useAuthStore` — Firebase session (`logout`).
- Local `loading`, `error`.

## Data path

- `gateway.getDeliveryPartnerMe()` → `GET /delivery/me` → `delivery.delivery_boys` (own row, via
  `RiderByPhone`). No fixture rider data.
- Activation/review state is written by admins (`PUT /delivery/register/{id}/verify|activate|reject`)
  and read back through the same `GET /delivery/me`.

## Success / error / empty

- **Success:** status is `ACTIVE` → routed to `Dashboard`; other statuses render copy + the matching
  action.
- **Error:** inline error text; the refresh button retries; no fake "approved" state.
- **Empty:** no application row (`404` on resume) → "No application yet" empty state + start action.

## Known gaps

- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md). The rider cannot read their own application detail
  (`GET /delivery/register/{id}` is admin/super-admin-gated), so this page shows the `GET /delivery/me`
  projection only.

## Linked docs

- [`index.md`](./index.md) (onboarding domain index)
- [`rider-registration.md`](./rider-registration.md)
- `docs/architecture/mobile-app.md` (delivery partner)
