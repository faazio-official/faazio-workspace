// Shared Jest setup (intentionally minimal).
//
// No fixtures are presented as live data and no fake latency is introduced: tests mock the
// GatewayClient network seam explicitly per-file, per AGENTS.md "No mocked setup".
//
// Only platform glue that has no JS implementation under Jest is mocked here (safe-area insets and
// icon components). Business logic and screens are rendered for real.

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
}));

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
