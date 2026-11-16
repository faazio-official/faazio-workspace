# Delivery secondary surfaces — bottom nav, profile, settings, support, alerts, history

**Status:** Shipped — persistent bottom-tab shell under `Main`. The tab shell moved `Dashboard` from
a stack route to a tab (not purely additive); see `../README.md` for the full route map.
**Routes:** `OrderHistory`, `Notifications`, `RiderProfile`, `EditProfile`, `Settings`, `Support`
**Trigger:** The rider taps a bottom-nav tab (Home · Earnings · Orders · Alerts · Profile) or a row on
the `RiderProfile` hub.

## Bottom navigation

The authenticated rider area is a persistent `@react-navigation/bottom-tabs` navigator
(`features/delivery-partner/DeliveryTabs.tsx`) hosted by the single `Main` stack screen. Its custom
`tabBar` (`components/DeliveryTabBar.tsx`) renders the generic
`components/shared/dp/DPBottomNav` — a flat card bar 80 px tall with `paddingHorizontal 12 /`
`paddingBottom 12`, a hairline top border and five equal tabs (20 px icon above a 10 px label). The
active tab is bold Faazio Blue with a filled icon (the customer tab-bar pattern), inactive tabs are
muted ink with a transparent icon fill. Route names are the tab keys, so switching tabs uses
`navigation.navigate(name)` without pushing onto the stack:

| Tab | Route |
|---|---|
| Home | `Dashboard` |
| Earnings | `Payouts` |
| Orders | `OrderHistory` |
| Alerts | `Notifications` |
| Profile | `RiderProfile` |

Above the tab row, `DeliveryTabBar` renders the reference's active-order CTA while a job is in
progress. It reads `useDeliveryPartnerStore.activeOrder` (set by `Dashboard`/`Route`, and refreshed
by the Dashboard 20 s poll) and navigates to `Route`. The CTA is **in normal flow**, so the tab
navigator measures it as part of the bar height and tab content is inset above it instead of being
covered. The app root (`DeliveryPartnerApp`'s `Layout`) reserves the bottom safe-area inset once, so
the bar itself must not add `insets.bottom`.

Auth/onboarding screens, the `AcceptReject` modal, `Route`, and the detail screens
(`EarningsDetail`, `Settings`, `Support`) are stack routes above `Main` and do not render the bar,
matching the Vite reference where only tab pages show it.

## Flows

### Order history (`OrderHistory`)

1. `OrderHistoryScreen` loads `gateway.getDeliveryPayouts(100)`.
2. Rows are the real completed-payout ledger rows, newest-first by `paidAt`, rendered with
   `DPOrderCard` (title, settlement status, distance/surge, `formatRupees` amount, "Details"); each
   row links to `EarningsDetail`.
3. Rows enter with the shared `DPFadeIn` stagger (30 ms, disabled under Reduce Motion).
4. An `DPTabStrip` filters the ledger **All · Paid · Pending** (counts from the loaded rows).
5. **Data path:** `GET /delivery/payouts?limit=` → `delivery.delivery_payouts`. There is **no**
   separate rider order-history endpoint; completed orders are read from the earnings ledger (no
   fabricated history).
6. **Empty:** honest "No completed orders yet" state; a filter with no rows shows "No {filter} orders".

### Notifications (`Notifications`)

1. `NotificationsScreen` loads `gateway.getNotifications()` on focus.
2. Opening a row marks it read (`gateway.markNotificationRead`); the header button marks all read
   (`gateway.markAllNotificationsRead`).
3. **Data path:** `GET /notifications`, `POST /notifications/{id}/read`,
   `POST /notifications/read-all` → `notifications.outbox`. Push delivers the alert; this screen is
   the durable in-app record when FCM is unavailable.

### Profile hub (`RiderProfile`)

1. Loads `gateway.getDeliveryPartnerMe()` (`GET /delivery/me`).
2. Read-only hub: identity card (name, city/state, status pill, phone, **email**, vehicle, capacity,
   hub zone, rating, completed deliveries) plus the KYC review note.
3. **Services** links: **My profile** (opens `EditProfile`), Earnings & payouts, Order history,
   Notifications, Settings. **Help** links to Support. Sign out lives here (the Dashboard no longer
   carries a "Go offline and sign out" block) and clears the session, availability and background
   location before returning to `PhoneEntry`.
4. **Data path:** `GET /delivery/me` → `delivery.delivery_boys`.
5. **Note:** the full application detail endpoint (`GET /delivery/register/{id}`) is
   admin/superadmin-gated, so the rider profile intentionally shows the rider's own record only —
   documents are reviewed by the admin team.

### My profile editor (`EditProfile`)

1. Opened from the profile hub. Shows name and phone read-only, and lets the rider edit **email**,
   **vehicle**, **capacity** and **hub zone** at any time.
2. Save is enabled only while the form is dirty and valid (email format, non-empty hub zone). It
   calls `gateway.updateDeliveryPartnerProfile()` (`PUT /delivery/me`), which lowercases/validates the
   email, normalises the vehicle, caps capacity by vehicle (`BICYCLE` 1, `TWO_WHEELER` 2,
   `FOUR_WHEELER` 5), rejects a capacity below `current_load`, and trims the hub zone; the response
   replaces the rider projection so the hub reflects the change immediately.
3. The capacity stepper clamps to `[max(1, current_load), vehicle cap]`; vehicles whose cap is below
   the rider's current load are disabled.
4. **Data path:** `PUT /delivery/me` → `delivery.delivery_boys` (`email`, `vehicle_type`,
   `max_capacity`, `hub_zone`).

### Settings (`Settings`)

1. Shows the account summary, app version (`lib/config.APP_VERSION`) and platform.
2. The **Vibrate on new offer** preference is persisted locally via
   `useDeliverySettingsStore` (AsyncStorage `faazio.delivery.settings`) and honoured by `Dashboard`
   (haptic alert when a genuinely new offer arrives after mount).
3. **System notification settings** opens Android settings (`Linking.openSettings`).
4. Sign out clears the session and returns to `PhoneEntry`.

### Support (`Support`)

1. Email support (`mailto:` `lib/site.SUPPORT_EMAIL`), a report-an-issue mailto, an FAQ and links to
   the Terms / Privacy pages (opened through `openTrustedUrl`, restricted to `faazio.com`).
2. **No server write:** it is a client-local contact surface, mirroring the customer app.

## State

- `useDeliveryPartnerStore` — rider projection.
- `useDeliverySettingsStore` — `vibrateOnOffer` (AsyncStorage-persisted local preference).

## Success / error / empty

- **Success:** each tab renders real data or an honest empty state.
- **Error:** `DPErrorState` with retry; no fabricated rows.
- **Empty:** profile/history/inbox empty states are explicit.

## Known gaps

- Order history is derived from the earnings ledger (completed orders only); a dedicated rider
  order-history endpoint does not exist.
- See [`../../KNOWN_GAPS.md`](../../KNOWN_GAPS.md).

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/user-interaction-workflow/delivery/earnings/earnings-detail.md`
