# Mocked foreground-service demonstrations (Play Console)

Recorded walkthroughs and the written script for the **two Android foreground services** the
delivery-partner app declares. Google Play requires a video URL for each declared foreground
service type showing *the app in use*, the persistent notification, and that the service stops when
its triggering activity ends.

| Service type | Declaration in code | Script |
|---|---|---|
| `FOREGROUND_SERVICE_LOCATION` | `DeliveryTrackingService` (`android/app/src/main/java/com/faazio/customer/DeliveryTrackingService.kt`) | [`foreground-service-location.md`](./foreground-service-location.md) |
| `FOREGROUND_SERVICE_MICROPHONE` | `CallAudioService` (`android/app/src/main/java/com/faazio/customer/CallAudioService.kt`) | [`foreground-service-microphone.md`](./foreground-service-microphone.md) |

Supporting material:

- [`ui-components.md`](./ui-components.md) — the existing screens/components the recordings use (no
  parallel mock UI is built for this).
- [`android-manifest-mock.xml`](./android-manifest-mock.xml) — annotated copy of the merged
  delivery-flavor manifest showing exactly which permissions and `<service>` entries the videos are
  demonstrating. The notification small icons it references already exist in the app
  (`android/app/src/main/res/drawable/ic_delivery_tracking.xml`,
  `…/ic_call_notification.xml`); no placeholder art is needed.

## Submission checklist

1. `npm run assembleDebugDelivery` → install the CI debug APK (see "Recording" in each script).
2. Record both walkthroughs with `adb shell screenrecord`, following the shot lists exactly.
3. Upload each as **unlisted** on YouTube; keep the titles descriptive
   (*"Faazio Delivery Partner — location foreground service"* / *"… — microphone foreground service"*).
4. Play Console → App content → **Foreground service permissions** → pick the service type → paste
   the URL and the justification answer (see the table at the bottom of this file).
5. Keep the two URLs in `docs/PLAYSTORE_RELEASE_DELIVERY.md` §9 whenever they change — a re-record
   with different copy must match the current notification strings.

## What is real here, and what you still have to do

This folder is **the script and the submission copy, not the video files**. The services, screens and
notifications below already exist and behave as described — nothing in `src/` or `android/` was
mock-built to make a demo look right. The one outstanding step is *recording*: screen-record a
debug APK on a device, cut it to the shot list, upload it unlisted to YouTube, and paste the URL into
Play Console. See "Recording" in each script file.

Everything in these documents is checked against the current code; if a screen, notification string
or permission changes, update the matching file here in the same change.

## Non-negotiables the videos must show

1. **Location is periodic, not navigation.** The service wakes a heartbeat every **120 s**
   (`DeliveryTrackingService.HEARTBEAT_INTERVAL_SECONDS`) to post one coarse fix; it does not stream
   GPS and the app has **no** `ACCESS_BACKGROUND_LOCATION`.
2. **Location stops when the rider is offline.** The presence pill going Offline calls
   `stopDeliveryTracking()`, which stops the service and removes the notification.
3. **Microphone exists only during a connected call.** `CallAudioService` is started when a call
   becomes active and stopped on teardown; it is never started by app launch, by browsing, or by
   being online.
4. **Both notifications are visible in the recording**, because that is what the reviewer looks for
   in the shade.

## Console answers these documents back

Play Console → App content → **Foreground service permissions**:

| Prompt | Answer |
|---|---|
| Which foreground service types does your app use? | Location; Microphone |
| Is location used for navigation? | **No** — periodic heartbeat while the rider is online |
| Is the service's activity user-initiated? | **Yes** (location: rider goes online; microphone: call answered) |
| Does the service stop when the triggering activity ends? | **Yes** (location: rider goes offline; microphone: call ends) |
| Video URL | one unlisted YouTube link per service type |
