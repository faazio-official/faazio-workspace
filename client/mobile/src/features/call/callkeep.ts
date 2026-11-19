import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import {
  dismissIncomingCallNotification,
  isFullScreenIntentAvailable,
  showIncomingCallNotification,
  subscribeCallNotificationActions,
} from './fullScreenIntent';

/**
 * Native ringing surface shared by the customer and delivery-partner apps.
 *
 * Android rings with a high-importance **full-screen-intent notification** (`fullScreenIntent.ts`),
 * not a telecom `ConnectionService`. That is deliberate: a `ConnectionService` needs a phone
 * account, and registering one is what made the system show the "Phone account required" dialog
 * straight after OTP login. The notification path needs only `POST_NOTIFICATIONS` +
 * `USE_FULL_SCREEN_INTENT`, which is how Swiggy/Zomato ring.
 *
 * iOS uses PushKit + CallKit, owned by the native `VoipCallBridge` module
 * (`ios/Faazio/VoipCallManager.swift`): the VoIP push is reported to CallKit by the app delegate
 * before React Native even boots, so there is no JS "display" step there. Exactly one CallKit
 * provider exists per platform — that is why `react-native-callkeep` is not linked on iOS.
 *
 * Every method degrades to a no-op instead of throwing, so a headless push handler and the in-app
 * surface can call them unconditionally. The in-app call surface remains the fallback whenever the
 * OS refuses to display a native ring.
 */
let configured = false;
let listenersAttached = false;
const removers: { remove(): void }[] = [];

export interface CallKeepConfig {
  /** App label shown on the ringing notification. */
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
   * Android only: the user tapped the ringing notification's body (not Answer/Decline). The call is
   * still ringing — bring its surface forward.
   */
  onOpen?: (callId: string) => void;
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

/**
 * One-time native ringing setup. Safe to call on every app start and from a headless push handler.
 *
 * iOS needs no JS setup: `VoipCallManager.start()` runs in the app delegate and the CallKit provider
 * already exists. Android needs no setup at all — the ringing notification channel is created by the
 * native module at app start, and posting a notification requires no phone account. This returns
 * true when a ring surface is available so the controller does not fall back needlessly.
 */
export async function setupCallKeep(config: CallKeepConfig): Promise<boolean> {
  void config;
  if (Platform.OS === 'ios') {
    const bridge = iosBridge();
    if (!bridge) return false;
    configured = true;
    return true;
  }
  if (Platform.OS !== 'android') return false;
  configured = true;
  return isFullScreenIntentAvailable();
}

/**
 * Show the native ringing UI. On Android this posts the full-screen-intent notification; on iOS the
 * ring was already reported natively from the VoIP push, so this only reports whether a ring is on
 * screen.
 *
 * Resolves false when the OS rejects the ring (notifications blocked) so the controller falls back
 * to the in-app surface instead of leaving the user with no ring at all.
 */
export async function displayIncomingCall(
  callId: string,
  maskedLabel: string,
  options: {
    callUuid?: string;
    orderId?: string;
    /** The originating push payload, so a lock-screen answer on a killed app can adopt the call. */
    payload?: Record<string, unknown>;
  } = {},
): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // No display call on iOS: the system screen is already ringing (or was refused). The caller
    // treats false as "no native ring for this call" and shows the in-app surface, which is the
    // only honest answer from JS here.
    return false;
  }
  if (Platform.OS !== 'android') return false;
  return showIncomingCallNotification({
    callId,
    label: maskedLabel,
    ...(options.callUuid ? { callUuid: options.callUuid } : {}),
    ...(options.orderId ? { orderId: options.orderId } : {}),
    ...(options.payload ? { payload: options.payload } : {}),
  });
}

/** Remove a ringing notification once the call is answered, declined, ended or cancelled. */
export function dismissIncomingRing(callId: string): void {
  if (Platform.OS !== 'android') return;
  void dismissIncomingCallNotification(callId);
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

/** Decline a still-ringing incoming call (notification dismiss / CallKit end, not a hang-up). */
export function rejectNativeCall(callId: string, callUuid?: string): void {
  if (Platform.OS === 'ios') {
    if (callUuid) iosBridge()?.module.endCall(callUuid);
    return;
  }
  if (Platform.OS !== 'android') return;
  dismissIncomingRing(callId);
}

/** End an answered/active native call from the in-app End button. */
export function endNativeCall(callId: string, callUuid?: string): void {
  if (Platform.OS === 'ios') {
    if (callUuid) iosBridge()?.module.endCall(callUuid);
    return;
  }
  if (Platform.OS !== 'android') return;
  dismissIncomingRing(callId);
}

/**
 * Report a connected call. Android has no system in-call UI on this path — the ringing notification
 * is simply removed and the ongoing-audio notification takes over — so this is a no-op there.
 */
export function markNativeCallActive(callId: string, callUuid?: string): void {
  void callId;
  void callUuid;
  if (Platform.OS !== 'android') return;
  // Nothing to report: the ring notification is dismissed by `accept`.
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

/**
 * Bring the app forward after the user answers from the system call screen (Android 10+). The
 * notification's own open-app `PendingIntent` already does this, so it is a no-op here.
 */
export function bringCallToForeground(): void {
  // Android: the notification action launches the activity itself.
}

/** Whether this device can take new calls. No phone account is registered, so nothing to toggle. */
export function setNativeCallingAvailable(available: boolean): void {
  void available;
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
  // The Answer/Decline notification buttons are the Android equivalent of CallKit's actions.
  const subscription = subscribeCallNotificationActions(({ action, callId, callUuid }) => {
    if (action === 'answer') handlers.onAnswer(callId, callUuid);
    else if (action === 'open') handlers.onOpen?.(callId);
    else handlers.onEnd(callId, callUuid);
  });
  removers.push(subscription);
  listenersAttached = true;
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
