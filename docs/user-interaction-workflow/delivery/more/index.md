# Delivery "More" surfaces — bottom nav, profile, settings, support, inbox, history

**Status:** Shipped (additive; no existing route, store, endpoint or test changed)
**Routes:** `OrderHistory`, `Notifications`, `RiderProfile`, `Settings`, `Support`
**Trigger:** The rider taps a bottom-nav tab (Feed · Pocket · Orders · Inbox · More) or a row on the
`RiderProfile` hub.

## Bottom navigation

The main delivery screens render `features/delivery-partner/components/DeliveryTabBar.tsx`, a
generic `components/shared/dp/DPBottomNav` (five equal tabs, 20 px icon + 10 px label, active tab in
Faazio Blue). Route names are the tab keys, so switching tabs uses `navigation.navigate(name)`:

| Tab | Route |
|---|---|
| Feed | `Dashboard` |
| Pocket | `Payouts` |
| Orders | `OrderHistory` |
| Inbox | `Notifications` |
| More | `RiderProfile` |

The stack stays a native stack (no tab navigator). Auth/onboarding screens, the `AcceptReject`
modal, `Route`, and the detail screens (`EarningsDetail`, `Settings`, `Support`) do not render the
bar, matching the Vite reference where only tab pages show it.

## Flows

### Order history (`OrderHistory`)

1. `OrderHistoryScreen` loads `gateway.getDeliveryPayouts(100)`.
2. Rows are the real completed-payout ledger rows, newest-first by `paidAt`; each row links to
   `EarningsDetail`.
3. **Data path:** `GET /delivery/payouts?limit=` → `delivery.delivery_payouts`. There is **no**
   separate rider order-history endpoint; completed orders are read from the earnings ledger (no
   fabricated history).
4. **Empty:** honest "No completed orders yet" state.

### Notifications (`Notifications`)

1. `NotificationsScreen` loads `gateway.getNotifications()` on focus.
2. Opening a row marks it read (`gateway.markNotificationRead`); the header button marks all read
   (`gateway.markAllNotificationsRead`).
3. **Data path:** `GET /notifications`, `POST /notifications/{id}/read`,
   `POST /notifications/read-all` → `notifications.outbox`. Push delivers the alert; this screen is
   the durable in-app record when FCM is unavailable.

### Profile hub (`RiderProfile`)

1. Loads `gateway.getDeliveryPartnerMe()` (`GET /delivery/me`).
2. Shows identity, phone, vehicle, capacity, hub zone, rating and completed-delivery count; links to
   Earnings, Order history, Notifications, Settings and Support; sign out.
3. **Data path:** `GET /delivery/me` → `delivery.delivery_boys`.
4. **Note:** the full application detail endpoint (`GET /delivery/register/{id}`) is
   admin/superadmin-gated, so the rider profile intentionally shows the rider's own record only —
   documents are reviewed by the admin team.

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
