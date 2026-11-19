/**
 * React Native autolinking overrides.
 *
 * Masked calling is now enabled on both products: Android rings with a full-screen-intent
 * notification (native `IncomingCallModule`, no telecom ConnectionService and therefore no phone
 * account), iOS uses PushKit + CallKit from `ios/Faazio/VoipCallManager.swift`.
 *
 * `react-native-callkeep` is retained only as an optional Android dependency (this product never
 * registers a phone account; the flavor manifests strip its phone permissions). It stays
 * Android-only on iOS on purpose — its iOS side installs a second
 * CXProvider that would compete with `VoipCallManager` for the same call, so exactly one provider
 * owns CallKit. `@100mslive/react-native-hms` IS linked on iOS: the answered call needs its audio
 * session and room SDK.
 */
module.exports = {
  dependencies: {
    'react-native-callkeep': {
      platforms: {
        ios: null,
      },
    },
  },
};
