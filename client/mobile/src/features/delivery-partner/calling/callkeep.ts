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
    await RNCallKeep.setup({
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
    configured = true;
    return true;
  } catch {
    return false;
  }
}

/** Show the native ringing UI. `callId` doubles as the native call UUID. */
export function displayIncomingCall(callId: string, maskedLabel: string): boolean {
  if (Platform.OS !== 'android' || !configured) return false;
  try {
    RNCallKeep.displayIncomingCall(callId, 'Faazio', maskedLabel, 'generic', false);
    return true;
  } catch {
    return false;
  }
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
