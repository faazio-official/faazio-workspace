import { useCallStore } from '../callStore';
import type { DeliveryCall } from '@/services/api/GatewayClient';

function call(overrides: Partial<DeliveryCall> = {}): DeliveryCall {
  return {
    callId: 'c1',
    orderId: 'o1',
    riderId: 'r1',
    initiatedBy: 'RIDER',
    peerRole: 'CUSTOMER',
    mode: 'VOIP',
    status: 'RINGING',
    roomId: 'room',
    virtualNumber: '',
    fallbackAvailable: false,
    fallbackAfterSeconds: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('callStore', () => {
  beforeEach(() => useCallStore.getState().reset());

  it('starts a fresh session in connecting and clears prior state', () => {
    useCallStore.getState().setError('old error');
    useCallStore.getState().begin('o2', 'Customer');
    const state = useCallStore.getState();
    expect(state.phase).toBe('connecting');
    expect(state.orderId).toBe('o2');
    expect(state.error).toBeNull();
    expect(state.incoming).toBe(false);
  });

  it('marks incoming ringing without a connected timestamp', () => {
    useCallStore.getState().beginIncoming('o3', 'Delivery Partner');
    const state = useCallStore.getState();
    expect(state.phase).toBe('ringing');
    expect(state.incoming).toBe(true);
    expect(state.connectedAt).toBeNull();
  });

  it('never resets the timer when a repeated active update arrives', () => {
    useCallStore.getState().markActive();
    const first = useCallStore.getState().connectedAt;
    expect(first).not.toBeNull();
    useCallStore.getState().markActive();
    expect(useCallStore.getState().connectedAt).toBe(first);
  });

  it('derives the speaker flag from the audio route', () => {
    useCallStore.getState().setAudioRoute('speaker');
    expect(useCallStore.getState().speaker).toBe(true);
    useCallStore.getState().setAudioRoute('bluetooth');
    expect(useCallStore.getState().speaker).toBe(false);
  });

  it('keeps the call payload while preserving the session order id', () => {
    useCallStore.getState().begin('o4', 'Customer');
    useCallStore.getState().setCall(call());
    expect(useCallStore.getState().call?.callId).toBe('c1');
    expect(useCallStore.getState().orderId).toBe('o4');
  });
});
