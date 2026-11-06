import { useCallback, useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const MODULE_NAME = 'FaazioSmsUserConsent';
const EVENT_NAME = 'FaazioSmsUserConsent';
const BUFFER_TTL_MS = 5 * 60 * 1000;

type SmsUserConsentNativeModule = {
  startSmsUserConsent?: () => void;
  stopSmsUserConsent?: () => void;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

type SmsUserConsentPayload = {
  code?: string;
  error?: string;
};

type CodeListener = (code: string) => void;

/**
 * One emitter subscription lives for the JS runtime. Screens add/remove listeners on it, so a code
 * that arrives while no OTP screen is mounted (e.g. after delivery `PhoneEntry` arms but before
 * `OtpVerify` mounts) is buffered instead of being dropped by `RCTDeviceEventEmitter`.
 */
const codeListeners = new Set<CodeListener>();
let emitterSubscription: { remove: () => void } | null = null;
let bufferedCode: string | null = null;
let bufferedAt = 0;

function getNativeModule(): SmsUserConsentNativeModule | null {
  if (Platform.OS !== 'android') return null;
  const nativeModule = NativeModules[MODULE_NAME] as SmsUserConsentNativeModule | undefined;
  return typeof nativeModule?.startSmsUserConsent === 'function' ? nativeModule : null;
}

function ensureEmitter(nativeModule: SmsUserConsentNativeModule): void {
  if (emitterSubscription) return;
  try {
    const emitter = new NativeEventEmitter(nativeModule as never);
    emitterSubscription = emitter.addListener(EVENT_NAME, (event: SmsUserConsentPayload) => {
      const code = event?.code;
      if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return;
      if (codeListeners.size === 0) {
        bufferedCode = code;
        bufferedAt = Date.now();
        return;
      }
      codeListeners.forEach((listener) => {
        try {
          listener(code);
        } catch {
          // A screen listener must never break delivery to the others.
        }
      });
    });
  } catch {
    // No event emitter available — keep manual entry.
  }
}

function takeBufferedCode(): string | null {
  if (!bufferedCode) return null;
  const code = bufferedCode;
  const age = Date.now() - bufferedAt;
  bufferedCode = null;
  bufferedAt = 0;
  return age <= BUFFER_TTL_MS ? code : null;
}

/**
 * Imperative arm for screens that start the retriever before navigating (delivery phone entry).
 * Attaches the shared listener before arming so a fast consented SMS is buffered, not lost.
 */
export function armSmsUserConsent(): void {
  const nativeModule = getNativeModule();
  if (!nativeModule) return;
  ensureEmitter(nativeModule);
  startSmsUserConsent(nativeModule);
}

export function disarmSmsUserConsent(): void {
  bufferedCode = null;
  bufferedAt = 0;
  const nativeModule = getNativeModule();
  if (nativeModule) stopSmsUserConsent(nativeModule);
}

export function isSmsUserConsentAvailable(): boolean {
  return getNativeModule() != null;
}

function startSmsUserConsent(nativeModule: SmsUserConsentNativeModule): void {
  // A new send owns a new code; a stale buffered value must never auto-fill it.
  bufferedCode = null;
  bufferedAt = 0;
  try {
    nativeModule.startSmsUserConsent?.();
  } catch {
    // Manual entry remains available when Play Services rejects the request.
  }
}

function stopSmsUserConsent(nativeModule: SmsUserConsentNativeModule): void {
  try {
    nativeModule.stopSmsUserConsent?.();
  } catch {
    // Best-effort teardown.
  }
}

/**
 * Android SMS User Consent listener. Play Services shows a system consent sheet for the SMS; on
 * approval the native module emits a 6-digit code. iOS needs no listener — the keyboard's
 * `textContentType="oneTimeCode"` suggestion covers it.
 *
 * The listener is attached for the component lifetime, while `active` controls only whether the
 * retriever auto-arms. Call `start`/`restart` **before** sending the SMS: the User Consent API
 * only observes messages received after `startSmsUserConsent()`, so arming after `sendOtp`
 * resolves races the SMS. `stop` disarms when the flow is abandoned.
 */
export function useSmsUserConsent(onCode: (code: string) => void, active: boolean) {
  const onCodeRef = useRef(onCode);
  const startedRef = useRef(false);
  const activeRef = useRef(active);

  onCodeRef.current = onCode;
  activeRef.current = active;

  useEffect(() => {
    const nativeModule = getNativeModule();
    if (!nativeModule) return;

    ensureEmitter(nativeModule);
    const listener: CodeListener = (code) => {
      // Ignore late results once the retriever was disarmed and no explicit arm is active.
      if (!activeRef.current && !startedRef.current) return;
      onCodeRef.current(code);
    };
    codeListeners.add(listener);

    // A code captured before this screen mounted (delivery phone entry → OTP screen) is replayed.
    if (activeRef.current || startedRef.current) {
      const buffered = takeBufferedCode();
      if (buffered) onCodeRef.current(buffered);
    } else {
      takeBufferedCode();
    }

    return () => {
      codeListeners.delete(listener);
      stopSmsUserConsent(nativeModule);
      startedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const nativeModule = getNativeModule();
    if (!nativeModule) return;
    if (active) {
      startSmsUserConsent(nativeModule);
      startedRef.current = true;
    } else if (startedRef.current) {
      stopSmsUserConsent(nativeModule);
      startedRef.current = false;
    }
  }, [active]);

  const start = useCallback(() => {
    const nativeModule = getNativeModule();
    if (!nativeModule) return;
    ensureEmitter(nativeModule);
    startSmsUserConsent(nativeModule);
    startedRef.current = true;
  }, []);

  const stop = useCallback(() => {
    const nativeModule = getNativeModule();
    if (!nativeModule) return;
    stopSmsUserConsent(nativeModule);
    startedRef.current = false;
  }, []);

  return { available: isSmsUserConsentAvailable(), start, stop, restart: start };
}
