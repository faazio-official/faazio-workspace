/**
 * Regression: Firebase's iOS reCAPTCHA fallback can be blocked (iPad presenter, no APNs) and its
 * `signInWithPhoneNumber` promise then never settles. The service must reject on its own so the
 * login screen can release the Send button instead of spinning forever.
 *
 * Only the native Firebase seam is mocked — the timeout/cleanup logic under test is real.
 */

const mockUnsubscribe = jest.fn();

jest.mock('@react-native-firebase/app', () => ({
  getApps: () => [{ name: '[DEFAULT]' }],
  getApp: () => ({ options: {} }),
  initializeApp: jest.fn(),
  deleteApp: jest.fn(),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: () => ({
    currentUser: null,
    settings: {},
    onAuthStateChanged: () => mockUnsubscribe,
  }),
  signInWithPhoneNumber: jest.fn(() => new Promise(() => {})),
  signOut: jest.fn(),
}));

import { OtpTimeoutError, sendOtp } from '../firebaseAuth';

describe('sendOtp hard timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects instead of hanging when the native send never settles', async () => {
    const pending = sendOtp('9000000001');
    const assertion = expect(pending).rejects.toBeInstanceOf(OtpTimeoutError);

    await jest.advanceTimersByTimeAsync(20_000);
    await assertion;
  });
});
