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
 * The receiver is armed while `active` and stopped on deactivation/unmount. Call `restart` after a
 * resend so the 5-minute retriever window starts again without resubscribing.
 */
export function useSmsUserConsent(onCode: (code: string) => void, active: boolean) {
  const onCodeRef = useRef(onCode);
  const activeRef = useRef(active);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const nativeModule = getNativeModule();
    if (!nativeModule) return;

    let subscription: { remove: () => void } | null = null;
    try {
      const emitter = new NativeEventEmitter(nativeModule as never);
      subscription = emitter.addListener(EVENT_NAME, (event: SmsUserConsentPayload) => {
        const code = event?.code;
        if (typeof code === 'string' && /^\d{6}$/.test(code)) onCodeRef.current(code);
      });
    } catch {
      // No event emitter available — keep manual entry.
    }
    startSmsUserConsent(nativeModule);

    return () => {
      subscription?.remove();
      stopSmsUserConsent(nativeModule);
    };
  }, [active]);

  const restart = useCallback(() => {
    if (!activeRef.current) return;
    const nativeModule = getNativeModule();
    if (nativeModule) startSmsUserConsent(nativeModule);
  }, []);

  return { available: isSmsUserConsentAvailable(), restart };
}
