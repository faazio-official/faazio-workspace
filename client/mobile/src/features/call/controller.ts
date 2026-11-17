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
  displayIncomingCall,
  endNativeCall,
  markNativeCallActive,
  rejectNativeCall,
  setNativeCallingAvailable,
  setupCallKeep,
  type CallKeepConfig,
} from './callkeep';

const OPEN_PHASES = new Set(['connecting', 'ringing', 'active', 'ending']);
const TERMINAL_STATUSES = new Set(['ENDED', 'REJECTED', 'FAILED', 'MISSED', 'BUSY']);

export interface CallNavigation {
  isReady(): boolean;
  currentRouteName(): string | undefined;
  navigateToActiveCall(): void;
  goBack(): void;
}

export interface CallControllerConfig {
  /** Product label used by CallKeep. */
  appName: string;
  /** Which `initiatedBy` value means "this device is the callee". */
  incomingInitiatedBy: 'CUSTOMER' | 'RIDER';
  defaultPeerLabel: string;
  peerLabelForRole: (role: string | undefined) => string;
  navigation: CallNavigation;
  callKeep: Omit<CallKeepConfig, 'appName'>;
  /**
   * Whether this product can resolve its own open call via `GET /delivery/calls/active`. The
   * endpoint is rider-scoped, so the customer product must not call it.
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
 * returned functions are safe to call from screens, FCM background handlers and native CallKeep
 * events.
 */
export function createCallController(config: CallControllerConfig): CallController {
  let activeCallId: string | null = null;
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
      onAnswer: (callId) => {
        void accept(callId);
      },
      onEnd: (callId) => {
        void handleNativeEnd(callId);
      },
    });
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
   * One-time native ringing setup. Safe to call on every app start and from a headless push handler.
   * Concurrent callers share one in-flight setup, so the phone-account prompt cannot double-fire.
   */
  async function initialize(): Promise<void> {
    setNativeCallingAvailable(true);
    ensureCallKeepHandlers();
    ensureAppState();
    if (!initialising) {
      initialising = (async () => {
        await setupCallKeep(callKeepOptions());
        await recoverOpenCall();
      })().finally(() => {
        initialising = null;
      });
    }
    await initialising;
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
    store().begin(orderId, peerLabel);
    navigateToActiveCall();

    try {
      // The explicit cellular path needs no microphone. Only ask when the VOIP leg may be used.
      const micGranted = opts.forcePstn ? false : await ensureMicrophone();
      if (myEpoch !== epoch) return;
      if (!opts.forcePstn) await ensureBluetooth();
      if (myEpoch !== epoch) return;
      const call = await gateway.initiateDeliveryCall(orderId, {
        forcePstn: !!opts.forcePstn || !micGranted,
      });
      // The user closed the surface while the server was creating the row. Release the
      // one-open-call lock instead of joining a call with no UI.
      if (myEpoch !== epoch) {
        await mutateWithRetry(() => gateway.rejectDeliveryCall(call.callId, 'cancelled'));
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
      await teardownFailedCall();
      store().setError(messageFor(err));
    }
  }

  /**
   * A failed start must not leave an open server row: the one-open-call index would then block every
   * later call until an operator intervenes. End (best-effort) before surfacing the error.
   */
  async function teardownFailedCall(): Promise<void> {
    stopTimers();
    stopRinging();
    const callId = activeCallId ?? store().call?.callId ?? null;
    await leaveVoip();
    if (callId) {
      endNativeCall(callId);
      await mutateWithRetry(() => gateway.endDeliveryCall(callId, 'start_failed'));
    }
    activeCallId = null;
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
        if (activeCallId) markNativeCallActive(activeCallId);
      },
      onPeerLeft: () => {
        if (store().phase !== 'active') return;
        stopRinging();
        const callId = activeCallId;
        stopTimers();
        void leaveVoip();
        if (callId) {
          endNativeCall(callId);
          void mutateWithRetry(() => gateway.endDeliveryCall(callId, 'peer_left'));
        }
        activeCallId = null;
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
    // The masked platform landline bridges to the peer. The app never dials the raw number.
    const url = `tel:${call.virtualNumber}`;
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (!canOpen) {
      store().setError('This device cannot open the phone dialer.');
      return false;
    }
    try {
      await Linking.openURL(url);
    } catch {
      store().setError('This device cannot open the phone dialer.');
      return false;
    }
    // No provider answer webhook exists yet: treat the system dialer opening as the active leg so
    // the surface does not stay on "Dialing…" forever. The timer starts at dialer open, not answer.
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
      const call = await gateway.getDeliveryCall(callId);
      if (callId !== activeCallId) return;
      store().setCall(call);
      // The callee's accept is authoritative; mirror it locally instead of waiting for the VOIP
      // peer event (which can be missed on a slow join).
      if (call.status === 'ACTIVE' && store().phase === 'ringing') {
        stopRinging();
        store().markActive();
        markNativeCallActive(callId);
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
        endNativeCall(callId);
        void leaveVoip();
        store().markEnded();
        activeCallId = null;
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
      call = await gateway.getActiveDeliveryCall();
    } catch {
      // Transient failure: leave `recovered` false so a later initialise can retry.
      return;
    }
    recovered = true;
    if (!call) return;
    activeCallId = call.callId;
    fallbackPrompted = false;
    if (call.status === 'RINGING' && call.initiatedBy === config.incomingInitiatedBy) {
      const peerLabel = config.peerLabelForRole(call.peerRole);
      store().beginIncoming(call.orderId, peerLabel);
      const shownNative = await showIncoming(call.callId, call.orderId, peerLabel);
      // Ack whenever a ring surface is visible — native *or* the foreground in-app surface.
      if (shownNative || AppState.currentState === 'active') {
        if (!shownNative) startRinging();
        void gateway.ackDeliveryCallRinging(call.callId).catch(() => undefined);
      }
      startPolling(call.callId);
      return;
    }
    // The old VOIP leg died with the app; end it so a new call is allowed.
    await mutateWithRetry(() => gateway.endDeliveryCall(call.callId, 'app_restarted'));
    activeCallId = null;
    store().reset();
  }

  /**
   * Native ringing when available, otherwise the in-app surface. Returns true when a native ring was
   * actually displayed; callers use that to decide whether the server needs the PSTN fallback.
   */
  async function showIncoming(
    callId: string,
    orderId: string,
    peerLabel: string,
  ): Promise<boolean> {
    const native = await setupCallKeep(callKeepOptions());
    if (native) {
      const suffix = orderId ? ` · #${orderId.slice(-6)}` : '';
      const shown = await displayIncomingCall(callId, `${peerLabel}${suffix}`);
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
    const peerLabel = config.peerLabelForRole(role);

    // A signed-out device must never wake for the previous account's calls.
    if (!(await ensureAuthenticated())) return;

    // A duplicate FCM delivery of the same push must not reset an already accepted/active call,
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
      await gateway.rejectDeliveryCall(callId, 'busy').catch(() => undefined);
      return;
    }

    ensureCallKeepHandlers();
    ensureAppState();
    activeCallId = callId;
    fallbackPrompted = false;
    declinedCallId = null;
    store().beginIncoming(orderId, peerLabel);
    const shownNative = await showIncoming(callId, orderId, peerLabel);
    // The <3 s delivery receipt stops the server falling back to PSTN. Only send it when a ring
    // surface is actually visible (native call, or the app is in the foreground); a headless device
    // with no phone account must let the server fall back instead.
    if (shownNative || AppState.currentState === 'active') {
      if (!shownNative) startRinging();
      void gateway.ackDeliveryCallRinging(callId).catch(() => undefined);
    }
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
      // No mic permission → move the ringing VOIP session onto the masked PSTN leg before joining.
      const micGranted = await ensureMicrophone();
      if (myEpoch !== epoch || declining) return;
      if (!micGranted) {
        const fallback = await gateway.fallbackDeliveryCall(callId).catch(() => null);
        if (myEpoch !== epoch || declining) return;
        // Never join a VOIP room without a microphone: the peer would hear silence.
        if (!fallback || fallback.mode !== 'PSTN_BRIDGING') {
          endNativeCall(callId);
          await teardownFailedCall();
          store().setError(config.messages.microphoneDenied);
          return;
        }
      }
      await ensureBluetooth();
      if (myEpoch !== epoch || declining) return;
      const call = await gateway.joinDeliveryCall(callId);
      if (myEpoch !== epoch || declining) {
        // The user declined/ended while the join was in flight.
        await mutateWithRetry(() => gateway.endDeliveryCall(call.callId, 'cancelled'));
        return;
      }
      activeCallId = call.callId;
      store().setCall(call);
      store().setIncoming(false);
      navigateToActiveCall();
      markNativeCallActive(call.callId);

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
      endNativeCall(callId);
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
    declinedCallId = callId;
    rejectNativeCall(callId);
    try {
      await mutateWithRetry(() => gateway.rejectDeliveryCall(callId, 'declined'));
    } finally {
      declining = false;
    }
    if (activeCallId === callId) activeCallId = null;
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
      endNativeCall(callId);
      await mutateWithRetry(() => gateway.endDeliveryCall(callId, reason));
    }
    await leaveVoip();
    activeCallId = null;
    store().markEnded();
    leaveCallScreen();
  }

  /** CallKeep's end event: reject while ringing, end once active. */
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
      const call = await gateway.fallbackDeliveryCall(callId);
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
    if (callId) {
      stopTimers();
      endNativeCall(callId);
      if (phase === 'ringing' || phase === 'connecting') {
        await mutateWithRetry(() => gateway.rejectDeliveryCall(callId, reason));
      } else {
        await mutateWithRetry(() => gateway.endDeliveryCall(callId, reason));
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
