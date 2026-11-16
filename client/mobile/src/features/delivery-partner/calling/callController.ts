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

function store() {
  return useCallStore.getState();
}

function navigateToActiveCall(): void {
  if (!deliveryNavigationRef.isReady()) return;
  if (deliveryNavigationRef.getCurrentRoute()?.name === 'ActiveCall') return;
  deliveryNavigationRef.navigate('ActiveCall');
}

function leaveCallScreen(): void {
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
 * One-time native ringing setup. Safe to call on every app start; handlers attach exactly once.
 * A device that refuses the phone account still gets the in-app call surface.
 */
export async function initializeDeliveryCalling(): Promise<void> {
  if (initialised) return;
  initialised = true;
  await setupCallKeep();
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
    const micGranted = await ensureMicrophone();
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
    stopTimers();
    store().setError(messageFor(err));
  }
}

async function joinVoipLeg(call: DeliveryCall): Promise<void> {
  const bluetooth = await joinVoip(call, {
    onPeerJoined: () => {
      if (store().phase !== 'active') store().markActive();
      if (activeCallId) markNativeCallActive(activeCallId);
    },
    onReconnecting: () => store().setReconnecting(true),
    onReconnected: () => store().setReconnecting(false),
    onError: () => {
      // A media failure is the one case where the masked PSTN leg is the honest fallback.
      if (call.virtualNumber) store().setFallbackPrompt(true);
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
    if (
      !fallbackPrompted &&
      call.fallbackAvailable &&
      call.mode === 'VOIP' &&
      call.virtualNumber
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

/** Incoming push handler (see `incoming.ts`): ring natively and record the delivery receipt. */
export async function handleIncomingCall(data: Record<string, unknown>): Promise<void> {
  const callId = typeof data.callId === 'string' ? data.callId : '';
  if (!callId) return;
  const orderId = typeof data.orderId === 'string' ? data.orderId : '';
  const role = typeof data.peerRole === 'string' ? data.peerRole : 'CUSTOMER';
  const peerLabel = role === 'CUSTOMER' ? 'Customer' : 'Delivery Partner';

  // Already on a call: report busy so the caller hears it immediately.
  if (OPEN_PHASES.has(store().phase) && activeCallId !== callId) {
    await gateway.rejectDeliveryCall(callId, 'busy').catch(() => undefined);
    return;
  }

  activeCallId = callId;
  fallbackPrompted = false;
  store().beginIncoming(orderId, peerLabel);
  // The <3 s delivery receipt: proves this device woke and is ringing, so the server does not need
  // to fall back to PSTN.
  await gateway.ackDeliveryCallRinging(callId).catch(() => undefined);

  const native = await setupCallKeep();
  if (native) {
    const shown = displayIncomingCall(
      callId,
      `Delivery call${orderId ? ` · ${orderId.slice(-6)}` : ''}`,
    );
    if (!shown) navigateToActiveCall();
  } else {
    navigateToActiveCall();
  }
}

/** Native "answer" or the in-app Accept button. */
export async function acceptIncomingCall(callId: string): Promise<void> {
  try {
    // No mic permission → move the ringing VOIP session onto the masked PSTN leg before joining.
    if (!(await ensureMicrophone())) {
      await gateway.fallbackDeliveryCall(callId).catch(() => undefined);
    }
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

/** Reset the surface after the screen has shown the ended/error state. */
export function clearCall(): void {
  stopTimers();
  activeCallId = null;
  store().reset();
}

export function currentCallId(): string | null {
  return activeCallId;
}
