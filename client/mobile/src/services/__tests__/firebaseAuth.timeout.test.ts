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

import { AppState } from 'react-native';
import { OtpTimeoutError, sendOtp } from '../firebaseAuth';

describe('sendOtp hard timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('rejects instead of hanging when the native send never settles', async () => {
    const pending = sendOtp('9000000001');
    const assertion = expect(pending).rejects.toBeInstanceOf(OtpTimeoutError);

    await jest.advanceTimersByTimeAsync(20_000);
    await assertion;
  });

  it('pauses the countdown while the app is in the reCAPTCHA browser', async () => {
    const listeners: ((state: string) => void)[] = [];
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(((_event: string, listener: (state: string) => void) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      }) as unknown as typeof AppState.addEventListener);

    const pending = sendOtp('9000000002');
    let settled = false;
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    // Nearly at the ceiling while still in the app.
    await jest.advanceTimersByTimeAsync(19_000);
    expect(settled).toBe(false);

    // The user is now solving the reCAPTCHA in the system browser — that time must not count.
    listeners.forEach((listener) => listener('background'));
    await jest.advanceTimersByTimeAsync(120_000);
    expect(settled).toBe(false);

    // Back in the app: only the remaining budget runs, then it rejects as a genuine stall.
    listeners.forEach((listener) => listener('active'));
    await jest.advanceTimersByTimeAsync(2_000);
    await expect(pending).rejects.toBeInstanceOf(OtpTimeoutError);
  });
});
