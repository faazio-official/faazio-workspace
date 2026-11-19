import { AppState, Linking, PermissionsAndroid, Platform, type NativeEventSubscription } from 'react-native';
import {
  gateway,
  GatewayHttpError,
  GatewayOfflineError,
  type DeliveryCall,
} from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useCallStore } from '@/state/callStore';
import { CALLING_ENABLED } from '@/lib/config';
import { startRinging, stopRinging } from './ringtone';
import {
  joinVoip,
  leaveVoip,
  setVoipBluetooth,
  setVoipMuted,
  setVoipSpeaker,
} from './voip';
import {
  attachCallKeepHandlers,
  bringCallToForeground,
  clearPendingNativeCall,
  dismissIncomingRing,
  displayIncomingCall,
  endNativeCall,
  isNativeRinging,
  markNativeAnswered,
  markNativeCallActive,
  rejectNativeCall,
  requestMicrophone,
  setNativeCallingAvailable,
  setupCallKeep,
  takePendingNativeCall,
  type CallKeepConfig,
} from './callkeep';
import { startCallAudio, stopCallAudio, takePendingCallAction } from './fullScreenIntent';

const OPEN_PHASES = new Set(['connecting', 'ringing', 'active', 'ending']);
const TERMINAL_STATUSES = new Set(['ENDED', 'REJECTED', 'FAILED', 'MISSED', 'BUSY']);

export interface CallNavigation {
  isReady(): boolean;
  currentRouteName(): string | undefined;
  navigateToActiveCall(): void;
  goBack(): void;
}

/**
 * The server endpoints for one product. The customer and rider app share the call state machine but
 * not the routes: a shopper token may only reach the order-ownership-gated `delivery-calls` family,
 * and a rider token may only reach the rider-scoped family. Passing the surface explicitly keeps the
 * controller from calling an endpoint the caller is not authorised for.
 */
export interface CallApi {
  initiate(orderId: string, opts?: { forcePstn?: boolean }): Promise<DeliveryCall>;
  /**
   * The open call for this caller. `orderId` is the order the session was last associated with; a
   * rider-scoped surface ignores it (the account has at most one open call), an order-scoped
   * customer surface requires it.
   */
  getActive(orderId: string | null): Promise<DeliveryCall | null>;
  get(callId: string): Promise<DeliveryCall>;
  ackRinging(callId: string): Promise<DeliveryCall>;
  join(callId: string): Promise<DeliveryCall>;
  reject(callId: string, reason?: string): Promise<DeliveryCall>;
  end(callId: string, reason?: string): Promise<DeliveryCall>;
  fallback(callId: string): Promise<DeliveryCall>;
}

export interface CallControllerConfig {
  /** Product label shown on the native ring surface. */
  appName: string;
  /** Which `initiatedBy` value means "this device is the callee". */
  incomingInitiatedBy: 'CUSTOMER' | 'RIDER';
  defaultPeerLabel: string;
  peerLabelForRole: (role: string | undefined) => string;
  navigation: CallNavigation;
  /** Endpoint surface this product is authorised to use. */
  api: CallApi;
  callKeep: Omit<CallKeepConfig, 'appName'>;
  /**
   * Whether this product can resolve its own open call. The rider surface exposes a
   * rider-scoped active call; the customer surface resolves per order (see `activeOrderId`).
   */
  recoverActiveCall: boolean;
  micPrompt: { title: string; message: string; negative: string };
  bluetoothPrompt: { title: string; message: string };
  messages: {
    offline: string;
    orderNotAccepted: string;
    unavailable: string;
    notFound: string;
    conflict: string;
    microphoneDenied: string;
    generic: string;
  };
}

export interface CallController {
  /**
   * Prompt-free attach: listeners, AppState, a pending notification action and (iOS) open-call
   * recovery. Safe to call on login — it registers no phone account and shows no system dialog.
   */
  bootstrap: () => Promise<void>;
  initialize: () => Promise<void>;
  flushPendingActiveCall: () => void;
  start: (
    orderId: string,
    peerLabel?: string,
    opts?: { forcePstn?: boolean },
  ) => Promise<void>;
  handleIncomingCall: (data: Record<string, unknown>) => Promise<void>;
  accept: (callId: string) => Promise<void>;
  decline: (callId: string) => Promise<void>;
  end: (reason?: string) => Promise<void>;
  handleNativeEnd: (callId: string) => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  routeToBluetooth: () => Promise<void>;
  switchToPstn: () => Promise<void>;
  dismiss: (reason?: string) => Promise<void>;
  shutdown: () => Promise<void>;
  clear: () => void;
  currentCallId: () => string | null;
  isOpen: () => boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shared masked-calling controller. The gateway decides VOIP vs PSTN; this controller only renders
 * that choice, owns the per-app call state machine and never substitutes fixture data.
 *
 * Each product creates one controller at module scope with its own navigation handle and copy. The
 * returned functions are safe to call from screens, FCM background handlers and the native
 * ringing/action listeners.
 */
export function createCallController(config: CallControllerConfig): CallController {
  let activeCallId: string | null = null;
  /*
   * The order the current call belongs to. The customer surface resolves its open call per order
   * (the rider-scoped `/delivery/calls/active` is not available to a shopper token), so recovery
   * needs the order id that the call was last associated with.
   */
  let activeOrderId: string | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollInFlight = false;
  let lockUntil = 0;
  let fallbackPrompted = false;
  let initialising: Promise<void> | null = null;
  let pendingNavigation = false;
  let accepting = false;
  let declining = false;
  let declinedCallId: string | null = null;
  /*
   * The CallKit UUID for the current call. iOS keys a native call by UUID, not by our `call-<hex>`
   * id, so every native end/answer/connect call needs it. Android ignores it entirely.
   */
  let activeCallUuid: string | null = null;
  /*
   * Monotonic session epoch. Any async continuation (`start`, `accept`, `switchToPstn`) compares
   * the epoch it began with against the current one, so a user who ends/declines/dismisses while a
   * request is in flight can never have a live call resurrected behind a closed surface.
   */
  let epoch = 0;
  let recovered = false;
  let appStateSub: NativeEventSubscription | null = null;
  let appStateInstalled = false;

  function store() {
    return useCallStore.getState();
  }

  function callKeepOptions() {
    return { appName: config.appName, ...config.callKeep };
  }

  function navigateToActiveCall(): void {
    if (!config.navigation.isReady()) {
      pendingNavigation = true;
      return;
    }
    pendingNavigation = false;
    if (config.navigation.currentRouteName() === 'ActiveCall') return;
    config.navigation.navigateToActiveCall();
  }

  /** Flush a call navigation that fired before the NavigationContainer was ready (cold start). */
  function flushPendingActiveCall(): void {
    if (pendingNavigation && store().phase !== 'idle') {
      navigateToActiveCall();
      return;
    }
    pendingNavigation = false;
  }

  function leaveCallScreen(): void {
    pendingNavigation = false;
    if (!config.navigation.isReady()) return;
    if (config.navigation.currentRouteName() === 'ActiveCall') config.navigation.goBack();
  }

  function stopTimers(): void {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    pollInFlight = false;
  }

  /**
   * The native call UUID for an incoming push. iOS pushes carry `callUuid`; older payloads (and
   * Android) have none, in which case the call id doubles as the native key as before.
   */
  function callUuidFrom(data: Record<string, unknown>): string | null {
    const uuid = typeof data.callUuid === 'string' ? data.callUuid.trim() : '';
    return uuid || null;
  }

  function messageFor(err: unknown): string {
    if (err instanceof GatewayOfflineError) return config.messages.offline;
    if (err instanceof GatewayHttpError) {
      switch (err.code) {
        case 'order_not_accepted':
          return config.messages.orderNotAccepted;
        case 'calling_unavailable':
          return config.messages.unavailable;
        case 'not_found':
          return config.messages.notFound;
        case 'conflict': {
          const message = err.message?.toLowerCase() ?? '';
          return message.includes('current call') || message.includes('open call')
            ? config.messages.conflict
            : config.messages.notFound;
        }
        default:
          return config.messages.generic;
      }
    }
    return config.messages.generic;
  }

  function isTerminal(call: DeliveryCall): boolean {
    return TERMINAL_STATUSES.has(call.status);
  }

  async function ensureAuthenticated(): Promise<boolean> {
    const auth = useAuthStore.getState();
    if (!auth.hydrated) await auth.hydrate().catch(() => false);
    return useAuthStore.getState().isAuthenticated;
  }

  /**
   * Microphone consent before a VOIP join. A denial is not a dead end: the caller falls back to the
   * masked PSTN leg, which needs no microphone permission.
   */
  async function ensureMicrophone(): Promise<boolean> {
    // iOS has no runtime-permission API in JS: the native CallKit owner prompts, and a denial must
    // route the call to the masked phone line instead of joining a VOIP room that records silence.
    if (Platform.OS === 'ios') return requestMicrophone();
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (granted) return true;
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: config.micPrompt.title,
          message: config.micPrompt.message,
          buttonPositive: 'Allow',
          buttonNegative: config.micPrompt.negative,
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  /**
   * Android 12+ gates Bluetooth headset routing behind a runtime permission. Ask once on first call;
   * a denial is harmless (audio simply stays on the earpiece/speaker).
   */
  async function ensureBluetooth(): Promise<void> {
    if (Platform.OS !== 'android' || typeof Platform.Version !== 'number' || Platform.Version < 31) {
      return;
    }
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      );
      if (granted) return;
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, {
        title: config.bluetoothPrompt.title,
        message: config.bluetoothPrompt.message,
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });
    } catch {
      // Permission model unavailable — keep the earpiece route.
    }
  }

  function ensureCallKeepHandlers(): void {
    attachCallKeepHandlers({
      onAnswer: (callId, callUuid) => {
        // iOS keys the native call by UUID; without it a later end/answer cannot reach CallKit.
        if (callUuid) activeCallUuid = callUuid;
        void accept(callId);
      },
      onEnd: (callId, callUuid) => {
        if (callUuid) activeCallUuid = callUuid;
        void handleNativeEnd(callId);
      },
      // Android: the user tapped the ringing notification's body. The call is still ringing, so
      // just bring the in-app Accept/Decline surface forward.
      onOpen: (callId) => {
        if (activeCallId === callId) navigateToActiveCall();
      },
      // iOS: the VoIP push was reported to CallKit before/while JS was alive. Run the same incoming
      // path Android uses so the state machine, the ack and the fallback decision all match.
      onIncoming: (data) => {
        void handleIncomingCall(data);
      },
    });
  }

  /**
   * Keep the microphone grant alive once a VOIP leg is actually connected (Android 14+ refuses
   * background microphone access without a typed foreground service). Nothing is started until the
   * peer joins, so the app never holds the mic outside a live call.
   */
  function holdCallAudio(): void {
    if (Platform.OS !== 'android') return;
    void startCallAudio();
  }

  /** Release the microphone foreground service on every teardown path. */
  function releaseCallAudio(): void {
    if (Platform.OS !== 'android') return;
    void stopCallAudio();
  }

  function ensureAppState(): void {
    if (appStateInstalled) return;
    appStateInstalled = true;
    appStateSub = AppState.addEventListener('change', (next) => {
      // Timers are throttled in the background; resync the authoritative row on return, and flush a
      // call navigation that was buffered while the surface could not be shown (locked/background).
      if (next !== 'active') return;
      if (pendingNavigation && store().phase !== 'idle') navigateToActiveCall();
      else if (activeCallId) void refreshCall(activeCallId);
    });
  }

  /**
   * Prompt-free attach, safe to run on login: native listeners, AppState, a notification action
   * that outlived the JS runtime, and open-call recovery. It registers no phone account and shows
   * no system dialog — Android ringing is a notification, so there is nothing to set up eagerly.
   */
  async function bootstrap(): Promise<void> {
    ensureCallKeepHandlers();
    ensureAppState();
    if (initialising) return;
    initialising = (async () => {
      // Android: an Answer/Decline tap on the ringing notification can launch the app from a killed
      // state. Adopt it before recovery so the tap is not lost.
      await adoptPendingCallAction();
      // iOS: a VoIP push may have rung (or been answered/ended) while React Native was not
      // running. Adopt it before the recovery query so its CallKit UUID is not lost.
      await adoptPendingNativeCall();
      await recoverOpenCall();
    })().finally(() => {
      initialising = null;
    });
    await initialising;
  }

  /**
   * Lazily attach the native ring surface, called only when the user actually starts a call. On
   * Android this is a no-op beyond the notification channel (created natively at app start); on iOS
   * it confirms the CallKit bridge. It deliberately does no network recovery, so tapping "Call"
   * never waits on an open-call lookup.
   */
  async function initialize(): Promise<void> {
    ensureCallKeepHandlers();
    ensureAppState();
    await setupCallKeep(callKeepOptions());
  }

  /**
   * Answer/Decline tapped on the Android ringing notification while React Native was not running.
   * The payload that arrived with the call is adopted first, so an answer can join the same row the
   * server is ringing instead of inventing a second session.
   */
  async function adoptPendingCallAction(): Promise<void> {
    const pending = await takePendingCallAction();
    if (!pending) return;
    // A signed-out device must never act on the previous account's call.
    if (!(await ensureAuthenticated())) return;
    if (pending.action === 'decline') {
      // The user already dismissed this ring: release the row without re-posting a notification.
      await decline(pending.callId);
      return;
    }
    // Answer / open: rebuild the ringing session from the push payload first, so the join hits the
    // same server row the notification was ringing instead of a fabricated one.
    if (pending.payload) await handleIncomingCall(pending.payload);
    if (pending.action === 'open') return;
    if (!activeCallId && pending.callId) activeCallId = pending.callId;
    if (pending.callUuid) activeCallUuid = pending.callUuid;
    if (activeCallId === pending.callId) await accept(pending.callId);
  }

  /**
   * Adopt the call a PushKit wake-up left behind before the JS runtime existed. The native side has
   * persisted the payload and whether the user answered/ended it on the CallKit screen, so a cold
   * start can resume the same call instead of ringing a second time or losing the answer.
   */
  async function adoptPendingNativeCall(): Promise<void> {
    const pending = await takePendingNativeCall();
    if (!pending.call) return;
    const data = pending.call;
    const callId = typeof data.callId === 'string' ? data.callId : '';
    if (!callId) {
      clearPendingNativeCall();
      return;
    }
    if (pending.ended) {
      // The user hung up from the system screen before JS booted: release the row so the
      // one-open-call lock cannot strand the caller.
      clearPendingNativeCall();
      await mutateWithRetry(() => config.api.reject(callId, 'declined'));
      return;
    }
    await handleIncomingCall(data);
    // `handleIncomingCall` can bail (signed out, or already on another call → busy). In that case the
    // native pending call must be dropped, never accepted: `accept` would join a call this device
    // already refused.
    if (activeCallId !== callId) {
      clearPendingNativeCall();
      return;
    }
    // Only clear the native pending state after the controller has taken the UUID, so a re-entrant
    // `isNativeRinging` during `showIncoming` still sees the call.
    clearPendingNativeCall();
    // An answer the user gave on the CallKit screen must be honoured now that JS is running.
    // Without this the call would stay `ringing` forever and the VOIP leg would never join.
    if (pending.answered) await accept(callId);
  }

  /**
   * Caller taps "Call". The server chooses VOIP or PSTN; this controller only renders that choice.
   * Locked for 3 s to prevent a double tap creating two sessions.
   */
  async function start(
    orderId: string,
    peerLabel = config.defaultPeerLabel,
    opts: { forcePstn?: boolean } = {},
  ): Promise<void> {
    if (!CALLING_ENABLED) return;
    if (OPEN_PHASES.has(store().phase)) return;
    if (Date.now() < lockUntil) return;
    lockUntil = Date.now() + 3000;

    const myEpoch = (epoch += 1);
    stopTimers();
    stopRinging();
    fallbackPrompted = false;
    declinedCallId = null;
    activeOrderId = orderId;
    store().begin(orderId, peerLabel);
    navigateToActiveCall();

    try {
      // The explicit cellular path needs no microphone. Only ask when the VOIP leg may be used.
      const micGranted = opts.forcePstn ? false : await ensureMicrophone();
      if (myEpoch !== epoch) return;
      if (!opts.forcePstn) await ensureBluetooth();
      if (myEpoch !== epoch) return;
      const call = await config.api.initiate(orderId, {
        forcePstn: !!opts.forcePstn || !micGranted,
      });
      // The user closed the surface while the server was creating the row. Release the
      // one-open-call lock instead of joining a call with no UI.
      if (myEpoch !== epoch) {
        await mutateWithRetry(() => config.api.reject(call.callId, 'cancelled'));
        return;
      }
      activeCallId = call.callId;
      store().setCall(call);

      if (call.mode === 'VOIP') {
        store().markRinging();
        startRinging();
        await joinVoipLeg(call);
      } else {
        store().markRinging();
        if (!(await openPstnLeg(call))) {
          await teardownFailedCall();
          return;
        }
      }
      if (myEpoch !== epoch) {
        await leaveVoip();
        return;
      }
      startPolling(call.callId);
    } catch (err) {
      if (myEpoch !== epoch) return;
      // A conflicting open call usually means a previous session outlived the JS runtime (crash,
      // force-quit) and its row is still RINGING/ACTIVE. Adopt it instead of dead-ending the caller
      // on "finish the current call first", which they cannot do from a closed surface.
      if (err instanceof GatewayHttpError && err.code === 'conflict' && (await adoptOpenCall(orderId))) {
        return;
      }
      await teardownFailedCall();
      store().setError(messageFor(err));
    }
  }

  /**
   * Re-attach to an open call on this order after a `conflict`. Only a call this device initiated and
   * that is still ringing is adoptable; an active call cannot be re-joined without a fresh token, so
   * it is ended to release the lock rather than left blocking every later call.
   */
  async function adoptOpenCall(orderId: string): Promise<boolean> {
    let open: DeliveryCall | null = null;
    try {
      open = await config.api.getActive(orderId);
    } catch {
      return false;
    }
    if (!open) return false;
    if (open.initiatedBy === config.incomingInitiatedBy) {
      // Someone else is calling us on this order; that push path owns the surface.
      return false;
    }
    if (open.status === 'RINGING') {
      activeCallId = open.callId;
      activeOrderId = open.orderId;
      store().setCall(open);
      if (open.mode === 'VOIP') {
        store().markRinging();
        startRinging();
        // `getActive` returns no token, so re-join through the server: `join` accepts the row and
        // mints a fresh one. Joining with the tokenless projection would fail media silently.
        const joined = await config.api.join(open.callId).catch(() => null);
        if (!joined) {
          await teardownFailedCall();
          return false;
        }
        store().setCall(joined);
        await joinVoipLeg(joined).catch(() => undefined);
      } else if (!(await openPstnLeg(open))) {
        await teardownFailedCall();
        return false;
      }
      startPolling(open.callId);
      return true;
    }
    await mutateWithRetry(() => config.api.end(open.callId, 'stale_session'));
    return false;
  }

  /**
   * A failed start must not leave an open server row: the one-open-call index would then block every
   * later call until an operator intervenes. End (best-effort) before surfacing the error.
   */
  async function teardownFailedCall(): Promise<void> {
    stopTimers();
    stopRinging();
    releaseCallAudio();
    const callId = activeCallId ?? store().call?.callId ?? null;
    await leaveVoip();
    if (callId) {
      endNativeCall(callId, activeCallUuid ?? undefined);
      await mutateWithRetry(() => config.api.end(callId, 'start_failed'));
    }
    activeCallId = null;
    activeCallUuid = null;
  }

  /** Retry an idempotent lifecycle mutation once; a 4xx means the server already moved the row. */
  async function mutateWithRetry(fn: () => Promise<unknown>): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await fn();
        return true;
      } catch (err) {
        if (err instanceof GatewayHttpError) return true;
        if (attempt === 0) await delay(400);
      }
    }
    return false;
  }

  async function joinVoipLeg(call: DeliveryCall): Promise<void> {
    const result = await joinVoip(call, {
      onPeerJoined: () => {
        stopRinging();
        store().setNotice(null);
        store().setFallbackPrompt(false);
        if (store().phase !== 'active') store().markActive();
        if (activeCallId) markNativeCallActive(activeCallId, activeCallUuid ?? undefined);
        holdCallAudio();
      },
      onPeerLeft: () => {
        if (store().phase !== 'active') return;
        stopRinging();
        const callId = activeCallId;
        stopTimers();
        void leaveVoip();
        releaseCallAudio();
        if (callId) {
          endNativeCall(callId, activeCallUuid ?? undefined);
          void mutateWithRetry(() => config.api.end(callId, 'peer_left'));
        }
        activeCallId = null;
        activeCallUuid = null;
        store().markEnded();
      },
      onReconnecting: () => store().setReconnecting(true),
      onReconnected: () => {
        store().setReconnecting(false);
        // A successful reconnect clears the instability notice/prompt it raised.
        store().setNotice(null);
        store().setFallbackPrompt(false);
      },
      onAudioRoute: (route, bluetoothAvailable) => {
        store().setAudioRoute(route);
        store().setBluetoothAvailable(bluetoothAvailable);
      },
      onError: () => {
        stopRinging();
        // A media failure is the one case where the masked PSTN leg is the honest fallback.
        if (call.virtualNumber && OPEN_PHASES.has(store().phase)) {
          store().setFallbackPrompt(true);
          store().setNotice('The app call is unstable. Switch to a secure phone call if it does not recover.');
        }
      },
    });
    store().setAudioRoute(result.route);
    store().setBluetoothAvailable(result.bluetoothAvailable);
  }

  async function openPstnLeg(call: DeliveryCall): Promise<boolean> {
    stopRinging();
    if (!call.virtualNumber) {
      store().setError('No secure calling line is configured.');
      return false;
    }
    // A bridged call is already placed by the server: both phones ring from the provider. Opening
    // the dialer here would add a second call on top of the live bridge, so wait for the provider
    // webhook to flip the row ACTIVE instead.
    if (call.bridged) {
      store().setFallbackPrompt(false);
      store().setNotice('Connecting the secure phone line…');
      return true;
    }
    // The masked platform landline bridges to the peer. The app never dials the raw number.
    // Attempt the dial directly: `canOpenURL('tel:')` returns false on iOS unless the scheme is
    // declared and on Android 11+ without a <queries> entry, which would wrongly report that the
    // device has no dialer.
    try {
      await Linking.openURL(`tel:${call.virtualNumber}`);
    } catch {
      store().setError('This device cannot open the phone dialer.');
      return false;
    }
    // Handoff mode has no provider answer webhook: treat the system dialer opening as the active leg
    // so the surface does not stay on "Dialing…" forever. The timer starts at dialer open, not answer.
    store().setFallbackPrompt(false);
    store().markActive();
    return true;
  }

  function startPolling(callId: string): void {
    stopTimers();
    pollTimer = setInterval(() => {
      if (pollInFlight) return;
      pollInFlight = true;
      void refreshCall(callId).finally(() => {
        pollInFlight = false;
      });
    }, 2000);
  }

  async function refreshCall(callId: string): Promise<void> {
    // A late response from an ended call must never tear down the call that replaced it.
    if (callId !== activeCallId) return;
    try {
      const call = await config.api.get(callId);
      if (callId !== activeCallId) return;
      store().setCall(call);
      // The callee's accept is authoritative; mirror it locally instead of waiting for the VOIP
      // peer event (which can be missed on a slow join).
      if (call.status === 'ACTIVE' && store().phase === 'ringing') {
        stopRinging();
        store().markActive();
        markNativeCallActive(callId, activeCallUuid ?? undefined);
      }
      if (
        !fallbackPrompted &&
        call.fallbackAvailable &&
        call.mode === 'VOIP' &&
        call.virtualNumber &&
        store().phase === 'ringing'
      ) {
        fallbackPrompted = true;
        store().setFallbackPrompt(true);
      }
      if (isTerminal(call)) {
        stopTimers();
        stopRinging();
        endNativeCall(callId, activeCallUuid ?? undefined);
        void leaveVoip();
        releaseCallAudio();
        store().markEnded();
        activeCallId = null;
        activeCallUuid = null;
      }
    } catch {
      // Keep the last authoritative state; the next tick retries.
    }
  }

  /**
   * Recover a call row that outlived the JS runtime (crash, force-quit, reinstall). An incoming call
   * still ringing is re-surfaced and re-acked; an outgoing/active call cannot rejoin without a fresh
   * token, so it is ended to release the one-open-call lock rather than stranding the user.
   */
  async function recoverOpenCall(): Promise<void> {
    if (!config.recoverActiveCall || recovered) return;
    if (OPEN_PHASES.has(store().phase)) return;
    let call: DeliveryCall | null = null;
    try {
      call = await config.api.getActive(activeOrderId);
    } catch {
      // Transient failure: leave `recovered` false so a later initialise can retry.
      return;
    }
    recovered = true;
    if (!call) return;
    activeCallId = call.callId;
    activeOrderId = call.orderId;
    fallbackPrompted = false;
    if (call.status === 'RINGING' && call.initiatedBy === config.incomingInitiatedBy) {
      const peerLabel = config.peerLabelForRole(call.peerRole);
      store().beginIncoming(call.orderId, peerLabel);
      const shownNative = await showIncoming(call.callId, call.orderId, peerLabel);
      // Ack whenever a ring surface is visible — native *or* the foreground in-app surface.
      if (shownNative || AppState.currentState === 'active') {
        if (!shownNative) startRinging();
        void config.api.ackRinging(call.callId).catch(() => undefined);
      }
      startPolling(call.callId);
      return;
    }
    // The old VOIP leg died with the app; end it so a new call is allowed.
    await mutateWithRetry(() => config.api.end(call.callId, 'app_restarted'));
    activeCallId = null;
    activeCallUuid = null;
    store().reset();
  }

  /**
   * Native ringing when available, otherwise the in-app surface. Returns true when a native ring was
   * actually displayed; callers use that to decide whether the server needs the PSTN fallback.
   *
   * iOS is different: the system ring was reported by the app delegate from the VoIP push before JS
   * existed, so there is no display step here — we only confirm that CallKit is showing this call.
   */
  async function showIncoming(
    callId: string,
    orderId: string,
    peerLabel: string,
    payload?: Record<string, unknown>,
  ): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const uuid = activeCallUuid;
      if (uuid && (await isNativeRinging(uuid))) return true;
      navigateToActiveCall();
      return false;
    }
    if (AppState.currentState === 'active') {
      // Foreground: the in-app surface is richer than a heads-up notification (Accept/Decline with
      // the call context). Post no notification so the same call is not ringing in two places.
      navigateToActiveCall();
      return false;
    }
    const native = await setupCallKeep(callKeepOptions());
    if (native) {
      // The native notification composes the "#order" suffix from `orderId` itself.
      const shown = await displayIncomingCall(callId, peerLabel, {
        ...(activeCallUuid ? { callUuid: activeCallUuid } : {}),
        ...(orderId ? { orderId } : {}),
        ...(payload ? { payload } : {}),
      });
      if (shown) return true;
    }
    navigateToActiveCall();
    return false;
  }

  /** Incoming push handler (see `incoming.ts`): ring natively and record the delivery receipt. */
  async function handleIncomingCall(data: Record<string, unknown>): Promise<void> {
    if (!CALLING_ENABLED) return;
    const callId = typeof data.callId === 'string' ? data.callId : '';
    if (!callId) return;
    const orderId = typeof data.orderId === 'string' ? data.orderId : '';
    const role = typeof data.peerRole === 'string' ? data.peerRole : undefined;
    // iOS carries the masked caller label in the VoIP payload; the role alone cannot distinguish
    // "Delivery Partner" from a future peer type.
    const label = typeof data.callerLabel === 'string' ? data.callerLabel.trim() : '';
    const peerLabel = label || config.peerLabelForRole(role);

    // A signed-out device must never wake for the previous account's calls.
    if (!(await ensureAuthenticated())) return;

    // A duplicate delivery of the same push must not reset an already accepted/active call,
    // nor re-ring a call this device already declined.
    if (activeCallId === callId && OPEN_PHASES.has(store().phase)) return;
    if (declinedCallId === callId) return;
    // A re-delivered push for a call this device already finished must not ring again.
    if (
      store().call?.callId === callId &&
      (store().phase === 'ended' || store().phase === 'error')
    ) {
      return;
    }

    // Already on a call: report busy so the caller hears it immediately.
    if (OPEN_PHASES.has(store().phase) && activeCallId !== callId) {
      await config.api.reject(callId, 'busy').catch(() => undefined);
      return;
    }

    ensureCallKeepHandlers();
    ensureAppState();
    activeCallId = callId;
    activeCallUuid = callUuidFrom(data);
    if (orderId) activeOrderId = orderId;
    fallbackPrompted = false;
    declinedCallId = null;
    store().beginIncoming(orderId, peerLabel);
    const shownNative = await showIncoming(callId, orderId, peerLabel, data);
    // The <3 s delivery receipt stops the server falling back to PSTN. Only send it when a ring
    // surface is actually visible (the ringing notification, or the app is in the foreground); a
    // device whose notifications are blocked must let the server fall back instead.
    if (shownNative || AppState.currentState === 'active') {
      if (!shownNative) startRinging();
      void config.api.ackRinging(callId).catch(() => undefined);
    }
    // Poll even when the ring is native-only: if the caller gives up, only the server knows, and
    // without this the callee would keep ringing (and the store stay `ringing`) until the sweep.
    startPolling(callId);
  }

  /** Native "answer" or the in-app Accept button. Idempotent under a double tap/native+in-app race. */
  async function accept(callId: string): Promise<void> {
    if (accepting || declining) return;
    if (activeCallId && activeCallId !== callId) return;
    if (activeCallId === callId && store().phase === 'active') return;
    if (!CALLING_ENABLED) return;
    const myEpoch = epoch;
    accepting = true;
    bringCallToForeground();
    try {
      stopRinging();
      // Android: the ringing notification is the "system call screen" — remove it before joining.
      dismissIncomingRing(callId);
      // The user may have answered from the in-app surface while CallKit is still ringing: tell the
      // system so it stops, and so the delegate does not re-announce an answer JS already handled.
      if (activeCallUuid) markNativeAnswered(activeCallUuid);
      // No mic permission → move the ringing VOIP session onto the masked PSTN leg before joining.
      const micGranted = await ensureMicrophone();
      if (myEpoch !== epoch || declining) return;
      if (!micGranted) {
        const fallback = await config.api.fallback(callId).catch(() => null);
        if (myEpoch !== epoch || declining) return;
        // Never join a VOIP room without a microphone: the peer would hear silence.
        if (!fallback || fallback.mode !== 'PSTN_BRIDGING') {
          endNativeCall(callId, activeCallUuid ?? undefined);
          await teardownFailedCall();
          store().setError(config.messages.microphoneDenied);
          return;
        }
      }
      await ensureBluetooth();
      if (myEpoch !== epoch || declining) return;
      const call = await config.api.join(callId);
      if (myEpoch !== epoch || declining) {
        // The user declined/ended while the join was in flight.
        await mutateWithRetry(() => config.api.end(call.callId, 'cancelled'));
        return;
      }
      activeCallId = call.callId;
      activeOrderId = call.orderId;
      store().setCall(call);
      store().setIncoming(false);
      navigateToActiveCall();
      markNativeCallActive(call.callId, activeCallUuid ?? undefined);

      if (call.mode === 'VOIP') {
        await joinVoipLeg(call);
      } else if (!(await openPstnLeg(call))) {
        await teardownFailedCall();
        return;
      }
      if (myEpoch !== epoch || declining) {
        await leaveVoip();
        return;
      }
      startPolling(call.callId);
    } catch (err) {
      if (myEpoch !== epoch || declining) return;
      endNativeCall(callId, activeCallUuid ?? undefined);
      await teardownFailedCall();
      store().setError(messageFor(err));
    } finally {
      accepting = false;
    }
  }

  /** Native "decline" or the in-app Reject button. */
  async function decline(callId: string): Promise<void> {
    if (declining) return;
    if (activeCallId && activeCallId !== callId) return;
    declining = true;
    // Cancel an accept/start that is still awaiting the gateway.
    epoch += 1;
    stopTimers();
    stopRinging();
    releaseCallAudio();
    declinedCallId = callId;
    rejectNativeCall(callId, activeCallUuid ?? undefined);
    try {
      await mutateWithRetry(() => config.api.reject(callId, 'declined'));
    } finally {
      declining = false;
    }
    if (activeCallId === callId) activeCallId = null;
    // Drop the CallKit UUID too: leaving it behind makes a later end/reject target the previous
    // (already reported) call instead of the one on screen.
    activeCallUuid = null;
    store().markEnded();
    leaveCallScreen();
  }

  /** End an accepted call from the in-app End button. */
  async function end(reason = 'ended'): Promise<void> {
    const callId = activeCallId;
    epoch += 1;
    stopTimers();
    stopRinging();
    store().markEnding();
    if (callId) {
      endNativeCall(callId, activeCallUuid ?? undefined);
      await mutateWithRetry(() => config.api.end(callId, reason));
    }
    await leaveVoip();
    releaseCallAudio();
    activeCallId = null;
    activeCallUuid = null;
    store().markEnded();
    leaveCallScreen();
  }

  /** The ring surface's end event (Android notification/open, iOS CallKit end): reject or end. */
  async function handleNativeEnd(callId: string): Promise<void> {
    if (activeCallId && callId !== activeCallId) return;
    if (
      store().phase === 'idle' ||
      store().phase === 'ringing' ||
      store().phase === 'connecting'
    ) {
      await decline(callId);
      return;
    }
    await end('ended');
  }

  /** Mute/speaker/Bluetooth controls used by the active-call surface. */
  async function toggleMute(): Promise<void> {
    if (store().call?.mode === 'PSTN_BRIDGING') return;
    const next = !store().muted;
    store().setMuted(next);
    await setVoipMuted(next);
  }

  async function toggleSpeaker(): Promise<void> {
    if (store().call?.mode === 'PSTN_BRIDGING') return;
    const next = !store().speaker;
    store().setSpeaker(next);
    store().setAudioRoute(next ? 'speaker' : 'earpiece');
    await setVoipSpeaker(next);
  }

  async function routeToBluetooth(): Promise<void> {
    store().setSpeaker(false);
    store().setAudioRoute('bluetooth');
    await setVoipBluetooth();
  }

  /** One-tap "Switch to cellular call" for a failing/ringing VOIP leg. */
  async function switchToPstn(): Promise<void> {
    const callId = activeCallId;
    if (!callId || store().call?.mode === 'PSTN_BRIDGING') return;
    const myEpoch = epoch;
    const wasActive = store().phase === 'active';
    try {
      const call = await config.api.fallback(callId);
      // The user ended/dismissed (or another session began) while the request was in flight:
      // never resurrect an ended call by opening the dialer.
      if (myEpoch !== epoch || activeCallId !== callId) return;
      store().setCall(call);
      store().setFallbackPrompt(false);
      store().setNotice(null);
      fallbackPrompted = true;
      store().setReconnecting(false);
      await leaveVoip();
      if (wasActive) store().markActive();
      else store().markRinging();
      if (!(await openPstnLeg(call))) {
        await teardownFailedCall();
      }
    } catch (err) {
      // Never abandon a live leg: keep the call and surface the failure inline.
      if (myEpoch === epoch && activeCallId === callId) store().setNotice(messageFor(err));
    }
  }

  /**
   * Leave the call surface. While a server session is open, end/reject it first so the user is not
   * blocked by the one-open-call index after dismissing an error/ended screen.
   */
  async function dismiss(reason = 'dismissed'): Promise<void> {
    const callId = activeCallId;
    const phase = store().phase;
    epoch += 1;
    stopRinging();
    releaseCallAudio();
    if (callId) {
      stopTimers();
      endNativeCall(callId, activeCallUuid ?? undefined);
      if (phase === 'ringing' || phase === 'connecting') {
        await mutateWithRetry(() => config.api.reject(callId, reason));
      } else {
        await mutateWithRetry(() => config.api.end(callId, reason));
      }
      await leaveVoip();
    }
    clear();
  }

  /** Sign-out teardown: never leave a call row or native session belonging to the previous account. */
  async function shutdown(): Promise<void> {
    setNativeCallingAvailable(false);
    recovered = false;
    await dismiss('signed_out');
    if (appStateSub) {
      appStateSub.remove();
      appStateSub = null;
      appStateInstalled = false;
    }
  }

  /** Reset the surface after the screen has shown the ended/error state. */
  function clear(): void {
    stopTimers();
    stopRinging();
    epoch += 1;
    activeCallId = null;
    activeCallUuid = null;
    activeOrderId = null;
    fallbackPrompted = false;
    pendingNavigation = false;
    declinedCallId = null;
    store().reset();
  }

  function currentCallId(): string | null {
    return activeCallId;
  }

  function isOpen(): boolean {
    return OPEN_PHASES.has(store().phase);
  }

  return {
    bootstrap,
    initialize,
    flushPendingActiveCall,
    start,
    handleIncomingCall,
    accept,
    decline,
    end,
    handleNativeEnd,
    toggleMute,
    toggleSpeaker,
    routeToBluetooth,
    switchToPstn,
    dismiss,
    shutdown,
    clear,
    currentCallId,
    isOpen,
  };
}
