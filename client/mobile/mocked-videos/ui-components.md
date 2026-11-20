# UI components used by the recordings

The two demonstration videos are shot against the **shipping UI**. No demo-only screen, component or
fixture exists for them, and none should be added — a reviewer comparing the video to the installed
app must see the same pixels. This is the map from each shot to the component that renders it.

## Location video

| Shot | Component / file | Why it is the honest surface |
|---|---|---|
| Dashboard + presence pill | `src/features/delivery-partner/components/DeliveryHeader.tsx` → shared `DPUtilityBar` (`src/components/shared/dp/DPUtilityBar.tsx`) | The presence pill is the **only** availability control (`accessibilityRole="switch"`, label *"Offline. Tap to go online"* / *"Online. Tap to go offline"*). Its `onToggleOnline` is the single entry point to `toggleDeliveryOnline`. |
| Offers / active orders | `src/features/delivery-partner/screens/DashboardScreen.tsx` (`Offers` section, `DPOrderCard`, `DPEmptyState`) | Shows what the location is *for* — dispatch sending nearby offers. Empty copy: *"Dispatch will ping you when a delivery is nearby"*. |
| Offer detail / accept | `src/features/delivery-partner/screens/AcceptRejectScreen.tsx` (server-authoritative countdown, **Accept** / **Reject**) | Reachable from an offer push/deep link; accepting is the real accept write. |
| Tab bar | `src/features/delivery-partner/components/DeliveryTabBar.tsx` (`Home` / `Earnings` / `Orders` / `Alerts` / `Profile`) | Confirms the recording is the delivery product, not the customer app. |

## Microphone video

| Shot | Component / file | Why it is the honest surface |
|---|---|---|
| Start call | `src/features/delivery-partner/components/CallCustomerButton.tsx` (**Call customer**, optional secondary **Use phone call**; *"Starting call…"* + disabled for 3 s) | Fires the real `startDeliveryCall`; hidden when `CALLING_ENABLED=false`. |
| Call screen | `src/features/delivery-partner/screens/ActiveCallScreen.tsx` → shared `src/features/call/CallSurface.tsx` | Full-screen, non-dismissible surface: masked peer **Customer**, `Delivery call · #<last6>`, status line (**Connecting…** / **Ringing…** / **Reconnecting…** / **In call** / **Secure phone call** / **Call ended**), `mm:ss` timer from `connectedAt`, Mute / Speaker / Bluetooth / Phone line, **End call**, **Done**. |
| Ring (incoming variant) | `IncomingCallNotifications` + full-screen-intent ring → **Accept** / **Decline** on the same surface | The notification ring is the primary incoming path; a refused full-screen intent degrades to the in-app surface. |

## Shared rules these components already follow (do not regress them for a demo)

- Colours come from `DELIVERY` tokens in `src/theme/deliveryTokens.ts`; no raw hex in the screens.
- Copy is status-true: never a fake **In call** while ringing, never a fake connected timer.
- The masked peer is always **Customer** / **Delivery Partner**; no phone number, name or address is
  rendered by the call surface.
- Layout is full-viewport, non-scrollable, no device frame.

If a string on these surfaces changes (notification text, status line, pill label), update the
matching shot list in `foreground-service-location.md` / `foreground-service-microphone.md` in the
same change so the recorded videos and the written scripts stay in sync.
