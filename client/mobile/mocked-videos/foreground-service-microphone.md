# FOREGROUND_SERVICE_MICROPHONE — demo script

**Service:** `CallAudioService` (`android/app/src/main/java/com/faazio/customer/CallAudioService.kt`)
**Type declared:** `android:foregroundServiceType="microphone"` (delivery + customer flavors)
**Permissions shown:** `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `RECORD_AUDIO`,
`MODIFY_AUDIO_SETTINGS`. No phone-account permissions (`CALL_PHONE` / `MANAGE_OWN_CALLS` /
`FOREGROUND_SERVICE_PHONE_CALL` are explicitly **removed** in the delivery manifest).
**Product:** Faazio Delivery Partner (`com.faazio.deliverypartner`) — the customer app declares the
same service for order calls; record the delivery one, it is the app under review.

Target length **60–90 s**, portrait, upload **unlisted** to YouTube and paste the URL into Play
Console.

## What the reviewer must see

| Requirement | Where it appears in the recording |
|---|---|
| Microphone is used only for a call | the call surface is the only thing on screen while the service runs |
| The user clearly initiated / answered the call | **Call customer** tap, or **Accept** on a ringing call |
| A persistent notification exists while the mic is held | shade shows *"Call in progress — Faazio is using the microphone for your call."* |
| It **stops** when the call ends | **End call** → notification gone → microphone released |
| Never on outside a call | opening the app, browsing orders and being online show **no** mic notification |

## Shot list

| # | Shot | On screen | Caption |
|---|---|---|---|
| 1 | Cold open | Faazio Delivery Partner → **Dashboard** with an accepted order (`DPOrderCard` in the active section) | "Faazio Delivery Partner" |
| 2 | Pre-call state | pull the shade → **no** call notification | "No call active — microphone is not used" |
| 3 | Start call | tap **Call customer** (`CallCustomerButton` under the active order) — the button reads **Starting call…** for 3 s | "Rider starts a masked call" |
| 4 | Ringing / connecting | `ActiveCallScreen` (`CallSurface`): peer label **Customer**, `Delivery call · #<last6>`, status **Connecting…** / **Ringing…**, timer `00:00` | "The call surface opens" |
| 5 | Connected | status **In call** (or **Secure phone call** on the PSTN leg), timer running | "Microphone in use while connected" |
| 6 | Notification | pull the shade: *"Call in progress"* / *"Faazio is using the microphone for your call."* | "A foreground service holds the microphone grant only during the call" |
| 7 | Controls | toggle **Mute** / **Speaker** on the surface | "Standard in-call controls" |
| 8 | End | tap **End call** → status **Call ended** → **Done** returns to the order | "Ending the call stops the service" |
| 9 | Post-call proof | pull the shade → notification **gone**; mic indicator cleared | "Microphone released — no foreground service remains" |
| 10 | End card | static | "The microphone is used only while a call is connected." |

For an **incoming** call instead of an outgoing one (also acceptable, and shows the ring path): shoot
the full-screen-intent ring notification, then **Answer**, then shots 5–9.

## Exact code path (for the reviewer notes, not the video)

1. `CallCustomerButton` → `startDeliveryCall` (`src/features/call/controller.ts`), which provisions
   the call on the gateway (masked peer; the server decides VOIP vs PSTN).
2. When the call becomes active, the controller calls `startCallAudio()`
   (`src/features/call/fullScreenIntent.ts`) → native `startCallAudio`
   (`IncomingCallModule.kt`) → `CallAudioService.start(context)`.
3. `CallAudioService.startAsForeground()` calls `startForeground(..., FOREGROUND_SERVICE_TYPE_MICROPHONE)`
   with the ongoing *"Call in progress"* notification. The audio itself is the 100ms SDK's; this
   service only holds the OS microphone grant.
4. On teardown (hangup, peer end, error) the controller calls `stopCallAudio()` → `stopService(...)`.
5. The service is `START_NOT_STICKY` — a restart has no live call, so the OS does not resurrect it.

## Recording

Same CI-only debug install as the location video:

```bash
cd client/mobile
npm run assembleDebugDelivery
gh run watch
gh run download <run-id> -n faazio-delivery-debug-apk
adb install -r app-delivery-debug.apk
adb reverse tcp:8081 tcp:8081
npm run start:delivery
```

`adb shell screenrecord --size 720x1280 --bit-rate 4M /sdcard/mic-demo.mp4` for shots 1–10.

Both sides of the call must be real: sign in with the rider test account, and have the customer app
(or a second rider account) on the other end accept the call, otherwise the surface never leaves
**Ringing…** — a recording of a call that never connects does not demonstrate the microphone grant.

## Do not do

- Do not show the microphone service starting on app launch or while only online/accepting orders.
- Do not record a PSTN-only call through the system dialer — the reviewer needs to see the in-app
  `CallSurface` and the *"Call in progress"* notification.
- Do not narrate "always listening" or any always-on microphone behaviour; there is none.
