import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

/**
 * Android incoming-call ringing, without the telecom framework.
 *
 * A high-importance notification with a full-screen intent is what wakes the lock screen; it needs
 * no `ConnectionService` and no phone account, so the system never shows the "Phone account
 * required" dialog after login. iOS does not use this module — PushKit + CallKit own ringing there
 * (`ios/Faazio/VoipCallManager.swift`).
 *
 * Every entry point degrades to a no-op when the native module is absent (iOS, a JS-only build, a
 * unit-test run), so callers never need a platform check beyond the ones already in the controller.
 */
const MODULE_NAME = 'FaazioIncomingCall';
const ACTION_EVENT = 'FaazioIncomingCallAction';

export type IncomingCallAction = 'answer' | 'decline' | 'open';

export interface PendingCallAction {
  action: IncomingCallAction;
  callId: string;
  callUuid?: string;
  /** The original FCM data payload, so a cold-start answer can adopt the call without a re-push. */
  payload?: Record<string, unknown>;
}

export interface IncomingCallNotification {
  callId: string;
  callUuid?: string;
  orderId?: string;
  /** Masked peer label ("Delivery Partner" / "Customer"). Never a phone number. */
  label: string;
  /**
   * The originating FCM data payload. Persisted in the notification's PendingIntents so an Answer
   * tap on a killed app can adopt the same call instead of inventing a second session.
   */
  payload?: Record<string, unknown>;
}

type IncomingCallNativeModule = {
  showIncomingCall?: (data: Record<string, unknown>) => Promise<boolean>;
  dismissIncomingCall?: (callId: string) => Promise<boolean>;
  startCallAudio?: () => Promise<boolean>;
  stopCallAudio?: () => Promise<boolean>;
  getPendingAction?: () => Promise<Record<string, unknown> | null>;
  clearPendingAction?: () => Promise<boolean>;
};

function nativeModule(): IncomingCallNativeModule | null {
  if (Platform.OS !== 'android') return null;
  const module = NativeModules[MODULE_NAME] as IncomingCallNativeModule | undefined;
  return typeof module?.showIncomingCall === 'function' ? module : null;
}

export function isFullScreenIntentAvailable(): boolean {
  return nativeModule() != null;
}

/**
 * Post the ringing notification. Resolves false when the OS refused it (notifications blocked), so
 * the controller can let the server fall back to the masked phone line instead of ringing silently.
 */
export async function showIncomingCallNotification(
  call: IncomingCallNotification,
): Promise<boolean> {
  const module = nativeModule();
  if (!module) return false;
  try {
    return (
      (await module.showIncomingCall?.({
        callId: call.callId,
        callUuid: call.callUuid ?? '',
        orderId: call.orderId ?? '',
        label: call.label,
        ...(call.payload ? { payload: JSON.stringify(call.payload) } : {}),
      })) === true
    );
  } catch {
    return false;
  }
}

/** Remove the ringing notification (answered, declined, cancelled by the caller, or timed out). */
export async function dismissIncomingCallNotification(callId: string): Promise<void> {
  const module = nativeModule();
  if (!module) return;
  try {
    await module.dismissIncomingCall?.(callId);
  } catch {
    // Already gone.
  }
}

/**
 * Hold the microphone grant for a connected call. Android 14+ only lets a foreground service with
 * the `microphone` type record in the background; without this an answered call loses mic access as
 * soon as the app is backgrounded.
 */
export async function startCallAudio(): Promise<void> {
  const module = nativeModule();
  if (!module) return;
  try {
    await module.startCallAudio?.();
  } catch {
    // The 100ms SDK still owns its own audio session; this is a grant, not the audio path.
  }
}

export async function stopCallAudio(): Promise<void> {
  const module = nativeModule();
  if (!module) return;
  try {
    await module.stopCallAudio?.();
  } catch {
    // Already stopped.
  }
}

function parseAction(raw: Record<string, unknown> | null | undefined): PendingCallAction | null {
  if (!raw) return null;
  const action =
    raw.action === 'answer' || raw.action === 'decline' || raw.action === 'open'
      ? raw.action
      : null;
  const callId = typeof raw.callId === 'string' ? raw.callId.trim() : '';
  if (!action || !callId) return null;
  const callUuid = typeof raw.callUuid === 'string' && raw.callUuid ? raw.callUuid : undefined;
  let payload: Record<string, unknown> | undefined;
  if (typeof raw.payload === 'string' && raw.payload) {
    try {
      const parsed: unknown = JSON.parse(raw.payload);
      if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
    } catch {
      // A malformed payload is dropped: the action still carries the call id.
    }
  }
  return { action, callId, ...(callUuid ? { callUuid } : {}), ...(payload ? { payload } : {}) };
}

/**
 * An Answer/Decline tap that landed before JS could handle it (the app was killed). Returned once:
 * the native side clears it so a relaunch cannot replay an old action.
 */
export async function takePendingCallAction(): Promise<PendingCallAction | null> {
  const module = nativeModule();
  if (!module) return null;
  try {
    return parseAction(await module.getPendingAction?.());
  } catch {
    return null;
  }
}

export async function clearPendingCallAction(): Promise<void> {
  const module = nativeModule();
  if (!module) return;
  try {
    await module.clearPendingAction?.();
  } catch {
    // Best-effort.
  }
}

/**
 * Actions taken while JS is running (the user answered from the lock screen with the app alive).
 * Returns a remover; a no-op when the native module is absent.
 */
export function subscribeCallNotificationActions(
  onAction: (action: PendingCallAction) => void,
): { remove(): void } {
  const module = nativeModule();
  if (!module) return { remove() {} };
  try {
    const emitter = new NativeEventEmitter(module as never);
    const subscription = emitter.addListener(ACTION_EVENT, (event: Record<string, unknown>) => {
      const parsed = parseAction(event);
      if (parsed) onAction(parsed);
    });
    return subscription;
  } catch {
    return { remove() {} };
  }
}
