import { useEffect, useState } from 'react';
import {
  BLOOD_REQUESTS,
  type BloodGroup,
  type BloodRequest,
  type BloodRequestUrgency,
} from '@data/index';
import { gateway, type BloodRequestRecord, type ReadSource } from '@/services/api/GatewayClient';

/** Index the fixture once so a server row can borrow its display-only extras. */
const FIXTURE_BY_ID = new Map(BLOOD_REQUESTS.map((r) => [r.id, r]));

const URGENCIES: BloodRequestUrgency[] = ['urgent', 'high', 'normal'];

function toUrgency(value: string): BloodRequestUrgency {
  return (URGENCIES as string[]).includes(value) ? (value as BloodRequestUrgency) : 'normal';
}

/**
 * Map a durable `blood.requests` row onto the app's `BloodRequest` card/detail
 * shape. The server is the source of the clinical fields (hospital, group, units,
 * urgency, timing); the donation-safe display-only extras the app seeds
 * (`imageUrl`/`purposeDescription`/patient demographics/`distanceKm`) are borrowed
 * from the fixture row when the id matches, otherwise left blank and rendered as
 * a graceful "not provided" by the screens. `contact`/`address` come from the
 * server (present for an authed caller, redacted for anon).
 */
function toBloodRequest(rec: BloodRequestRecord): BloodRequest {
  const fx = FIXTURE_BY_ID.get(rec.id);
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
    imageUrl: fx?.imageUrl ?? '',
    purposeDescription: fx?.purposeDescription ?? '',
    patientAge: fx?.patientAge ?? 0,
    patientGender: fx?.patientGender ?? '',
    // Contact/address are server-owned PII: an anon caller gets them redacted (absent) and must
    // never be shown a fixture lookalike. Only the donation-safe display extras come from the fixture.
    hospitalContact: rec.contact ?? '',
    hospitalAddress: rec.address ?? `${rec.city}, ${rec.state}`,
    remarks: rec.remarks ?? fx?.remarks ?? '',
    distanceKm: fx?.distanceKm ?? 0,
  };
}

/** The board plus its provenance so the screen can label a stale/offline view honestly. */
export interface BloodRequestsFeed {
  requests: BloodRequest[];
  source: ReadSource;
}

/**
 * Module cache of the last resolved feed. The dashboard resolves it first, so the
 * detail screen mounted on the next tick renders instantly instead of re-flashing.
 */
let cache: BloodRequest[] = BLOOD_REQUESTS;
let cacheSource: ReadSource = 'offline-fallback';

/**
 * The public blood-request board. Reads `blood.requests` (`GET /blood-requests`) through the
 * no-fallback `GatewayClient.fetchBloodRequests`, so the hook can tell a live response from the
 * offline fixture:
 *  - live rows        → `source: 'live'`
 *  - server `200 []`  → `source: 'empty-authoritative'` (an honest empty board, not an error)
 *  - fetch failure    → the `@data` fixture (or a previously-live cache) + `offline-fallback`/`cache-stale`
 *
 * The fixture is the initial value so the board never blanks, but it is always labelled.
 */
export function useBloodRequests(): BloodRequestsFeed {
  const [feed, setFeed] = useState<BloodRequestsFeed>({ requests: cache, source: cacheSource });

  useEffect(() => {
    let active = true;
    gateway
      .fetchBloodRequests()
      .then((rows) => {
        if (!active) return;
        const mapped = rows.map(toBloodRequest);
        cache = mapped;
        cacheSource = rows.length > 0 ? 'live' : 'empty-authoritative';
        setFeed({ requests: mapped, source: cacheSource });
      })
      .catch(() => {
        if (!active) return;
        const stale = cacheSource === 'live' || cacheSource === 'empty-authoritative';
        setFeed({ requests: cache, source: cache.length > 0 && stale ? 'cache-stale' : 'offline-fallback' });
      });
    return () => {
      active = false;
    };
  }, []);

  return feed;
}