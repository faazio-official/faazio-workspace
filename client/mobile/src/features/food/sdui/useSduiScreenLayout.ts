import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { gateway } from '@/services/api/GatewayClient';
import { parseScreenLayout, type SduiScreenLayout } from '@/services/api/sduiLayout';

/** The layout TTL the gateway serves; refetching on it is the mid-session kill switch. */
const REFRESH_MS = 60_000;

interface State {
  layout: SduiScreenLayout | null;
  /** Server-adjusted "now" in epoch ms, ticking every second (phone clock is untrusted). */
  now: number;
  /** Measured server clock offset in ms (server time − device time). */
  clockOffset: number;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Fetches the SDUI screen layout and keeps a server-corrected clock.
 *
 * The expiry lock must not trust the device clock — a user can change it. On every fetch we record
 * `server_timestamp_utc − Date.now()` and derive "now" from that offset, refreshing at the TTL and
 * whenever the app returns to the foreground so a published takedown lands within one cycle.
 */
export function useSduiScreenLayout(
  vertical: string,
  screen: string,
  districtId?: string,
): State {
  const [layout, setLayout] = useState<SduiScreenLayout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockOffset, setClockOffset] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const raw = await gateway.getSduiLayout(vertical, screen, districtId);
      const parsed = parseScreenLayout(raw);
      if (!parsed) {
        throw new Error('layout_payload_invalid');
      }
      const serverTime = Date.parse(parsed.server_timestamp_utc);
      if (!Number.isNaN(serverTime) && mounted.current) {
        setClockOffset(serverTime - Date.now());
      }
      if (mounted.current) {
        setLayout(parsed);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'layout_unavailable');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [vertical, screen, districtId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  const now = Date.now() + clockOffset;

  return { layout, now, clockOffset, error, loading, reload: () => void load() };
}
