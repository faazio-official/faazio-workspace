import { create } from 'zustand';
import type { DeliveryCall } from '@/services/api/GatewayClient';

/**
 * Masked call state machine shared by the customer and delivery-partner apps. One call at a time
 * (the server enforces one open call per peer).
 *
 * `connecting` = initiate in flight; `ringing` = room/number allocated but the peer has not joined;
 * `active` = the other peer is present (VOIP) or the masked dialer is connected; `ending` = teardown.
 */
export type CallPhase = 'idle' | 'connecting' | 'ringing' | 'active' | 'ending' | 'ended' | 'error';

/** Active audio route. `earpiece` is the default for a phone-style call. */
export type CallAudioRoute = 'earpiece' | 'speaker' | 'bluetooth';

interface CallState {
  phase: CallPhase;
  call: DeliveryCall | null;
  orderId: string;
  /** Masked peer label ("Customer" / "Delivery Partner"). Never a phone number. */
  peerLabel: string;
  /** Local epoch ms when the call became active, for the timer. */
  connectedAt: number | null;
  muted: boolean;
  speaker: boolean;
  audioRoute: CallAudioRoute;
  bluetoothAvailable: boolean;
  /** True when this device is the callee (push-driven ringing). */
  incoming: boolean;
  /** VOIP connection is re-establishing after a network handoff. */
  reconnecting: boolean;
  /** Server says the VOIP leg can move to the masked PSTN number. */
  fallbackPrompt: boolean;
  /** Recoverable, non-fatal message shown inline (the call is still alive). */
  notice: string | null;
  error: string | null;

  begin: (orderId: string, peerLabel: string) => void;
  beginIncoming: (orderId: string, peerLabel: string) => void;
  setIncoming: (incoming: boolean) => void;
  setCall: (call: DeliveryCall) => void;
  markRinging: () => void;
  markActive: () => void;
  setMuted: (muted: boolean) => void;
  setSpeaker: (speaker: boolean) => void;
  setAudioRoute: (route: CallAudioRoute) => void;
  setBluetoothAvailable: (available: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setFallbackPrompt: (show: boolean) => void;
  setNotice: (notice: string | null) => void;
  setError: (error: string) => void;
  markEnding: () => void;
  markEnded: () => void;
  reset: () => void;
}

const initial = {
  phase: 'idle' as CallPhase,
  call: null as DeliveryCall | null,
  orderId: '',
  peerLabel: 'Customer',
  connectedAt: null as number | null,
  muted: false,
  speaker: false,
  audioRoute: 'earpiece' as CallAudioRoute,
  bluetoothAvailable: false,
  incoming: false,
  reconnecting: false,
  fallbackPrompt: false,
  notice: null as string | null,
  error: null as string | null,
};

export const useCallStore = create<CallState>()((set) => ({
  ...initial,

  begin: (orderId, peerLabel) =>
    set({ ...initial, phase: 'connecting', orderId, peerLabel }),
  beginIncoming: (orderId, peerLabel) =>
    set({ ...initial, phase: 'ringing', orderId, peerLabel, incoming: true }),
  setIncoming: (incoming) => set({ incoming }),
  setCall: (call) => set({ call }),
  markRinging: () => set({ phase: 'ringing' }),
  // A repeated "active" (peer event, poll, VOIP→PSTN switch) must not reset the call timer.
  markActive: () =>
    set((state) => ({ phase: 'active', connectedAt: state.connectedAt ?? Date.now() })),
  setMuted: (muted) => set({ muted }),
  setSpeaker: (speaker) => set({ speaker }),
  setAudioRoute: (audioRoute) =>
    set({ audioRoute, speaker: audioRoute === 'speaker' }),
  setBluetoothAvailable: (bluetoothAvailable) => set({ bluetoothAvailable }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setFallbackPrompt: (fallbackPrompt) => set({ fallbackPrompt }),
  setNotice: (notice) => set({ notice }),
  setError: (error) => set({ phase: 'error', error }),
  markEnding: () => set({ phase: 'ending' }),
  markEnded: () => set({ phase: 'ended' }),
  reset: () => set({ ...initial }),
}));
