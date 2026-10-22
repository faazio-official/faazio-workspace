/**
 * Headless heartbeat used by the Android foreground service while a rider is online.
 *
 * The OEM may keep the process alive but the React UI paused; this task runs on the shared JS
 * thread/React host, reads the Keychain-backed session, takes one coarse fix and posts it to the
 * same `POST /delivery/heartbeat` endpoint as the foreground loop. Every failure is swallowed —
 * the Valkey key expires and dispatch simply skips the rider until the next tick.
 */
import { AppRegistry } from 'react-native';
import { getAccessToken } from './secureSession';
import { getCurrentPosition } from './location';
import { gateway } from './api/GatewayClient';

const TASK_NAME = 'FaazioDeliveryHeartbeat';

let registered = false;

export function registerDeliveryHeartbeatTask(): void {
  if (registered) return;
  registered = true;

  AppRegistry.registerHeadlessTask(TASK_NAME, () => async () => {
    if (!(await getAccessToken())) return;
    try {
      const fix = await getCurrentPosition({
        highAccuracy: false,
        maximumAge: 120_000,
        timeout: 20_000,
      });
      await gateway.sendDeliveryHeartbeat(fix.latitude, fix.longitude);
    } catch {
      // Offline / permission revoked / OEM killed the fix — next tick retries.
    }
  });
}
