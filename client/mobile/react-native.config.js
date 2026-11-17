/**
 * React Native autolinking overrides.
 *
 * Masked calling is now enabled on both products: Android uses react-native-callkeep's
 * ConnectionService, iOS uses PushKit + CallKit from `ios/Faazio/VoipCallManager.swift`.
 *
 * `react-native-callkeep` stays Android-only on iOS on purpose — its iOS side installs a second
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
