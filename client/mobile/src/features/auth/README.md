# Auth Module

Phone-based authentication and address/location capture for the first-run flow.

## 📁 Key Files
- `LoginScreen.tsx`: Two-phase screen — phone entry (`+91`, 10 digits) → OTP (6 segments).
  Phone auto-advances to OTP; OTP verification is driven by an explicit submit state machine
  (auto-submit at 6 digits + a manual **Verify** CTA), awaits `authStore.login()`, then
  `replace`s to Choose-language. Back is two-step (keyboard → phone entry) via chevron and
  hardware back, preserving the typed number.
- `LocationScreen.tsx`: 3-step location capture (request permission / manual entry / map loader).

## 🛠️ Implementation Standards
- **Secured tokens**: sessions are persisted via `react-native-keychain` (`services/secureSession.ts`);
  prescriptions and payments are never logged.
- **No dead ends**: every failure surfaces via the shake + "Verification Failed" toast, and the
  Verify CTA is always available.
- **Brand identity**: Faazio brand dots and typography are enforced across all subforms.
