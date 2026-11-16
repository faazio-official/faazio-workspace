import { Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

/**
 * Native ringing surface (Android ConnectionService via react-native-callkeep).
 *
 * The delivery-partner product is Android-only, so this is intentionally a no-op on iOS. Every call
 * is best-effort: a device/OEM that refuses the phone account must never crash the app — the
 * in-app ActiveCall screen remains the fallback surface.
 */
let configured = false;
let listenersAttached = false;
const removers: { remove(): void }[] = [];

export interface CallKeepHandlers {
  onAnswer: (callId: string) => void;
  onEnd: (callId: string) => void;
}

export async function setupCallKeep(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (configured) return true;
  try {
    const ok = await RNCallKeep.setup({
      ios: {
        appName: 'Faazio Delivery Partner',
        supportsVideo: false,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
      },
      android: {
        alertTitle: 'Phone account required',
        alertDescription:
          'Faazio Delivery Partner needs phone-account access to ring incoming delivery calls.',
        cancelButton: 'Not now',
        okButton: 'Allow',
        additionalPermissions: [],
        // Full-screen incoming UI is owned by ConnectionService; the JS layer handles audio.
        selfManaged: false,
        endCallsWhenReactNativeStops: true,
        foregroundService: {
          channelId: 'faazio_delivery_calls',
          channelName: 'Delivery calls',
          notificationTitle: 'Delivery call in progress',
        },
      },
    });
    // A cancelled/failed phone-account prompt is not configured: keep retrying on later calls and
    // fall back to the in-app surface instead of pretending native ringing works.
    if (!ok) return false;
    configured = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Show the native ringing UI. `callId` doubles as the native call UUID. Resolves false when the OS
 * rejects the display (e.g. missing phone account/permission) so the controller can fall back to the
 * in-app ring instead of leaving the rider with no surface at all.
 */
export async function displayIncomingCall(
  callId: string,
  maskedLabel: string,
): Promise<boolean> {
  if (Platform.OS !== 'android' || !configured) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let listener: { remove(): void } | null = null;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try {
        listener?.remove();
      } catch {
        // Listener already gone.
      }
      resolve(ok);
    };
    try {
      listener = RNCallKeep.addEventListener('didDisplayIncomingCall', (data) => {
        if (data.callUUID && data.callUUID !== callId) return;
        settle(!data.error);
      });
      RNCallKeep.displayIncomingCall(callId, 'Faazio', maskedLabel, 'generic', false);
    } catch {
      settle(false);
      return;
    }
    // Some OEM builds never emit didDisplayIncomingCall; assume shown rather than double-rendering.
    setTimeout(() => settle(true), 1500);
  });
}

export function endNativeCall(callId: string): void {
  if (Platform.OS !== 'android' || !configured) return;
  try {
    RNCallKeep.endCall(callId);
  } catch {
    // Call already gone.
  }
}

/** Report a connected call so the system UI switches from ringing to in-call. */
export function markNativeCallActive(callId: string): void {
  if (Platform.OS !== 'android' || !configured) return;
  try {
    RNCallKeep.setCurrentCallActive(callId);
  } catch {
    // Best-effort.
  }
}

/** Attach the answer/end handlers exactly once for the app lifetime. */
export function attachCallKeepHandlers(handlers: CallKeepHandlers): void {
  if (Platform.OS !== 'android' || listenersAttached) return;
  listenersAttached = true;
  try {
    removers.push(
      RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
        if (callUUID) handlers.onAnswer(callUUID);
      }),
      RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
        if (callUUID) handlers.onEnd(callUUID);
      }),
      // Cold-start answers/ends arrive before the JS navigator is ready. CallKeep buffers them and
      // replays through didLoadWithEvents; without this the user's tap was silently lost.
      RNCallKeep.addEventListener('didLoadWithEvents', (events) => {
        for (const event of events ?? []) {
          if (event.name === 'RNCallKeepPerformAnswerCallAction' && event.data.callUUID) {
            handlers.onAnswer(event.data.callUUID);
          } else if (event.name === 'RNCallKeepPerformEndCallAction' && event.data.callUUID) {
            handlers.onEnd(event.data.callUUID);
          }
        }
      }),
    );
  } catch {
    listenersAttached = false;
  }
}

export function detachCallKeepHandlers(): void {
  removers.splice(0).forEach((r) => {
    try {
      r.remove();
    } catch {
      // Listener already removed.
    }
  });
  listenersAttached = false;
}
