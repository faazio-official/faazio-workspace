import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import RNCallKeep from 'react-native-callkeep';

/**
 * Native ringing surface shared by the customer and delivery-partner apps.
 *
 * Android uses ConnectionService via react-native-callkeep. iOS uses PushKit + CallKit, owned by the
 * native `VoipCallBridge` module (`ios/Faazio/VoipCallManager.swift`): the VoIP push is reported to
 * CallKit by the app delegate before React Native even boots, so there is no JS "display" step there.
 * Exactly one CallKit provider exists per platform — that is why `react-native-callkeep` is not
 * linked on iOS.
 *
 * Every method degrades to a no-op instead of throwing, so a headless push handler and the in-app
 * surface can call them unconditionally. The in-app call surface remains the fallback whenever the
 * OS refuses to display a native call.
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
  /** `callUuid` is the CallKit UUID on iOS; undefined on Android where the call id is the key. */
  onAnswer: (callId: string, callUuid?: string) => void;
  onEnd: (callId: string, callUuid?: string) => void;
  /**
   * iOS only: a PushKit VoIP push reported a ring to CallKit while JS was running. Android does not
   * use this — there the FCM background handler is the entry point.
   */
  onIncoming?: (data: Record<string, unknown>) => void;
}

/** The native CallKit bridge. Only present on iOS and in a build that includes the module. */
type VoipBridgeModule = {
  getState(): Promise<VoipBridgeState>;
  clearState(): void;
  endCall(uuid: string): void;
  answerCall(uuid: string): void;
  requestMicrophone(): Promise<boolean>;
};

export interface VoipBridgeState {
  answered?: boolean;
  ended?: boolean;
  /** True only once CallKit accepted the ring (a refused report leaves this false). */
  displayed?: boolean;
  voipToken?: string;
  call?: Record<string, unknown>;
}

interface VoipBridge {
  module: VoipBridgeModule;
  emitter: NativeEventEmitter;
}

let voipBridge: VoipBridge | null | undefined;

function iosBridge(): VoipBridge | null {
  if (voipBridge !== undefined) return voipBridge;
  if (Platform.OS !== 'ios') {
    voipBridge = null;
    return voipBridge;
  }
  const module = NativeModules.VoipCallBridge as VoipBridgeModule | undefined;
  // A JavaScript-only build (or a unit-test run) has no native module: stay a safe no-op.
  voipBridge = module ? { module, emitter: new NativeEventEmitter(module as never) } : null;
  return voipBridge;
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
        // ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL (4) | MICROPHONE (128). The
        // VoiceConnectionService declares both types in the manifest; without microphone the
        // answered call loses mic access when the app is backgrounded.
        foregroundServiceType: 132,
      },
    },
  };
}

/**
 * One-time native ringing setup. Safe to call on every app start and from a headless push handler.
 *
 * iOS needs no JS setup: `VoipCallManager.start()` runs in the app delegate and the CallKit provider
 * already exists. Android needs the phone account, and when it was granted on a previous run we skip
 * `setup()` (which needs a foreground Activity on several OEMs and fails headless).
 */
export async function setupCallKeep(config: CallKeepConfig): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const bridge = iosBridge();
    if (!bridge) return false;
    configured = true;
    return true;
  }
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
 * Show the native ringing UI. On Android `callId` doubles as the native call UUID; on iOS the ring
 * was already reported natively from the VoIP push, so this only reports whether a ring is on screen.
 *
 * Resolves false when the OS rejects the display so the controller falls back to the in-app surface
 * instead of leaving the user with no ring at all.
 */
export async function displayIncomingCall(
  callId: string,
  maskedLabel: string,
): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // No display call on iOS: the system screen is already ringing (or was refused). The caller
    // treats false as "no native ring for this call" and shows the in-app surface, which is the
    // only honest answer from JS here.
    return false;
  }
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
    // Some OEM builds never emit didDisplayIncomingCall. Treat silence as "not shown" so the
    // controller falls back to the in-app ringing surface and does not send a false delivery
    // receipt that would suppress the server's PSTN fallback prompt.
    setTimeout(() => settle(false), 1500);
  });
}

/**
 * Whether a native ring is actually on screen for this call. iOS reports it from CallKit: the push
 * handler flagged the call as displayed. This is what lets the controller skip the duplicate in-app
 * ringing UI while the system screen is already ringing.
 */
export async function isNativeRinging(callUuid: string): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const bridge = iosBridge();
  if (!bridge) return false;
  try {
    const state = await bridge.module.getState();
    const pending = state.call;
    if (!pending || state.ended) return false;
    // A refused CallKit report means nothing is ringing natively; the in-app surface must show.
    if (state.displayed !== true) return false;
    const uuid = typeof pending.callUuid === 'string' ? pending.callUuid : '';
    return uuid.toLowerCase() === callUuid.toLowerCase();
  } catch {
    return false;
  }
}

/** Decline a still-ringing incoming call (ConnectionService reject / CallKit end, not a hang-up). */
export function rejectNativeCall(callId: string, callUuid?: string): void {
  if (Platform.OS === 'ios') {
    if (callUuid) iosBridge()?.module.endCall(callUuid);
    return;
  }
  if (Platform.OS !== 'android' || !configured) return;
  try {
    RNCallKeep.rejectCall(callId);
  } catch {
    // Call already gone.
  }
}

/** End an answered/active native call from the in-app End button. */
export function endNativeCall(callId: string, callUuid?: string): void {
  if (Platform.OS === 'ios') {
    if (callUuid) iosBridge()?.module.endCall(callUuid);
    return;
  }
  if (Platform.OS !== 'android' || !configured) return;
  try {
    RNCallKeep.endCall(callId);
  } catch {
    // Call already gone.
  }
}

/** Report a connected call so the system UI switches from ringing to in-call. */
export function markNativeCallActive(callId: string, callUuid?: string): void {
  if (Platform.OS === 'ios') {
    // CallKit already moved the call to connected when the answer action was fulfilled; there is
    // no separate "connected" report for an incoming call.
    void callId;
    void callUuid;
    return;
  }
  if (Platform.OS !== 'android' || !configured) return;
  try {
    RNCallKeep.setCurrentCallActive(callId);
  } catch {
    // Best-effort.
  }
}

/**
 * Tell the system this device accepted the call. Called when the user answers from the in-app
 * surface so CallKit does not keep ringing, and so the native delegate does not re-announce the
 * answer the JS layer already handled.
 */
export function markNativeAnswered(callUuid: string): void {
  if (Platform.OS !== 'ios') return;
  iosBridge()?.module.answerCall(callUuid);
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

/** The PushKit VoIP token, when PushKit has delivered one. Never logged. */
export function getVoipToken(): Promise<string> {
  if (Platform.OS !== 'ios') return Promise.resolve('');
  const bridge = iosBridge();
  if (!bridge) return Promise.resolve('');
  return bridge.module
    .getState()
    .then((state) => (typeof state.voipToken === 'string' ? state.voipToken : ''))
    .catch(() => '');
}

/**
 * Subscribe to PushKit token delivery/rotation. PushKit usually delivers the first token after the
 * push module has already read the (then empty) persisted value, so registering only once at start
 * would leave a first-launch device with no VoIP token until the next app start. Returns a remover;
 * a no-op when the native bridge is absent (JS-only build).
 */
export function subscribeVoipToken(onToken: (token: string) => void): { remove(): void } {
  if (Platform.OS !== 'ios') return { remove() {} };
  const bridge = iosBridge();
  if (!bridge) return { remove() {} };
  return bridge.emitter.addListener('VoipTokenUpdated', (event: { token?: string }) => {
    if (typeof event?.token === 'string' && event.token) onToken(event.token);
  });
}

/**
 * Ask for microphone access. iOS has no `PermissionsAndroid`, so the native bridge owns the prompt.
 * Returns true when granted, or when the bridge is absent (a JS-only build cannot prompt; the VOIP
 * SDK then surfaces the missing permission).
 */
export async function requestMicrophone(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  const bridge = iosBridge();
  if (!bridge) return true;
  try {
    return (await bridge.module.requestMicrophone()) === true;
  } catch {
    return false;
  }
}

/** The pending iOS VoIP call (payload persisted across a cold start), when there is one. */
export async function takePendingNativeCall(): Promise<{
  call: Record<string, unknown> | null;
  answered: boolean;
  ended: boolean;
  displayed: boolean;
}> {
  const empty = { call: null, answered: false, ended: false, displayed: false };
  if (Platform.OS !== 'ios') return empty;
  const bridge = iosBridge();
  if (!bridge) return empty;
  try {
    const state = await bridge.module.getState();
    return {
      call: state.call ?? null,
      answered: state.answered === true,
      ended: state.ended === true,
      displayed: state.displayed === true,
    };
  } catch {
    return empty;
  }
}

/** Clear the persisted iOS VoIP call once the JS state machine has adopted it. */
export function clearPendingNativeCall(): void {
  if (Platform.OS !== 'ios') return;
  iosBridge()?.module.clearState();
}

/** Attach the answer/end handlers exactly once for the app lifetime. */
export function attachCallKeepHandlers(handlers: CallKeepHandlers): void {
  if (listenersAttached) return;
  if (Platform.OS === 'ios') {
    const bridge = iosBridge();
    if (!bridge) return;
    const added = [
      bridge.emitter.addListener(
        'VoipCallAnswered',
        (event: { callId?: string; callUuid?: string }) => {
          if (event?.callId) handlers.onAnswer(event.callId, event.callUuid);
        },
      ),
      bridge.emitter.addListener('VoipCallEnded', (event: { callId?: string; callUuid?: string }) => {
        if (event?.callId) handlers.onEnd(event.callId, event.callUuid);
      }),
      // A ring that arrived while the app was already running still has to drive the shared state
      // machine (and the <3 s delivery receipt), otherwise the server falls back to the phone line
      // even though the device is ringing.
      bridge.emitter.addListener('VoipCallDisplayed', () => {
        void takePendingNativeCall().then((pending) => {
          if (pending.call) handlers.onIncoming?.(pending.call);
        });
      }),
      // CallKit refused the ring (unentitled build, Do Not Disturb, duplicate report). The payload is
      // still persisted, so run the same incoming path: `showIncoming` sees that no native call is on
      // screen and opens the in-app surface instead of leaving the call silently unanswered.
      bridge.emitter.addListener('VoipCallFailed', () => {
        void takePendingNativeCall().then((pending) => {
          if (pending.call) handlers.onIncoming?.(pending.call);
        });
      }),
    ];
    removers.push(...added);
    listenersAttached = true;
    return;
  }
  if (Platform.OS !== 'android') return;
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
