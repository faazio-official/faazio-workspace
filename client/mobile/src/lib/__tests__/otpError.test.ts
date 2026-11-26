import { isOtpSessionExpired, otpErrorCode, otpErrorMessage } from '../otpError';

describe('otpErrorCode', () => {
  it('reads the code from the error object', () => {
    expect(otpErrorCode({ code: 'auth/session-expired' })).toBe('auth/session-expired');
  });

  it('parses the code out of a native message when code is absent', () => {
    expect(
      otpErrorCode({ message: '[auth/session-expired] The sms code has expired.' }),
    ).toBe('auth/session-expired');
  });

  it('returns null for non-errors and unknown shapes', () => {
    expect(otpErrorCode(undefined)).toBeNull();
    expect(otpErrorCode('boom')).toBeNull();
    expect(otpErrorCode({ message: 'plain failure' })).toBeNull();
  });
});

describe('otpErrorMessage', () => {
  it('never surfaces the raw SDK message', () => {
    const err = new Error('[auth/session-expired] The sms code has expired. Please re-send.');
    const message = otpErrorMessage(err, 'fallback');
    expect(message).not.toContain('[auth/');
    expect(message).toContain('expired');
    expect(message).toContain('Resend OTP');
  });

  it('maps an invalid code to actionable copy', () => {
    expect(otpErrorMessage({ code: 'auth/invalid-verification-code' }, 'fallback')).toContain(
      'not right',
    );
  });

  it('maps the local hard-timeout guard to actionable copy', () => {
    expect(otpErrorMessage({ code: 'faazio/otp-timeout' }, 'fallback')).toContain('timed out');
  });

  it('falls back for unknown codes', () => {
    expect(otpErrorMessage({ code: 'auth/something-new' }, 'fallback')).toBe('fallback');
  });
});

describe('isOtpSessionExpired', () => {
  it('is true for expired and superseded sessions', () => {
    expect(isOtpSessionExpired({ code: 'auth/session-expired' })).toBe(true);
    expect(isOtpSessionExpired({ code: 'auth/code-expired' })).toBe(true);
    expect(isOtpSessionExpired({ code: 'auth/invalid-verification-id' })).toBe(true);
  });

  it('is false for a merely wrong code', () => {
    expect(isOtpSessionExpired({ code: 'auth/invalid-verification-code' })).toBe(false);
    expect(isOtpSessionExpired(new Error('plain failure'))).toBe(false);
  });
});
