// Jest configuration for the bare React Native SuperApp.
//
// The Jest preset moved out of react-native into @react-native/jest-preset in RN 0.86.
// Only Jest + React Native Testing Library (unit, no device/native build) run here; real-device
// E2E stays in CI. GatewayClient is the single network seam and is mocked per-test.
module.exports = {
  preset: '@react-native/jest-preset',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@data/(.*)$': '<rootDir>/../../data/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/)?(@react-native|react-native|@react-native-community|@react-navigation|react-native-.*|@testing-library/react-native|react-native-svg)/)',
  ],
};
