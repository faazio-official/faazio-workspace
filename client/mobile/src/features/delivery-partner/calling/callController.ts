import { Linking, PermissionsAndroid, Platform } from 'react-native';
import {
  gateway,
  GatewayHttpError,
  GatewayOfflineError,
  type DeliveryCall,
} from '@/services/api/GatewayClient';
import { useCallStore } from '@/state/callStore';
import { deliveryNavigationRef } from '../navigationRef';
import {
  joinVoip,
  leaveVoip,
  setVoipBluetooth,
  setVoipMuted,
  setVoipSpeaker,
} from './voip';
import {
  attachCallKeepHandlers,
  displayIncomingCall,
  endNativeCall,
  markNativeCallActive,
  setupCallKeep,
} from './callkeep';

const OPEN_PHASES = new Set(['connecting', 'ringing', 'active', 'ending']);
const TERMINAL_STATUSES = new Set(['ENDED', 'REJECTED', 'FAILED', 'MISSED', 'BUSY']);

let activeCallId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lockUntil = 0;
let fallbackPrompted = false;
let initialised = false;
let pendingNavigation = false;

function store() {
  return useCallStore.getState();
}

function navigateToActiveCall(): void {
  if (!deliveryNavigationRef.isReady()) {
    pendingNavigation = true;
    return;
  }
  pendingNavigation = false;
  if (deliveryNavigationRef.getCurrentRoute()?.name === 'ActiveCall') return;
  deliveryNavigationRef.navigate('ActiveCall');
}

/** Flush a call navigation that fired before the NavigationContainer was ready (cold start). */
export function flushPendingActiveCall(): void {
  if (pendingNavigation && store().phase !== 'idle') {
    navigateToActiveCall();
    return;
  }
  pendingNavigation = false;
}

function leaveCallScreen(): void {
  pendingNavigation = false;
  if (!deliveryNavigationRef.isReady()) return;
  if (deliveryNavigationRef.getCurrentRoute()?.name === 'ActiveCall') {
    deliveryNavigationRef.goBack();
  }
}

function stopTimers(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function messageFor(err: unknown): string {
  if (err instanceof GatewayOfflineError) {
    return 'You are offline. Calling needs a live connection.';
  }
  if (err instanceof GatewayHttpError) {
    switch (err.code) {
      case 'order_not_accepted':
        return 'Accept the delivery before calling the customer.';
      case 'calling_unavailable':
        return 'Calling is not configured for this account yet.';
      case 'not_found':
        return 'This call is no longer available.';
      case 'conflict':
        return err.message?.toLowerCase().includes('open call')
          ? 'Finish the current call first.'
          : 'This call is no longer available.';
      default:
        return 'Could not start the call. Please try again.';
    }
  }
  return 'Could not start the call. Please try again.';
}

function isTerminal(call: DeliveryCall): boolean {
  return TERMINAL_STATUSES.has(call.status);
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
        title: 'Microphone for delivery calls',
        message:
          'Faazio uses the microphone only while you are on a delivery call. You can still use the secure phone line without it.',
        buttonPositive: 'Allow',
        buttonNegative: 'Use phone line',
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
      title: 'Bluetooth for delivery calls',
      message:
        'Allow Bluetooth so a paired helmet or headset can be used for delivery calls. You can decline and use the earpiece.',
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
      void acceptIncomingCall(callId);
    },
    onEnd: (callId) => {
      void handleNativeEnd(callId);
    },
  });
}

/**
 * One-time native ringing setup. Safe to call on every app start; handlers attach exactly once and a
 * failed phone-account setup is retried on the next call instead of being treated as configured.
 */
export async function initializeDeliveryCalling(): Promise<void> {
  ensureCallKeepHandlers();
  if (!initialised) initialised = await setupCallKeep();
  await recoverOpenCall();
}

/**
 * Rider taps "Call". The server chooses VOIP or PSTN; this controller only renders that choice.
 * Locked for 3 s to prevent a double tap creating two sessions.
 */
export async function startDeliveryCall(
  orderId: string,
  peerLabel = 'Customer',
  opts: { forcePstn?: boolean } = {},
): Promise<void> {
  const phase = store().phase;
  if (OPEN_PHASES.has(phase)) return;
  if (Date.now() < lockUntil) return;
  lockUntil = Date.now() + 3000;

  stopTimers();
  fallbackPrompted = false;
  store().begin(orderId, peerLabel);
  navigateToActiveCall();

  try {
    // The explicit cellular path needs no microphone. Only ask when the VOIP leg may be used.
    const micGranted = opts.forcePstn ? false : await ensureMicrophone();
    if (!opts.forcePstn) await ensureBluetooth();
    const call = await gateway.initiateDeliveryCall(orderId, {
      forcePstn: !!opts.forcePstn || !micGranted,
    });
    activeCallId = call.callId;
    store().setCall(call);

    if (call.mode === 'VOIP') {
      store().markRinging();
      await joinVoipLeg(call);
    } else {
      store().markRinging();
      await openPstnLeg(call);
    }
    startPolling(call.callId);
  } catch (err) {
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
  const callId = activeCallId ?? store().call?.callId ?? null;
  await leaveVoip();
  if (callId) await gateway.endDeliveryCall(callId, 'start_failed').catch(() => undefined);
  activeCallId = null;
}

async function joinVoipLeg(call: DeliveryCall): Promise<void> {
  const bluetooth = await joinVoip(call, {
    onPeerJoined: () => {
      if (store().phase !== 'active') store().markActive();
      if (activeCallId) markNativeCallActive(activeCallId);
    },
    onPeerLeft: () => {
      if (store().phase !== 'active') return;
      const callId = activeCallId;
      stopTimers();
      void leaveVoip();
      if (callId) void gateway.endDeliveryCall(callId, 'peer_left').catch(() => undefined);
      activeCallId = null;
      store().markEnded();
    },
    onReconnecting: () => store().setReconnecting(true),
    onReconnected: () => store().setReconnecting(false),
    onError: () => {
      // A media failure is the one case where the masked PSTN leg is the honest fallback.
      if (call.virtualNumber && store().phase === 'ringing') store().setFallbackPrompt(true);
    },
  });
  store().setBluetoothAvailable(bluetooth);
}

async function openPstnLeg(call: DeliveryCall): Promise<void> {
  if (!call.virtualNumber) {
    store().setError('No secure calling line is configured.');
    return;
  }
  // The masked platform landline bridges to the customer. The app never dials the raw number.
  await Linking.openURL(`tel:${call.virtualNumber}`);
}

function startPolling(callId: string): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    void refreshCall(callId);
  }, 2000);
}

async function refreshCall(callId: string): Promise<void> {
  try {
    const call = await gateway.getDeliveryCall(callId);
    store().setCall(call);
    // The callee's accept is authoritative; mirror it locally instead of waiting for the VOIP
    // peer event (which can be missed on a slow join).
    if (call.status === 'ACTIVE' && store().phase === 'ringing') {
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
      if (callId) endNativeCall(callId);
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
 * still ringing is re-surfaced; an outgoing/active call cannot rejoin without a fresh token, so it is
 * ended to release the one-open-call lock rather than stranding the rider.
 */
async function recoverOpenCall(): Promise<void> {
  if (OPEN_PHASES.has(store().phase)) return;
  let call: DeliveryCall | null = null;
  try {
    call = await gateway.getActiveDeliveryCall();
  } catch {
    return;
  }
  if (!call) return;
  activeCallId = call.callId;
  if (call.status === 'RINGING' && call.initiatedBy === 'CUSTOMER') {
    store().beginIncoming(call.orderId, 'Customer');
    await showIncoming(call.callId, call.orderId);
    startPolling(call.callId);
    return;
  }
  // The old VOIP leg died with the app; end it so a new call is allowed.
  await gateway.endDeliveryCall(call.callId, 'app_restarted').catch(() => undefined);
  activeCallId = null;
  store().reset();
}

/** Native ringing when available, otherwise the in-app surface. Shared by push and recovery. */
async function showIncoming(callId: string, orderId: string): Promise<void> {
  const native = await setupCallKeep();
  if (native) {
    const shown = await displayIncomingCall(
      callId,
      `Delivery call${orderId ? ` · ${orderId.slice(-6)}` : ''}`,
    );
    if (!shown) navigateToActiveCall();
  } else {
    navigateToActiveCall();
  }
}

/** Incoming push handler (see `incoming.ts`): ring natively and record the delivery receipt. */
export async function handleIncomingCall(data: Record<string, unknown>): Promise<void> {
  const callId = typeof data.callId === 'string' ? data.callId : '';
  if (!callId) return;
  const orderId = typeof data.orderId === 'string' ? data.orderId : '';
  const role = typeof data.peerRole === 'string' ? data.peerRole : 'CUSTOMER';
  const peerLabel = role === 'CUSTOMER' ? 'Customer' : 'Delivery Partner';

  // A duplicate FCM delivery of the same push must not reset an already accepted/active call.
  if (activeCallId === callId && OPEN_PHASES.has(store().phase)) return;

  // Already on a call: report busy so the caller hears it immediately.
  if (OPEN_PHASES.has(store().phase) && activeCallId !== callId) {
    await gateway.rejectDeliveryCall(callId, 'busy').catch(() => undefined);
    return;
  }

  ensureCallKeepHandlers();
  activeCallId = callId;
  fallbackPrompted = false;
  store().beginIncoming(orderId, peerLabel);
  // The <3 s delivery receipt: proves this device woke and is ringing, so the server does not need
  // to fall back to PSTN. Fire-and-forget so the native ring is not delayed by a network round-trip.
  void gateway.ackDeliveryCallRinging(callId).catch(() => undefined);
  await showIncoming(callId, orderId);
}

/** Native "answer" or the in-app Accept button. */
export async function acceptIncomingCall(callId: string): Promise<void> {
  try {
    // No mic permission → move the ringing VOIP session onto the masked PSTN leg before joining.
    if (!(await ensureMicrophone())) {
      await gateway.fallbackDeliveryCall(callId).catch(() => undefined);
    }
    await ensureBluetooth();
    const call = await gateway.joinDeliveryCall(callId);
    activeCallId = call.callId;
    store().setCall(call);
    store().setIncoming(false);
    navigateToActiveCall();
    markNativeCallActive(call.callId);

    if (call.mode === 'VOIP') {
      await joinVoipLeg(call);
    } else {
      markNativeCallActive(call.callId);
      store().markActive();
      await openPstnLeg(call);
    }
    startPolling(call.callId);
  } catch (err) {
    void endNativeCall(callId);
    await teardownFailedCall();
    store().setError(messageFor(err));
  }
}

/** Native "decline" or the in-app Reject button. */
export async function declineIncomingCall(callId: string): Promise<void> {
  stopTimers();
  endNativeCall(callId);
  await gateway.rejectDeliveryCall(callId, 'declined').catch(() => undefined);
  activeCallId = null;
  store().markEnded();
  leaveCallScreen();
}

/** End an accepted call from the in-app End button. */
export async function endActiveCall(reason = 'ended'): Promise<void> {
  const callId = activeCallId;
  store().markEnding();
  stopTimers();
  if (callId) {
    endNativeCall(callId);
    await gateway.endDeliveryCall(callId, reason).catch(() => undefined);
  }
  await leaveVoip();
  activeCallId = null;
  store().markEnded();
  leaveCallScreen();
}

/** CallKeep's end event: reject while ringing, end once active. */
export async function handleNativeEnd(callId: string): Promise<void> {
  if (
    store().phase === 'idle' ||
    store().phase === 'ringing' ||
    store().phase === 'connecting'
  ) {
    await declineIncomingCall(callId);
    return;
  }
  await endActiveCall('ended');
}

/** Mute/speaker/Bluetooth controls used by ActiveCallScreen. */
export async function toggleMute(): Promise<void> {
  const next = !store().muted;
  store().setMuted(next);
  await setVoipMuted(next);
}

export async function toggleSpeaker(): Promise<void> {
  const next = !store().speaker;
  store().setSpeaker(next);
  await setVoipSpeaker(next);
}

export async function routeToBluetooth(): Promise<void> {
  store().setSpeaker(false);
  await setVoipBluetooth();
}

/** One-tap "Switch to cellular call" for a failing/ringing VOIP leg. */
export async function switchCallToPstn(): Promise<void> {
  const callId = activeCallId;
  if (!callId) return;
  const wasActive = store().phase === 'active';
  try {
    const call = await gateway.fallbackDeliveryCall(callId);
    store().setCall(call);
    store().setFallbackPrompt(false);
    fallbackPrompted = true;
    store().setReconnecting(false);
    await leaveVoip();
    if (wasActive) store().markActive();
    else store().markRinging();
    await openPstnLeg(call);
  } catch (err) {
    store().setError(messageFor(err));
  }
}

/**
 * Leave the call surface. While a server session is open, end/reject it first so the rider is not
 * blocked by the one-open-call index after dismissing an error/ended screen.
 */
export async function dismissCall(reason = 'dismissed'): Promise<void> {
  const callId = activeCallId;
  const phase = store().phase;
  if (callId) {
    stopTimers();
    endNativeCall(callId);
    if (phase === 'ringing' || phase === 'connecting') {
      await gateway.rejectDeliveryCall(callId, reason).catch(() => undefined);
    } else {
      await gateway.endDeliveryCall(callId, reason).catch(() => undefined);
    }
    await leaveVoip();
  }
  clearCall();
}

/** Sign-out teardown: never leave a call row or native session belonging to the previous account. */
export async function shutdownCalling(): Promise<void> {
  await dismissCall('signed_out');
}

/** Reset the surface after the screen has shown the ended/error state. */
export function clearCall(): void {
  stopTimers();
  activeCallId = null;
  fallbackPrompted = false;
  pendingNavigation = false;
  store().reset();
}

export function currentCallId(): string | null {
  return activeCallId;
}
