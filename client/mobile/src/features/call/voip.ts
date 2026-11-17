import { Platform } from 'react-native';
import HMSSDK, {
  HMSAudioDevice,
  HMSConfig,
  HMSUpdateListenerActions,
} from '@100mslive/react-native-hms';
import type { CallAudioRoute } from '@/state/callStore';
import type { DeliveryCall } from '@/services/api/GatewayClient';

/**
 * Thin 100ms adapter for masked voice calls, shared by the customer and delivery-partner products.
 *
 * Lifecycle is owned by the shared call controller: this module only joins/leaves the room, routes
 * audio to a paired Bluetooth headset else the earpiece, tracks the active route and exposes
 * mute/speaker controls. It intentionally sends no analytics and logs no tokens.
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
  /** Native audio route changed (headset plugged, Bluetooth connected, speaker toggled). */
  onAudioRoute: (route: CallAudioRoute, bluetoothAvailable: boolean) => void;
}

export interface VoipJoinResult {
  route: CallAudioRoute;
  bluetoothAvailable: boolean;
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

function routeForDevice(device: string): CallAudioRoute {
  if (device === HMSAudioDevice.BLUETOOTH) return 'bluetooth';
  if (device === HMSAudioDevice.SPEAKER_PHONE) return 'speaker';
  return 'earpiece';
}

function hasBluetooth(devices: HMSAudioDevice[]): boolean {
  return devices.includes(HMSAudioDevice.BLUETOOTH);
}

export async function joinVoip(
  call: DeliveryCall,
  events: VoipEvents,
): Promise<VoipJoinResult> {
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
  // Android-only in the 100ms SDK; harmless where the SDK never emits it.
  listen(instance, HMSUpdateListenerActions.ON_AUDIO_DEVICE_CHANGED, (data: unknown) => {
    const device =
      typeof data === 'object' && data && 'device' in data
        ? String((data as { device?: unknown }).device ?? '')
        : '';
    const list =
      typeof data === 'object' && data && 'audioDevicesList' in data
        ? (data as { audioDevicesList?: unknown }).audioDevicesList
        : undefined;
    const devices = Array.isArray(list)
      ? (list.filter((item): item is string => typeof item === 'string') as HMSAudioDevice[])
      : [];
    events.onAudioRoute(routeForDevice(device), hasBluetooth(devices));
  });

  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      instance.join(new HMSConfig({ username: 'Faazio', authToken: call.authToken })),
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
 * a phone-style call. The 100ms routing helpers are Android-only: on iOS CallKit's audio session
 * (configured in `VoipCallManager.didActivate`) owns the route, so the app keeps the earpiece and the
 * headset's hands-free profile without an in-app switch.
 */
export async function routeBestAudio(): Promise<VoipJoinResult> {
  if (!sdk || Platform.OS !== 'android') {
    return { route: 'earpiece', bluetoothAvailable: false };
  }
  const devices = await sdk.getAudioDevicesList().catch(() => [] as HMSAudioDevice[]);
  const bluetooth = hasBluetooth(devices);
  const route: CallAudioRoute = bluetooth ? 'bluetooth' : 'earpiece';
  await sdk
    .switchAudioOutput(bluetooth ? HMSAudioDevice.BLUETOOTH : HMSAudioDevice.EARPIECE)
    .catch(() => undefined);
  return { route, bluetoothAvailable: bluetooth };
}

export async function setVoipMuted(muted: boolean): Promise<void> {
  try {
    const local = await sdk?.getLocalPeer();
    local?.localAudioTrack()?.setMute(muted);
  } catch {
    // A vanished local peer/track must not surface as an unhandled rejection.
  }
}

export async function setVoipSpeaker(speaker: boolean): Promise<void> {
  if (!sdk || Platform.OS !== 'android') return;
  await sdk
    .switchAudioOutput(speaker ? HMSAudioDevice.SPEAKER_PHONE : HMSAudioDevice.EARPIECE)
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
