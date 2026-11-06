import { useCallback, useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const MODULE_NAME = 'FaazioSmsUserConsent';
const EVENT_NAME = 'FaazioSmsUserConsent';

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

function getNativeModule(): SmsUserConsentNativeModule | null {
  if (Platform.OS !== 'android') return null;
  const nativeModule = NativeModules[MODULE_NAME] as SmsUserConsentNativeModule | undefined;
  return typeof nativeModule?.startSmsUserConsent === 'function' ? nativeModule : null;
}

/**
 * Imperative arm for screens that start the retriever before navigating (delivery phone entry).
 * The listener is attached by `useSmsUserConsent` once the OTP screen mounts.
 */
export function armSmsUserConsent(): void {
  const nativeModule = getNativeModule();
  if (nativeModule) startSmsUserConsent(nativeModule);
}

export function disarmSmsUserConsent(): void {
  const nativeModule = getNativeModule();
  if (nativeModule) stopSmsUserConsent(nativeModule);
}

export function isSmsUserConsentAvailable(): boolean {
  return getNativeModule() != null;
}

function startSmsUserConsent(nativeModule: SmsUserConsentNativeModule): void {
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

    let subscription: { remove: () => void } | null = null;
    try {
      const emitter = new NativeEventEmitter(nativeModule as never);
      subscription = emitter.addListener(EVENT_NAME, (event: SmsUserConsentPayload) => {
        const code = event?.code;
        if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return;
        // Ignore late results once the retriever was disarmed and no explicit arm is active.
        if (!activeRef.current && !startedRef.current) return;
        onCodeRef.current(code);
      });
    } catch {
      // No event emitter available — keep manual entry.
    }

    return () => {
      subscription?.remove();
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
