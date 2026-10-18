import { useEffect, useState } from 'react';
import {
  BLOOD_REQUESTS,
  type BloodGroup,
  type BloodRequest,
  type BloodRequestUrgency,
} from '@data/index';
import { gateway, type BloodRequestRecord } from '@/services/api/GatewayClient';

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

/**
 * Module cache of the last resolved feed. The dashboard resolves it first, so the
 * detail screen mounted on the next tick renders instantly instead of re-flashing.
 */
let cache: BloodRequest[] = BLOOD_REQUESTS;

/**
 * The public blood-request board, remote-first from `blood.requests`
 * (`GET /blood-requests`) through `GatewayClient.getBloodRequests`, which falls
 * back to the `@data` fixtures on a network/HTTP error. The fixture is the initial
 * value so the board never renders empty, then swaps in the durable rows (an empty
 * remote result keeps the seed). Server rows are enriched with fixture display
 * extras by id; see `toBloodRequest`.
 */
export function useBloodRequests(): BloodRequest[] {
  const [requests, setRequests] = useState<BloodRequest[]>(cache);

  useEffect(() => {
    let active = true;
    gateway
      .getBloodRequests()
      .then((rows) => {
        if (active && rows.length > 0) {
          cache = rows.map(toBloodRequest);
          setRequests(cache);
        }
      })
      .catch(() => {
        // getBloodRequests already falls back to the @data fixtures internally.
      });
    return () => {
      active = false;
    };
  }, []);

  return requests;
}