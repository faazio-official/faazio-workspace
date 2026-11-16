import { Platform } from 'react-native';
import HMSSDK, {
  HMSAudioDevice,
  HMSConfig,
  HMSUpdateListenerActions,
} from '@100mslive/react-native-hms';
import type { DeliveryCall } from '@/services/api/GatewayClient';

/**
 * Thin 100ms adapter for delivery voice calls.
 *
 * Lifecycle is owned by `callController`: this module only joins/leaves the room, routes audio to
 * the earpiece (or a paired Bluetooth headset) and exposes mute/speaker controls. It intentionally
 * sends no analytics and logs no tokens.
 */
let sdk: HMSSDK | null = null;
const attached = new Set<HMSUpdateListenerActions>();

/** Room join must not hang forever: a stalled SDK must fall back to the masked PSTN leg. */
const JOIN_TIMEOUT_MS = 15000;

export interface VoipEvents {
  onPeerJoined: () => void;
  /** The only remote peer left (or we were removed) — the call is over. */
  onPeerLeft: () => void;
  onReconnecting: () => void;
  onReconnected: () => void;
  onError: (message: string) => void;
}

function listen(
  instance: HMSSDK,
  action: HMSUpdateListenerActions,
  handler: (event?: unknown) => void,
): void {
  instance.addEventListener(action, handler);
  attached.add(action);
}

function detachAll(instance: HMSSDK): void {
  for (const action of attached) {
    try {
      instance.removeEventListener(action);
    } catch {
      // Native listener already gone.
    }
  }
  attached.clear();
}

export async function joinVoip(call: DeliveryCall, events: VoipEvents): Promise<boolean> {
  if (!call.authToken) throw new Error('voip_token_missing');
  await leaveVoip();
  const instance = await HMSSDK.build();
  sdk = instance;

  let hadPeer = false;
  const checkPeers = () => {
    void instance
      .getRemotePeers()
      .then((peers) => {
        if (peers.length > 0) {
          hadPeer = true;
          events.onPeerJoined();
        } else if (hadPeer) {
          hadPeer = false;
          events.onPeerLeft();
        }
      })
      .catch(() => undefined);
  };

  listen(instance, HMSUpdateListenerActions.ON_PEER_UPDATE, checkPeers);
  listen(instance, HMSUpdateListenerActions.ON_PEER_LIST_UPDATED, checkPeers);
  listen(instance, HMSUpdateListenerActions.ON_REMOVED_FROM_ROOM, () => events.onPeerLeft());
  listen(instance, HMSUpdateListenerActions.RECONNECTING, () => events.onReconnecting());
  listen(instance, HMSUpdateListenerActions.RECONNECTED, () => events.onReconnected());
  listen(instance, HMSUpdateListenerActions.ON_ERROR, (data: unknown) => {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error?: unknown }).error ?? 'voip_error')
        : 'voip_error';
    events.onError(message);
  });

  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      instance.join(new HMSConfig({ username: 'Delivery Partner', authToken: call.authToken })),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('voip_join_timeout')), JOIN_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    await leaveVoip();
    throw err;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  // The remote peer may have joined before us; peer events only fire on later changes.
  const peers = await instance.getRemotePeers().catch(() => []);
  if (peers.length > 0) {
    hadPeer = true;
    events.onPeerJoined();
  }
  return routeBestAudio();
}

/**
 * Prefer a paired Bluetooth headset (helmet intercom), else the earpiece. Never the loudspeaker for
 * a phone-style call. Android-only API; iOS is not a delivery-partner product.
 */
export async function routeBestAudio(): Promise<boolean> {
  if (!sdk || Platform.OS !== 'android') return false;
  const devices = await sdk.getAudioDevicesList().catch(() => [] as HMSAudioDevice[]);
  const bluetooth = devices.includes(HMSAudioDevice.BLUETOOTH);
  await sdk
    .switchAudioOutput(bluetooth ? HMSAudioDevice.BLUETOOTH : HMSAudioDevice.EARPIECE)
    .catch(() => undefined);
  return bluetooth;
}

export async function setVoipMuted(muted: boolean): Promise<void> {
  const local = await sdk?.getLocalPeer().catch(() => undefined);
  local?.localAudioTrack()?.setMute(muted);
}

export async function setVoipSpeaker(speaker: boolean): Promise<void> {
  if (!sdk || Platform.OS !== 'android') return;
  await sdk
    .switchAudioOutput(
      speaker ? HMSAudioDevice.SPEAKER_PHONE : HMSAudioDevice.EARPIECE,
    )
    .catch(() => undefined);
}

export async function setVoipBluetooth(): Promise<void> {
  if (!sdk || Platform.OS !== 'android') return;
  await sdk.switchAudioOutput(HMSAudioDevice.BLUETOOTH).catch(() => undefined);
}

export async function leaveVoip(): Promise<void> {
  const current = sdk;
  sdk = null;
  if (!current) return;
  detachAll(current);
  try {
    await current.leave();
  } catch {
    // Already disconnected — teardown must still succeed.
  }
  try {
    await current.destroy();
  } catch {
    // Native instance may already be gone.
  }
}
