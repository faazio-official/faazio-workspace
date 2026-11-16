import { Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

/**
 * Native ringing surface shared by the customer and delivery-partner apps.
 *
 * Android uses ConnectionService via react-native-callkeep. iOS CallKit is not native-linked in this
 * build (iOS ships the customer app only and the CallKeep/100ms pods are excluded in
 * `react-native.config.js`), so every method is a safe no-op there. The in-app call surface remains
 * the fallback whenever the OS refuses to display a native call.
 */
let configured = false;
let listenersAttached = false;
const removers: { remove(): void }[] = [];

export interface CallKeepConfig {
  /** App label shown in the native phone-account prompt. */
  appName: string;
  channelId: string;
  channelName: string;
  notificationTitle: string;
}

export interface CallKeepHandlers {
  onAnswer: (callId: string) => void;
  onEnd: (callId: string) => void;
}

function setupOptions(config: CallKeepConfig) {
  return {
    ios: {
      appName: config.appName,
      supportsVideo: false,
      maximumCallGroups: '1',
      maximumCallsPerCallGroup: '1',
    },
    android: {
      alertTitle: 'Phone account required',
      alertDescription: `${config.appName} needs phone-account access to ring incoming delivery calls.`,
      cancelButton: 'Not now',
      okButton: 'Allow',
      additionalPermissions: [],
      // Full-screen incoming UI is owned by ConnectionService; the JS layer handles audio.
      selfManaged: false,
      endCallsWhenReactNativeStops: true,
      foregroundService: {
        channelId: config.channelId,
        channelName: config.channelName,
        notificationTitle: config.notificationTitle,
      },
    },
  };
}

/**
 * One-time native ringing setup. Safe to call on every app start and from a headless push handler.
 *
 * When the phone account was already granted on a previous run we skip `setup()` (which needs a
 * foreground Activity on several OEMs and fails in a headless context). A cancelled/failed prompt
 * is never cached as configured, so the next call retries instead of silently not ringing.
 */
export async function setupCallKeep(config: CallKeepConfig): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (configured) return true;
  try {
    const alreadyEnabled = await RNCallKeep.hasPhoneAccount().catch(() => false);
    if (alreadyEnabled) {
      // `setup()` needs a foreground Activity on several OEMs, so a headless push cannot call it.
      // Re-register the phone account + native events directly (both are Activity-free) so
      // answer/end events are delivered/buffered instead of being silently dropped.
      RNCallKeep.registerPhoneAccount(setupOptions(config));
      RNCallKeep.registerAndroidEvents();
    } else {
      const ok = await RNCallKeep.setup(setupOptions(config));
      if (!ok) return false;
    }
    RNCallKeep.setReachable();
    RNCallKeep.setAvailable(true);
    configured = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Show the native ringing UI. `callId` doubles as the native call UUID. Resolves false when the OS
 * rejects the display (no phone account, another call already managed, permission denied) so the
 * controller can fall back to the in-app surface instead of leaving the user with no ring at all.
 */
export async function displayIncomingCall(
  callId: string,
  maskedLabel: string,
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const enabled = await RNCallKeep.hasPhoneAccount().catch(() => false);
  if (!enabled) return false;
  if (await RNCallKeep.checkIsInManagedCall().catch(() => false)) return false;

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
      RNCallKeep.displayIncomingCall(callId, maskedLabel, maskedLabel, 'generic', false, {
        ios: {
          supportsHolding: false,
          supportsDTMF: false,
          supportsGrouping: false,
          supportsUngrouping: false,
        },
      });
    } catch {
      settle(false);
      return;
    }
    // Some OEM builds never emit didDisplayIncomingCall; assume shown rather than double-rendering.
    // hasPhoneAccount() above already filtered the known "silently ignored" case.
    setTimeout(() => settle(true), 1500);
  });
}

/** Decline a still-ringing incoming call (ConnectionService reject, not a user hang-up). */
export function rejectNativeCall(callId: string): void {
  if (Platform.OS !== 'android' || !configured) return;
  try {
    RNCallKeep.rejectCall(callId);
  } catch {
    // Call already gone.
  }
}

/** End an answered/active native call from the in-app End button. */
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

/** Bring the app forward after the user answers from the system call screen (Android 10+). */
export function bringCallToForeground(): void {
  if (Platform.OS !== 'android') return;
  try {
    RNCallKeep.backToForeground();
  } catch {
    // Not fatal — the in-app surface still opens from the navigation buffer.
  }
}

/** Tell ConnectionService whether this device can take new calls (sign-out disables it). */
export function setNativeCallingAvailable(available: boolean): void {
  if (Platform.OS !== 'android') return;
  try {
    RNCallKeep.setAvailable(available);
  } catch {
    // Best-effort.
  }
}

/** Attach the answer/end handlers exactly once for the app lifetime. */
export function attachCallKeepHandlers(handlers: CallKeepHandlers): void {
  if (Platform.OS !== 'android' || listenersAttached) return;
  const added: { remove(): void }[] = [];
  try {
    added.push(
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
    removers.push(...added);
    listenersAttached = true;
  } catch {
    // Roll back any listeners that did register so a later attach is not duplicated.
    added.forEach((item) => {
      try {
        item.remove();
      } catch {
        // Already gone.
      }
    });
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
