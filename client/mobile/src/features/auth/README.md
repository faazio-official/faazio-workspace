# Auth Module

Phone-based authentication and address/location capture for the first-run flow.

## 📁 Key Files
- `LoginScreen.tsx`: Phone-first sign-in — phone entry (`+91`) → OTP (6 segments) → a name only
  for new accounts. "Send code" (enabled at a valid number) advances to OTP; OTP verification is
  driven by an explicit submit state machine (auto-submit at 6 digits + a manual **Verify** CTA).
  After `verifyOtp`, `GET /profile` decides the next step: a returning customer signs straight in
  with the stored name; a first-time customer gets the name step, whose **Continue** persists the
  session, writes the name through with `GatewayClient.updateProfileName()`, then `replace`s to
  Choose-language. The name step is mandatory and not skippable. OTP back is two-step (keyboard →
  phone step) via chevron and hardware back, preserving the typed number.
- `LocationScreen.tsx`: 3-step location capture (request permission / manual entry / map loader).

## 🛠️ Implementation Standards
- **Secured tokens**: sessions are persisted via `react-native-keychain` (`services/secureSession.ts`);
  prescriptions and payments are never logged.
- **No dead ends**: every failure surfaces via the shake + "Verification Failed" toast, and the
  Verify CTA is always available.
- **Brand identity**: Faazio brand dots and typography are enforced across all subforms.
