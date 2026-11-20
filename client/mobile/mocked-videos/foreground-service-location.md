# FOREGROUND_SERVICE_LOCATION — demo script

**Service:** `DeliveryTrackingService` (`android/app/src/main/java/com/faazio/customer/DeliveryTrackingService.kt`)
**Type declared:** `android:foregroundServiceType="location"` (delivery flavor manifest only)
**Permissions shown:** `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `ACCESS_COARSE_LOCATION`,
`ACCESS_FINE_LOCATION`, `POST_NOTIFICATIONS`. **No** `ACCESS_BACKGROUND_LOCATION`.
**Product:** Faazio Delivery Partner (`com.faazio.deliverypartner`)

Target length **60–90 s**, portrait, no narration required (captions are enough), upload **unlisted**
to YouTube and paste the URL into Play Console.

## What the reviewer must see

| Requirement | Where it appears in the recording |
|---|---|
| The service is started by an explicit user action | rider taps the presence pill (**Offline → Online**) |
| A persistent notification exists while it runs | shade shows *"Faazio Delivery Partner is online — Sharing your location so nearby orders can reach you."* |
| Location is used for a **purpose the user understands** | the Dashboard's offer/online state, and the copy in the notification |
| It is **not** continuous navigation | cut shows one heartbeat round-trip, then idle; voice-over/caption says "every 120 seconds" |
| It **stops** when the activity ends | rider taps **Online → Offline**; notification disappears |

## Shot list

| # | Shot | On screen | Caption |
|---|---|---|---|
| 1 | Cold open | Faazio Delivery Partner launch → rider **Dashboard** | "Faazio Delivery Partner" |
| 2 | Offline state | pinned `DeliveryHeader` / `DPUtilityBar` presence pill reads **Offline** | "Rider starts offline — no location service" |
| 3 | Go online | tap the pill → confirmation → pill reads **Online** | "Rider goes online" |
| 4 | Notification | pull the shade: *"Faazio Delivery Partner is online"* / *"Sharing your location so nearby orders can reach you."* | "A foreground notification is shown for as long as they are online" |
| 5 | Purpose | back in the app: **Offers** section on the Dashboard (empty state *"Dispatch will ping you when a delivery is nearby"*), then an offer card arriving | "Location keeps dispatch able to find this rider" |
| 6 | Accept (optional, if an offer is available) | tap **Accept** on the offer card, or open `AcceptReject` from the push and tap **Accept** | "Order accepted" |
| 7 | Heartbeat | split-second capture of the network call `POST /delivery/heartbeat` (or a caption card) | "One coarse fix is sent every 120 seconds — not continuous GPS" |
| 8 | Stop | tap the pill **Online → Offline** → shade shows the notification gone | "Going offline stops the service and removes the notification" |
| 9 | End card | static | "Location is used only while the rider is online. No background location permission." |

## Exact code path (for the reviewer notes, not the video)

1. `toggleDeliveryOnline(true)` in `src/features/delivery-partner/availability.ts` requests the
   location permission, then `gateway.setDeliveryAvailability(true)`.
2. `useDeliveryShiftLifecycle` sees `online` and calls `startDeliveryTracking()`
   (`src/services/deliveryTracking.ts` → native module `FaazioDeliveryTracking.start()`).
3. The native module starts `DeliveryTrackingService`, which calls `startForeground(...,
   FOREGROUND_SERVICE_TYPE_LOCATION)` with the ongoing notification, then schedules
   `DeliveryHeartbeatTaskService` every 120 s (`INITIAL_DELAY_SECONDS = 30`).
4. Each tick runs the `FaazioDeliveryHeartbeat` headless task, which takes one coarse fix
   (`highAccuracy: false`, `maximumAge: 120_000`) and posts `POST /delivery/heartbeat`.
5. Going offline → `stopDeliveryTracking()` → `stopDeliveryTracking` native `stop()` → service
   `stopSelf()`, notification removed.

## Recording

Debug builds are CI-only on this machine:

```bash
cd client/mobile
npm run assembleDebugDelivery          # dispatches .github/workflows/android-debug.yml (BUILD_VARIANT=debug)
gh run watch
gh run download <run-id> -n faazio-delivery-debug-apk
adb install -r app-delivery-debug.apk
adb reverse tcp:8081 tcp:8081
npm run start:delivery                 # Metro for the debug shell
```

Then on the device: `adb shell screenrecord --size 720x1280 --bit-rate 4M /sdcard/location-demo.mp4`,
perform shots 1–8, stop with `Ctrl-C`, `adb pull /sdcard/location-demo.mp4`.

Use the Delivery Partner test account (`docs/TEST_ACCOUNTS.md`) and a rider that is **ACTIVE** so the
Dashboard loads with an online toggle.

## Do not do

- Do not show a navigation/map turn-by-turn view with location tracking "on" — the app has none.
- Do not claim real-time/continuous tracking; the interval is 120 s.
- Do not record the customer app for this service — `FOREGROUND_SERVICE_LOCATION` is declared only in
  the delivery flavor.
