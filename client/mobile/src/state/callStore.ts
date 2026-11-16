import { create } from 'zustand';
import type { DeliveryCall } from '@/services/api/GatewayClient';

/**
 * Delivery call state machine. One call at a time (the server enforces one open call per rider).
 *
 * `connecting` = initiate in flight; `ringing` = room/number allocated but the peer has not joined;
 * `active` = the other peer is present (VOIP) or the PSTN dialer was opened; `ending` = teardown.
 */
export type CallPhase = 'idle' | 'connecting' | 'ringing' | 'active' | 'ending' | 'ended' | 'error';

interface CallState {
  phase: CallPhase;
  call: DeliveryCall | null;
  orderId: string;
  /** Masked peer label ("Customer"). Never a phone number. */
  peerLabel: string;
  /** Local epoch ms when the call became active, for the timer. */
  connectedAt: number | null;
  muted: boolean;
  speaker: boolean;
  bluetoothAvailable: boolean;
  /** True when the rider is the callee (push-driven ringing). */
  incoming: boolean;
  /** VOIP connection is re-establishing after a network handoff. */
  reconnecting: boolean;
  /** Server says the VOIP leg can move to the masked PSTN number. */
  fallbackPrompt: boolean;
  error: string | null;

  begin: (orderId: string, peerLabel: string) => void;
  beginIncoming: (orderId: string, peerLabel: string) => void;
  setIncoming: (incoming: boolean) => void;
  setCall: (call: DeliveryCall) => void;
  markRinging: () => void;
  markActive: () => void;
  setMuted: (muted: boolean) => void;
  setSpeaker: (speaker: boolean) => void;
  setBluetoothAvailable: (available: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setFallbackPrompt: (show: boolean) => void;
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
  bluetoothAvailable: false,
  incoming: false,
  reconnecting: false,
  fallbackPrompt: false,
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
  markActive: () => set({ phase: 'active', connectedAt: Date.now() }),
  setMuted: (muted) => set({ muted }),
  setSpeaker: (speaker) => set({ speaker }),
  setBluetoothAvailable: (bluetoothAvailable) => set({ bluetoothAvailable }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setFallbackPrompt: (fallbackPrompt) => set({ fallbackPrompt }),
  setError: (error) => set({ phase: 'error', error }),
  markEnding: () => set({ phase: 'ending' }),
  markEnded: () => set({ phase: 'ended' }),
  reset: () => set({ ...initial }),
}));
