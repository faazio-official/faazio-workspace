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

export interface VoipEvents {
  onPeerJoined: () => void;
  onReconnecting: () => void;
  onReconnected: () => void;
  onError: (message: string) => void;
}

export async function joinVoip(call: DeliveryCall, events: VoipEvents): Promise<boolean> {
  if (!call.authToken) throw new Error('voip_token_missing');
  await leaveVoip();
  const instance = await HMSSDK.build();
  sdk = instance;

  instance.addEventListener(HMSUpdateListenerActions.ON_PEER_UPDATE, () => {
    void instance
      .getRemotePeers()
      .then((peers) => {
        if (peers.length > 0) events.onPeerJoined();
      })
      .catch(() => undefined);
  });
  instance.addEventListener(HMSUpdateListenerActions.RECONNECTING, () => events.onReconnecting());
  instance.addEventListener(HMSUpdateListenerActions.RECONNECTED, () => events.onReconnected());
  instance.addEventListener(HMSUpdateListenerActions.ON_ERROR, (data: unknown) => {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error?: unknown }).error ?? 'voip_error')
        : 'voip_error';
    events.onError(message);
  });

  await instance.join(
    new HMSConfig({ username: 'Delivery Partner', authToken: call.authToken }),
  );
  // The remote peer may have joined before us; ON_PEER_UPDATE only fires on later changes.
  const peers = await instance.getRemotePeers().catch(() => []);
  if (peers.length > 0) events.onPeerJoined();
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
