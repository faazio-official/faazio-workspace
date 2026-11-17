import { Linking } from 'react-native';
import { createCallController } from '../controller';
import { useCallStore } from '@/state/callStore';
import { gateway, GatewayHttpError, type DeliveryCall } from '@/services/api/GatewayClient';
import { joinVoip } from '../voip';

jest.mock('@/services/api/GatewayClient', () => ({
  gateway: {
    initiateDeliveryCall: jest.fn(),
    getDeliveryCall: jest.fn(),
    getActiveDeliveryCall: jest.fn(),
    ackDeliveryCallRinging: jest.fn(),
    joinDeliveryCall: jest.fn(),
    rejectDeliveryCall: jest.fn(),
    endDeliveryCall: jest.fn(),
    fallbackDeliveryCall: jest.fn(),
  },
  GatewayHttpError: class GatewayHttpError extends Error {
    status: number;
    code?: string;
    constructor(status: number, code?: string, message?: string) {
      super(message ?? 'gateway ' + status);
      this.name = 'GatewayHttpError';
      this.status = status;
      this.code = code;
    }
  },
  GatewayOfflineError: class GatewayOfflineError extends Error {},
}));

jest.mock('@/state/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      hydrated: true,
      isAuthenticated: true,
      hydrate: async () => true,
    }),
  },
}));

jest.mock('../voip', () => ({
  joinVoip: jest.fn(),
  leaveVoip: jest.fn(async () => undefined),
  setVoipBluetooth: jest.fn(),
  setVoipMuted: jest.fn(),
  setVoipSpeaker: jest.fn(),
}));

jest.mock('../callkeep', () => ({
  attachCallKeepHandlers: jest.fn(),
  bringCallToForeground: jest.fn(),
  displayIncomingCall: jest.fn(async () => false),
  endNativeCall: jest.fn(),
  markNativeCallActive: jest.fn(),
  rejectNativeCall: jest.fn(),
  requestMicrophone: jest.fn(async () => true),
  setNativeCallingAvailable: jest.fn(),
  setupCallKeep: jest.fn(async () => false),
}));

jest.mock('../ringtone', () => ({
  startRinging: jest.fn(),
  stopRinging: jest.fn(),
}));

function makeCall(overrides: Partial<DeliveryCall> = {}): DeliveryCall {
  return {
    callId: 'c1',
    orderId: 'o1',
    riderId: 'r1',
    initiatedBy: 'RIDER',
    peerRole: 'CUSTOMER',
    mode: 'VOIP',
    status: 'RINGING',
    authToken: 'token',
    roomId: 'room',
    virtualNumber: '+919999999999',
    fallbackAvailable: false,
    fallbackAfterSeconds: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeController() {
  return createCallController({
    appName: 'Faazio Test',
    incomingInitiatedBy: 'CUSTOMER',
    defaultPeerLabel: 'Customer',
    peerLabelForRole: () => 'Customer',
    navigation: {
      isReady: () => true,
      currentRouteName: () => 'Dashboard',
      navigateToActiveCall: jest.fn(),
      goBack: jest.fn(),
    },
    api: {
      initiate: (orderId, opts) => gateway.initiateDeliveryCall(orderId, opts),
      getActive: () => gateway.getActiveDeliveryCall(),
      get: (callId) => gateway.getDeliveryCall(callId),
      ackRinging: (callId) => gateway.ackDeliveryCallRinging(callId),
      join: (callId) => gateway.joinDeliveryCall(callId),
      reject: (callId, reason) => gateway.rejectDeliveryCall(callId, reason),
      end: (callId, reason) => gateway.endDeliveryCall(callId, reason),
      fallback: (callId) => gateway.fallbackDeliveryCall(callId),
    },
    callKeep: {
      channelId: 'test_calls',
      channelName: 'Test calls',
      notificationTitle: 'Test call',
    },
    recoverActiveCall: false,
    micPrompt: { title: 'Mic', message: 'Mic', negative: 'No' },
    bluetoothPrompt: { title: 'BT', message: 'BT' },
    messages: {
      offline: 'offline',
      orderNotAccepted: 'not accepted',
      unavailable: 'unavailable',
      notFound: 'not found',
      conflict: 'conflict',
      microphoneDenied: 'mic denied',
      generic: 'generic',
    },
  });
}

const gatewayMock = gateway as unknown as {
  initiateDeliveryCall: jest.Mock;
  joinDeliveryCall: jest.Mock;
  rejectDeliveryCall: jest.Mock;
  endDeliveryCall: jest.Mock;
  fallbackDeliveryCall: jest.Mock;
  getDeliveryCall: jest.Mock;
  getActiveDeliveryCall: jest.Mock;
  ackDeliveryCallRinging: jest.Mock;
};

describe('shared call controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCallStore.getState().reset();
    gatewayMock.initiateDeliveryCall.mockResolvedValue(makeCall());
    gatewayMock.joinDeliveryCall.mockResolvedValue(makeCall({ status: 'ACTIVE' }));
    gatewayMock.rejectDeliveryCall.mockResolvedValue(makeCall({ status: 'REJECTED' }));
    gatewayMock.endDeliveryCall.mockResolvedValue(makeCall({ status: 'ENDED' }));
    gatewayMock.fallbackDeliveryCall.mockResolvedValue(
      makeCall({ mode: 'PSTN_BRIDGING' }),
    );
    gatewayMock.getDeliveryCall.mockResolvedValue(makeCall());
    gatewayMock.ackDeliveryCallRinging.mockResolvedValue(makeCall());
    (joinVoip as jest.Mock).mockResolvedValue({ route: 'earpiece', bluetoothAvailable: false });
  });

  it('releases the server row instead of joining a call the user already left', async () => {
    const initiate = deferred<DeliveryCall>();
    gatewayMock.initiateDeliveryCall.mockReturnValue(initiate.promise);
    const controller = makeController();

    const starting = controller.start('o1', 'Customer');
    await flush();
    // The user backs out while the gateway is still creating the row.
    await controller.dismiss('back');
    initiate.resolve(makeCall());
    await starting;

    expect(joinVoip).not.toHaveBeenCalled();
    expect(gatewayMock.rejectDeliveryCall).toHaveBeenCalledWith('c1', 'cancelled');
    expect(useCallStore.getState().phase).toBe('idle');
  });

  it('never reopens the dialer when a PSTN switch resolves after the call ended', async () => {
    const canOpen = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const fallback = deferred<DeliveryCall>();
    gatewayMock.fallbackDeliveryCall.mockReturnValue(fallback.promise);
    const controller = makeController();

    await controller.start('o1', 'Customer');
    expect(useCallStore.getState().phase).toBe('ringing');

    const switching = controller.switchToPstn();
    await flush();
    await controller.end('ended');
    fallback.resolve(makeCall({ mode: 'PSTN_BRIDGING' }));
    await switching;

    expect(open).not.toHaveBeenCalled();
    canOpen.mockRestore();
    open.mockRestore();
  });

  it('does not join media when the user declines while accept is in flight', async () => {
    const controller = makeController();
    await controller.handleIncomingCall({ callId: 'c1', orderId: 'o1', peerRole: 'CUSTOMER' });
    expect(useCallStore.getState().phase).toBe('ringing');
    expect(useCallStore.getState().incoming).toBe(true);

    const join = deferred<DeliveryCall>();
    gatewayMock.joinDeliveryCall.mockReturnValue(join.promise);
    const accepting = controller.accept('c1');
    await flush();
    await controller.decline('c1');
    join.resolve(makeCall({ status: 'ACTIVE' }));
    await accepting;

    expect(joinVoip).not.toHaveBeenCalled();
    expect(gatewayMock.endDeliveryCall).toHaveBeenCalledWith('c1', 'cancelled');
    expect(useCallStore.getState().phase).toBe('ended');
  });

  it('adopts a stale ringing call on conflict and re-joins through the server for a token', async () => {
    // `getActive` returns the tokenless projection, so adopting it must mint a token via join —
    // joining the projection directly would fail media silently.
    gatewayMock.initiateDeliveryCall.mockRejectedValue(
      new GatewayHttpError(409, 'conflict'),
    );
    gatewayMock.getActiveDeliveryCall.mockResolvedValue(
      makeCall({ callId: 'stale', authToken: undefined, status: 'RINGING' }),
    );
    gatewayMock.joinDeliveryCall.mockResolvedValue(
      makeCall({ callId: 'stale', status: 'ACTIVE', authToken: 'fresh' }),
    );
    const controller = makeController();

    await controller.start('o1', 'Customer');

    expect(gatewayMock.joinDeliveryCall).toHaveBeenCalledWith('stale');
    expect(joinVoip).toHaveBeenCalledWith(
      expect.objectContaining({ callId: 'stale', authToken: 'fresh' }),
      expect.anything(),
    );
    expect(useCallStore.getState().phase).not.toBe('error');
    // Adopting starts status polling; end the session so no timer outlives the test.
    await controller.dismiss();
  });

  it('ends a stale call it cannot adopt so the one-open-call lock is released', async () => {
    gatewayMock.initiateDeliveryCall.mockRejectedValue(
      new GatewayHttpError(409, 'conflict'),
    );
    gatewayMock.getActiveDeliveryCall.mockResolvedValue(
      makeCall({ callId: 'stale', status: 'ACTIVE' }),
    );
    const controller = makeController();

    await controller.start('o1', 'Customer');

    expect(gatewayMock.endDeliveryCall).toHaveBeenCalledWith('stale', 'stale_session');
    expect(joinVoip).not.toHaveBeenCalled();
  });
});
