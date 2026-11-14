# Go online / offline + heartbeat

**App / route:** delivery · `Dashboard` (`DashboardScreen.tsx`)
**Status:** Shipped
**Trigger:** Rider toggles availability.
**Visual layer:** the toggle is the shared `DPSwitch`; behaviour (permission gate, heartbeat,
availability write) is unchanged.

## Steps

1. Toggle calls `gateway.setDeliveryAvailability(next)` (`PUT /delivery/availability`).
2. Going online starts the heartbeat interval; going offline stops it.
3. `sendHeartbeat` reads a coarse position and calls
   `gateway.sendDeliveryHeartbeat(lat, lng)` (`POST /delivery/heartbeat`).
4. Going online starts the Android ongoing-location foreground service + headless heartbeat task.
5. The **JavaScript foreground** interval skips heartbeats when `AppState` is not `active`. On
   Android the headless foreground-service task (`services/deliveryHeartbeatTask.ts`) keeps posting
   to the same `POST /delivery/heartbeat` endpoint while the rider is online and the UI is paused. A
   missed heartbeat is non-fatal (the Valkey key expires and dispatch skips the rider).
6. Logout forces availability off before clearing the session.

## State

- `useDeliveryPartnerStore` — rider projection.
- Local `online`, `iosBackgroundAllowed`, `busy`.
- Background task: `services/deliveryHeartbeatTask.ts`.

## Data path

- `gateway.setDeliveryAvailability` → `PUT /delivery/availability` →
  `delivery.delivery_boys.is_available`.
- `gateway.sendDeliveryHeartbeat` → `POST /delivery/heartbeat` → `delivery.rider_heartbeats` +
  Valkey `delivery:rider:{riderId}:location` 300 s.
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
