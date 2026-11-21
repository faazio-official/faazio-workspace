import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type {
  BloodGroup,
  BloodRequest,
  BloodRequestUrgency,
} from '@data/index';
import { gateway, type BloodRequestRecord, type ReadSource } from '@/services/api/GatewayClient';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import { subscribeBoardRefresh } from '@/services/pushRefresh';

const URGENCIES: BloodRequestUrgency[] = ['urgent', 'high', 'normal'];

function toUrgency(value: string): BloodRequestUrgency {
  return (URGENCIES as string[]).includes(value) ? (value as BloodRequestUrgency) : 'normal';
}

/**
 * Map a durable `blood.requests` row onto the app's `BloodRequest` card/detail
 * shape. The server is the single source for the clinical + contact fields
 * (hospital, group, units, urgency, timing); the donation-safe display-only
 * extras (`imageUrl`/`purposeDescription`/patient demographics/`distanceKm`)
 * are left blank and rendered as a graceful "not provided" by the screens.
 * `contact`/`address` are server-owned PII (present for an authed caller,
 * absent for anon) — never substituted with a fixture lookalike.
 */
function toBloodRequest(rec: BloodRequestRecord): BloodRequest {
  return {
    id: rec.id,
    hospital: rec.hospital,
    city: rec.city,
    state: rec.state,
    bloodGroup: rec.bloodGroup as BloodGroup,
    unitsRequired: rec.unitsRequired,
    patientContext: rec.patientContext,
    postedHoursAgo: rec.postedHoursAgo,
    neededWithin: rec.neededWithin,
    verified: rec.verified,
    urgency: toUrgency(rec.urgency),
    imageUrl: '',
    purposeDescription: '',
    patientAge: 0,
    patientGender: '',
    // Contact/address are server-owned PII: an anon caller gets them redacted (absent) and must
    // never be shown a fixture lookalike. The display-only extras are honest blanks.
    hospitalContact: rec.contact ?? '',
    hospitalAddress: rec.address ?? `${rec.city}, ${rec.state}`,
    remarks: rec.remarks ?? '',
    distanceKm: 0,
  };
}

/** The board plus its provenance so the screen can label a stale/offline view honestly. */
export interface BloodRequestsFeed {
  requests: BloodRequest[];
  source: ReadSource;
  /**
   * True once a fetch attempt has resolved (success or failure). A cold deep-link detail screen
   * waits for this before deciding a request is missing, so a fixture id is never shown as if it
   * were a live server row.
   */
  settled: boolean;
}

/**
 * Module cache of the last resolved feed. The dashboard resolves it first, so the
 * detail screen mounted on the next tick renders instantly instead of re-flashing.
 */
let cache: BloodRequest[] = [];
let cacheSource: ReadSource = 'offline-fallback';
let cacheSettled = false;

/**
 * The public blood-request board. Reads `blood.requests` (`GET /blood-requests`) through the
 * no-fallback `GatewayClient.fetchBloodRequests`, so the hook can tell a live response from the
 * offline fixture:
 *  - live rows        → `source: 'live'`
 *  - server `200 []`  → `source: 'empty-authoritative'` (an honest empty board, not an error)
 *  - fetch failure    → a previously-live cache + `cache-stale`, or an empty board + `offline-fallback`
 *
 * No fixture rows are ever shown; the initial board is an honest empty.
 *
 * Refetch triggers — event-driven only, never a poll. A push is a hint that the board moved, the
 * fetch is the source of truth, and every path below costs nothing while idle:
 *  - `reloadKey` — a caller-local bump (dashboard after `onPosted`);
 *  - `requestsReloadKey` — the store's counter, bumped when a posted request is durably persisted,
 *    so every mounted board refetches rather than keeping the row-less feed it fetched pre-post;
 *  - `subscribeBoardRefresh()` — the foreground push handler for the `BLOOD_REQUEST_NEW` broadcast
 *    the gateway enqueues on `POST /blood-requests`, which is how *another* device learns about it;
 *  - refocus — a board revisited after a push arrived while unmounted;
 *  - app foreground — returning to an already-focused board, which neither refocus nor a missed
 *    push covers. This is the no-push fallback: one fetch per foreground, not per interval.
 */
export function useBloodRequests(reloadKey = 0): BloodRequestsFeed {
  const storeReloadKey = useBloodDonorStore((s) => s.requestsReloadKey);
  const [feed, setFeed] = useState<BloodRequestsFeed>({
    requests: cache,
    source: cacheSource,
    settled: cacheSettled,
  });

  /** Ticket so a slow earlier response cannot overwrite a newer one. */
  const ticketRef = useRef(0);
  /** False after unmount, so a late response still warms the module cache but never sets state. */
  const mountedRef = useRef(true);
  /** The initial fetch is owned by the trigger effect, so the first focus must not duplicate it. */
  const focusSeenRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(() => {
    const ticket = ++ticketRef.current;
    gateway
      .fetchBloodRequests()
      .then((rows) => {
        if (ticket !== ticketRef.current) return;
        const mapped = rows.map(toBloodRequest);
        cache = mapped;
        cacheSource = rows.length > 0 ? 'live' : 'empty-authoritative';
        cacheSettled = true;
        if (mountedRef.current) setFeed({ requests: mapped, source: cacheSource, settled: true });
      })
      .catch(() => {
        if (ticket !== ticketRef.current) return;
        const stale = cacheSource === 'live' || cacheSource === 'empty-authoritative';
        cacheSettled = true;
        if (!mountedRef.current) return;
        setFeed({
          requests: cache,
          source: cache.length > 0 && stale ? 'cache-stale' : 'offline-fallback',
          settled: true,
        });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey, storeReloadKey]);

  // A pushed board change (foreground message) refetches immediately; refocus catches the rest.
  useEffect(() => subscribeBoardRefresh(load), [load]);

  // Backgrounded → foreground on an already-focused board. Neither a push (which may be denied or
  // unconfigured) nor a focus event covers this, so it is the honest fallback that still costs
  // nothing while the app sits idle.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (focusSeenRef.current) load();
      focusSeenRef.current = true;
    }, [load]),
  );

  return feed;
}
