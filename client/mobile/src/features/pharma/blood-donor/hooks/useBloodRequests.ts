import { useEffect, useState } from 'react';
import type {
  BloodGroup,
  BloodRequest,
  BloodRequestUrgency,
} from '@data/index';
import { gateway, type BloodRequestRecord, type ReadSource } from '@/services/api/GatewayClient';

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
 */
export function useBloodRequests(reloadKey = 0): BloodRequestsFeed {
  const [feed, setFeed] = useState<BloodRequestsFeed>({
    requests: cache,
    source: cacheSource,
    settled: cacheSettled,
  });

  useEffect(() => {
    let active = true;
    gateway
      .fetchBloodRequests()
      .then((rows) => {
        if (!active) return;
        const mapped = rows.map(toBloodRequest);
        cache = mapped;
        cacheSource = rows.length > 0 ? 'live' : 'empty-authoritative';
        cacheSettled = true;
        setFeed({ requests: mapped, source: cacheSource, settled: true });
      })
      .catch(() => {
        if (!active) return;
        const stale = cacheSource === 'live' || cacheSource === 'empty-authoritative';
        cacheSettled = true;
        setFeed({
          requests: cache,
          source: cache.length > 0 && stale ? 'cache-stale' : 'offline-fallback',
          settled: true,
        });
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return feed;
}