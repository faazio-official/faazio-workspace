import { useEffect } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { gateway } from '@/services/api/GatewayClient';
import { getCoarsePosition, requestLocationPermission } from '@/services/location';
import {
  loadIOSBackgroundConsent,
  saveIOSBackgroundConsent,
  startIOSBackgroundLocation,
  stopIOSBackgroundLocation,
} from '@/services/deliveryBackgroundLocation';
import { startDeliveryTracking, stopDeliveryTracking } from '@/services/deliveryTracking';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';

const HEARTBEAT_MS = 120_000;

let heartbeat: ReturnType<typeof setInterval> | null = null;

function stopHeartbeat() {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

async function sendHeartbeat() {
  if (AppState.currentState !== 'active') return;
  try {
    const fix = await getCoarsePosition();
    await gateway.sendDeliveryHeartbeat(fix.latitude, fix.longitude);
  } catch {
    // A missed heartbeat is non-fatal: the Valkey key expires and dispatch skips this rider.
  }
}

function startHeartbeat() {
  stopHeartbeat();
  void sendHeartbeat();
  heartbeat = setInterval(() => void sendHeartbeat(), HEARTBEAT_MS);
}

function confirmIOSBackground(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  return new Promise((resolve) => {
    Alert.alert(
      'Keep offers coming',
      'Faazio needs background location while you are online so dispatch can still find you when the app is not open. You can choose “Allow While Using” to stay foreground-only.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Toggle the rider's shift presence from anywhere in the app. The top bar on every page calls
 * this; the shared `useDeliveryShiftLifecycle` hook starts/stops the heartbeat and tracking.
 */
export async function toggleDeliveryOnline(next: boolean): Promise<void> {
  if (next) {
    const granted = await requestLocationPermission();
    if (!granted) {
      throw new Error('Location permission is required to go online.');
    }
    if (Platform.OS === 'ios') {
      const allowBackground = await confirmIOSBackground();
      useDeliveryPartnerStore.getState().setIosBackgroundAllowed(allowBackground);
      await saveIOSBackgroundConsent(allowBackground);
      if (allowBackground) startIOSBackgroundLocation({ prompt: true });
    }
  } else {
    useDeliveryPartnerStore.getState().setIosBackgroundAllowed(false);
    stopIOSBackgroundLocation();
  }
  await gateway.setDeliveryAvailability(next);
  useDeliveryPartnerStore.getState().setOnline(next);
}

/**
 * Single owner of the online heartbeat + location tracking lifecycle. Mounted once at the app
 * root so presence toggled from any page keeps dispatch updates running.
 */
export function useDeliveryShiftLifecycle() {
  const online = useDeliveryPartnerStore((s) => s.online);
  const iosBackgroundAllowed = useDeliveryPartnerStore((s) => s.iosBackgroundAllowed);

  // Resume a previously-granted background consent after a cold start (no OS prompt).
  useEffect(() => {
    let active = true;
    void loadIOSBackgroundConsent().then((allowed) => {
      if (active) useDeliveryPartnerStore.getState().setIosBackgroundAllowed(allowed);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!online) {
      stopHeartbeat();
      stopIOSBackgroundLocation();
      void stopDeliveryTracking();
      return;
    }
    startHeartbeat();
    // Android owns background wakes natively; iOS uses the CoreLocation watch below.
    // The JS interval intentionally bails when the app is not active so the two never duplicate.
    void startDeliveryTracking();
    // Resume without prompting: the OS dialog is only raised by the explicit online toggle.
    if (iosBackgroundAllowed) startIOSBackgroundLocation({ prompt: false });
    return () => {
      stopHeartbeat();
      stopIOSBackgroundLocation();
      void stopDeliveryTracking();
    };
  }, [iosBackgroundAllowed, online]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && online) void sendHeartbeat();
    });
    return () => sub.remove();
  }, [online]);
}