# Go online / offline + heartbeat

**App / route:** delivery · `Dashboard` (`DashboardScreen.tsx`)
**Status:** Shipped
**Trigger:** Rider toggles availability.
**Visual layer:** the toggle is the `DPUtilityBar` presence pill (an `accessibilityRole="switch"`
control showing **Online/Offline**) at the end of the single pinned shift bar — rider name, alerts,
presence. It is the only availability signal on Home: no second status chip and no separate page
header. Behaviour (permission gate, heartbeat, availability write) is unchanged.

## Steps

1. Toggle calls `gateway.setDeliveryAvailability(next)` (`PUT /delivery/availability`).
2. The server runs the worked-time clock alongside availability: going online stamps
   `delivery:rider:{id}:shift:since` (idempotent in Valkey); going offline folds the segment into
   `delivery:rider:{id}:shift:online:{YYYYMMDD}`, clipped to the IST day. These feed the dashboard's
   **Online today** card via `GET /delivery/shift-summary`.
3. Going online starts the heartbeat interval; going offline stops it.
4. `sendHeartbeat` reads a coarse position and calls
   `gateway.sendDeliveryHeartbeat(lat, lng)` (`POST /delivery/heartbeat`).
5. Going online starts the Android ongoing-location foreground service + headless heartbeat task.
6. The **JavaScript foreground** interval skips heartbeats when `AppState` is not `active`. On
   Android the headless foreground-service task (`services/deliveryHeartbeatTask.ts`) keeps posting
   to the same `POST /delivery/heartbeat` endpoint while the rider is online and the UI is paused. A
   missed heartbeat is non-fatal (the Valkey key expires and dispatch skips the rider).
7. Logout forces availability off before clearing the session.

## State

- `useDeliveryPartnerStore` — rider projection.
- Local `online`, `iosBackgroundAllowed`, `busy`.
- Background task: `services/deliveryHeartbeatTask.ts`.

## Data path

- `gateway.setDeliveryAvailability` → `PUT /delivery/availability` →
  `delivery.delivery_boys.is_available`.
- `gateway.sendDeliveryHeartbeat` → `POST /delivery/heartbeat` → `delivery.rider_heartbeats` +
  Valkey `delivery:rider:{riderId}:location` 300 s.
- Shift clock (Valkey): `delivery:rider:{riderId}:shift:since` 26 h and
  `delivery:rider:{riderId}:shift:online:{YYYYMMDD}` 48 h; read by `GET /delivery/shift-summary`.
- No synthetic location.

## Success / error / empty

- **Success:** server availability matches the toggle; heartbeat updates the live coordinate.
- **Error:** inline error; the toggle reverts or reports failure.
- **Empty:** no active orders → dashboard empty state.

## Known gaps

- Android background-location best-effort behavior (OEM battery optimisation) is an ops limit
  tracked in `client/mobile/PENDING_WORK.md`.

## Linked docs

- `docs/architecture/mobile-app.md` (delivery partner)
- `docs/architecture/monolith-breakdown.md` (delivery row)
- `docs/RUNBOOKS/TROUBLESHOOTING.md`
