/**
 * React Native autolinking overrides.
 *
 * Delivery calling is an Android-only product surface today (iOS ships the customer app only).
 * Keep the native 100ms + CallKeep pods out of the iOS build until the customer iOS calling
 * mirror lands; the JS delivery bundle still compiles against the packages' TypeScript types.
 */
module.exports = {
  dependencies: {
    '@100mslive/react-native-hms': {
      platforms: {
        ios: null,
      },
    },
    'react-native-callkeep': {
      platforms: {
        ios: null,
      },
    },
  },
};
