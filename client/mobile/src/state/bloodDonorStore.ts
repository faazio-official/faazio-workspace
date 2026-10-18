import { AppState } from 'react-native';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/state/authStore';
import {
  gateway,
  type BloodDonorProfile,
  type BloodWriteOutcome,
  type DonorMatchRecord,
} from '@/services/api/GatewayClient';
import type {
  AgeRangeId,
  BloodDonorDraft,
  BloodDonorRegistration,
  BloodGroup,
  DonationTypeId,
  DonorMatchRequest,
  DonorMatchStatus,
  DonorProfile,
} from '@data/index';

const STORAGE_KEY = 'faazio/bloodDonor/v1';

/**
 * Device-local sync status for a blood write. Mirrors the `submitVendorRating` outcome pattern so a
 * screen can explain a non-durable write instead of showing a fake success:
 *  - `synced`     — the server persisted the row (durable).
 *  - `offline`    — remote disabled (mock); the device mirror is the final home.
 *  - `queued`     — remote enabled but unreachable; the write is in `pendingOps` and will retry.
 *  - `signed-out` — the server rejected the bearer (401); sign in to sync.
 */
export type BloodWriteStatus = 'synced' | 'offline' | 'queued' | 'signed-out';

export interface BloodWriteResult {
  /** True when the local optimistic commit is acceptable (durable or safely device-local). */
  ok: boolean;
  status: BloodWriteStatus;
}

/**
 * A local-first write awaiting a durable server ack. Kept in the same AsyncStorage blob as the
 * optimistic rows so an offline write survives a restart and is retried on hydration/foreground.
 * Carries no clinical payload — only the reference needed to replay the call (the payload is read
 * back from the current local row, so a later edit wins).
 */
interface PendingDonorOp {
  id: string;
  kind: 'register' | 'interest' | 'match' | 'match-status' | 'request';
  /** Request id (interest), local match id (match), match id (match-status), or op id (request). */
  targetId?: string;
  interestKind?: 'interested' | 'accepted';
  donorUserId?: string;
  bloodGroup?: string;
  city?: string;
  /** Recipient response for a `match-status` op. */
  status?: 'accepted' | 'declined';
  createdAt: string;
  attempts: number;
}

/** A committed registration plus the device-local sync flag (never part of the server contract). */
export type LocalBloodDonorRegistration = BloodDonorRegistration & { pendingSync?: boolean };

/** A targeted match request plus the device-local sync flag (never part of the server contract). */
export type LocalDonorMatchRequest = DonorMatchRequest & { pendingSync?: boolean };

const EMPTY_DRAFT: BloodDonorDraft = {
  bloodGroup: null,
  ageRange: null,
  weightKg: null,
  goodHealth: null,
  donatedBefore: null,
  chronicConditions: null,
  onMedication: null,
  preferredLocation: null,
  willingToTravel: null,
  donationType: null,
  notificationPrefs: {
    hospitals: true,
    bloodBanks: true,
    emergencyAlerts: true,
  },
  consentGiven: false,
};

interface PersistedBlob {
  draft?: Partial<BloodDonorDraft>;
  registration?: LocalBloodDonorRegistration | null;
  interestedRequestIds?: string[];
  acceptedRequestIds?: string[];
  donorMatchRequests?: LocalDonorMatchRequest[];
  /** Incoming targeted requests (recipient = this account), hydrated from the server. */
  incomingMatchRequests?: LocalDonorMatchRequest[];
  pendingOps?: PendingDonorOp[];
}

const nowIso = () => new Date().toISOString();

function opId(): string {
  return 'bop-' + Math.random().toString(36).substring(2, 10);
}

/** Same logical write (so a re-tap replaces rather than stacks a duplicate outbox entry). */
function sameOp(a: PendingDonorOp, b: PendingDonorOp): boolean {
  return a.kind === b.kind && a.targetId === b.targetId;
}

function enqueueOp(ops: PendingDonorOp[], op: PendingDonorOp): PendingDonorOp[] {
  return [...ops.filter((o) => !sameOp(o, op)), op];
}

function persist(blob: PersistedBlob): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(blob)).catch(() => {
    // Best-effort device-local state; failures are silent and never logged (PII rule).
  });
}

/** Rebuild a committed registration from the durable server profile (fresh install / cleared cache). */
function registrationFromServer(p: BloodDonorProfile): LocalBloodDonorRegistration {
  const draft: BloodDonorDraft = {
    ...EMPTY_DRAFT,
    bloodGroup: p.bloodGroup as BloodGroup,
    ageRange: (p.ageRange as AgeRangeId) ?? null,
    weightKg: p.weightKg ?? null,
    preferredLocation: p.city || null,
    donationType: (p.donationType as DonationTypeId) ?? null,
    willingToTravel: p.willingToTravel ? 'yes' : 'no',
    consentGiven: p.consent,
    notificationPrefs: { ...EMPTY_DRAFT.notificationPrefs, ...(p.notif ?? {}) },
  };
  return {
    id: p.userId,
    registeredAt: nowIso(),
    profile: draft,
    accountPhone: useAuthStore.getState().user?.phone ?? null,
    pendingSync: false,
  };
}

/** Coerce a server `match_status` string onto the UI union (defaults to pending). */
function toMatchStatus(value: string): DonorMatchStatus {
  return value === 'accepted' || value === 'declined' || value === 'completed' ? value : 'pending';
}

/** Map a durable server match row onto the local mirror, preserving its real lifecycle status. */
function toDonorMatchRequest(r: DonorMatchRecord): LocalDonorMatchRequest {
  return {
    id: r.id,
    requesterUserId: r.requesterUserId,
    requesterName: '',
    donorId: r.donorUserId,
    donorUserId: r.donorUserId,
    donorName: '',
    bloodGroup: r.bloodGroup as BloodGroup,
    city: r.city,
    requestedAt: r.createdAt,
    status: toMatchStatus(r.status),
    pendingSync: false,
  };
}

/** Logical identity of a match, used to drop a synced local mirror once the server row arrives. */
function matchKey(m: { donorUserId: string; bloodGroup: string; city: string; status: string }): string {
  return `${m.donorUserId}|${m.bloodGroup}|${m.city.toLowerCase()}|${m.status}`;
}

/**
 * Merge server matches over local ones by id (server wins), preserving local-only entries. A local
 * mirror that is already synced and has a server twin (same donor/group/city, pending) is dropped to
 * avoid a duplicate after a restart; an unsynced (`pendingSync`) local row is always preserved.
 */
function mergeMatches(local: LocalDonorMatchRequest[], remote: LocalDonorMatchRequest[]): LocalDonorMatchRequest[] {
  const remoteKeys = new Set(remote.map(matchKey));
  const byId = new Map<string, LocalDonorMatchRequest>();
  for (const m of local) {
    if (!m.pendingSync && remoteKeys.has(matchKey(m))) continue;
    byId.set(m.id, m);
  }
  for (const m of remote) byId.set(m.id, m);
  return [...byId.values()];
}

interface BloodDonorState {
  /** Per-step answers captured mid-wizard (survives restarts via AsyncStorage). */
  draft: BloodDonorDraft;
  /** Committed registration — null until the wizard is completed; persists across restarts. */
  registration: LocalBloodDonorRegistration | null;
  /** Request ids the donor marked "interested" on the dashboard (toggleable). */
  interestedRequestIds: string[];
  /** Request ids the donor accepted via the confirm dialog (not toggleable). */
  acceptedRequestIds: string[];
  /** Outgoing targeted donor requests (this account is the requester). */
  donorMatchRequests: LocalDonorMatchRequest[];
  /** Incoming targeted donor requests (this account is the recipient donor), server-hydrated. */
  incomingMatchRequests: LocalDonorMatchRequest[];
  /** Local-first writes awaiting a durable server ack (retried on hydration + foreground). */
  pendingOps: PendingDonorOp[];
  /** Status of the most recent write, for immediate UI feedback. */
  lastWriteStatus: BloodWriteStatus | null;
  /** True once the AsyncStorage hydration read has settled. */
  hydrated: boolean;
  updateDraft: (patch: Partial<BloodDonorDraft>) => void;
  /** Promotes the current draft to a committed registration (snapshot + account phone). */
  register: () => Promise<BloodWriteResult>;
  /** Toggles the donor's "interested" flag on a request (persisted). */
  toggleInterested: (requestId: string) => Promise<BloodWriteResult>;
  /** Records the donor's confirmed acceptance of a request (persisted). */
  acceptRequest: (requestId: string) => Promise<BloodWriteResult>;
  /** Sends one targeted request to the selected matching donor. */
  requestDonor: (donor: DonorProfile, city: string) => Promise<BloodWriteResult & { requestId?: string }>;
  /** Recipient accepts/declines one incoming targeted request. */
  respondToMatch: (matchId: string, status: 'accepted' | 'declined') => Promise<BloodWriteResult>;
  /** Posts a public request to the hospital/donor board (board reloads from the server). */
  postBloodRequest: (city: string, bloodGroup: BloodGroup) => Promise<BloodWriteResult>;
  /** Re-reads the recipient's incoming requests from the server (called when the dashboard mounts). */
  refreshIncoming: () => Promise<void>;
  reset: () => void;
}

/** The persisted slice, read back at write time so a later local edit wins over a stale replay payload. */
function snapshot(): PersistedBlob {
  const s = useBloodDonorStore.getState();
  return {
    draft: s.draft,
    registration: s.registration,
    interestedRequestIds: s.interestedRequestIds,
    acceptedRequestIds: s.acceptedRequestIds,
    donorMatchRequests: s.donorMatchRequests,
    incomingMatchRequests: s.incomingMatchRequests,
    pendingOps: s.pendingOps,
  };
}

function persistAll(): void {
  persist(snapshot());
}

/**
 * Apply a server outcome to the optimistic state: a `synced` write is dequeued and its row untagged;
 * an `offline`/`signed-out` write stays in the outbox (retried on foreground/hydration) — a mock-mode
 * offline write is final device-local state and is not queued. Never fabricates success.
 */
function applyOutcome(op: PendingDonorOp, outcome: BloodWriteOutcome): BloodWriteResult {
  const store = useBloodDonorStore;
  if (outcome === 'synced') {
    store.setState((s) => ({
      pendingOps: s.pendingOps.filter((o) => o.id !== op.id),
      lastWriteStatus: 'synced',
      registration: s.registration ? { ...s.registration, pendingSync: false } : s.registration,
      donorMatchRequests: op.kind === 'match'
        ? s.donorMatchRequests.map((m) => (m.id === op.targetId ? { ...m, pendingSync: false } : m))
        : s.donorMatchRequests,
      incomingMatchRequests: op.kind === 'match-status'
        ? s.incomingMatchRequests.map((m) => (m.id === op.targetId ? { ...m, pendingSync: false } : m))
        : s.incomingMatchRequests,
    }));
    persistAll();
    return { ok: true, status: 'synced' };
  }

  if (outcome === 'signed-out') {
    store.setState((s) => ({
      pendingOps: s.pendingOps.map((o) => (o.id === op.id ? { ...o, attempts: o.attempts + 1 } : o)),
      lastWriteStatus: 'signed-out',
    }));
    persistAll();
    return { ok: false, status: 'signed-out' };
  }

  // offline: keep the op queued only when there is a server to sync to (mock mode is final).
  const queued = gateway.remoteEnabled;
  store.setState((s) => ({
    pendingOps: queued
      ? s.pendingOps.map((o) => (o.id === op.id ? { ...o, attempts: o.attempts + 1 } : o))
      : s.pendingOps.filter((o) => o.id !== op.id),
    lastWriteStatus: 'offline',
  }));
  persistAll();
  return { ok: true, status: queued ? 'queued' : 'offline' };
}

/** Drop an outbox entry without touching the optimistic row (used for orphaned ops). */
function dequeueOp(id: string): void {
  useBloodDonorStore.setState((s) => ({ pendingOps: s.pendingOps.filter((o) => o.id !== id) }));
  persistAll();
}

export const useBloodDonorStore = create<BloodDonorState>()((set, get) => ({
  draft: EMPTY_DRAFT,
  registration: null,
  interestedRequestIds: [],
  acceptedRequestIds: [],
  donorMatchRequests: [],
  incomingMatchRequests: [],
  pendingOps: [],
  lastWriteStatus: null,
  hydrated: false,
  updateDraft: (patch) => {
    set({ draft: { ...get().draft, ...patch } });
    persistAll();
  },
  register: async () => {
    const { draft } = get();
    if (!draft.bloodGroup) return { ok: false, status: 'offline' };
    const remote = gateway.remoteEnabled;
    const registration: LocalBloodDonorRegistration = {
      id: Math.random().toString(36).substring(2, 10),
      registeredAt: nowIso(),
      profile: { ...draft },
      accountPhone: useAuthStore.getState().user?.phone ?? null,
      pendingSync: remote,
    };
    set({ registration });
    if (!remote) {
      persistAll();
      return { ok: true, status: 'offline' };
    }
    const op: PendingDonorOp = { id: opId(), kind: 'register', createdAt: nowIso(), attempts: 0 };
    set((s) => ({ pendingOps: enqueueOp(s.pendingOps, op), lastWriteStatus: 'queued' }));
    persistAll();
    const outcome = await gateway.saveDonorProfile({
      name: useAuthStore.getState().user?.name?.trim() || 'Faazio User',
      bloodGroup: draft.bloodGroup,
      city: draft.preferredLocation?.trim() || '',
      ageRange: draft.ageRange ?? undefined,
      weightKg: draft.weightKg ?? undefined,
      donationType: draft.donationType ?? undefined,
      willingToTravel: draft.willingToTravel === 'yes',
      available: true,
      consent: draft.consentGiven,
      notif: draft.notificationPrefs,
    });
    return applyOutcome(op, outcome);
  },
  toggleInterested: async (requestId) => {
    const { interestedRequestIds } = get();
    const isAdding = !interestedRequestIds.includes(requestId);
    const next = isAdding
      ? [...interestedRequestIds, requestId]
      : interestedRequestIds.filter((id) => id !== requestId);
    set({ interestedRequestIds: next });
    // Removing interest is device-local only (no server un-interest call).
    if (!isAdding) {
      persistAll();
      return { ok: true, status: 'synced' };
    }
    if (!gateway.remoteEnabled) {
      persistAll();
      return { ok: true, status: 'offline' };
    }
    const op: PendingDonorOp = {
      id: opId(), kind: 'interest', targetId: requestId, interestKind: 'interested', createdAt: nowIso(), attempts: 0,
    };
    set((s) => ({ pendingOps: enqueueOp(s.pendingOps, op), lastWriteStatus: 'queued' }));
    persistAll();
    const outcome = await gateway.setBloodInterest(requestId, 'interested');
    return applyOutcome(op, outcome);
  },
  acceptRequest: async (requestId) => {
    const { acceptedRequestIds } = get();
    if (acceptedRequestIds.includes(requestId)) return { ok: true, status: 'synced' };
    const next = [...acceptedRequestIds, requestId];
    set({ acceptedRequestIds: next });
    if (!gateway.remoteEnabled) {
      persistAll();
      return { ok: true, status: 'offline' };
    }
    const op: PendingDonorOp = {
      id: opId(), kind: 'interest', targetId: requestId, interestKind: 'accepted', createdAt: nowIso(), attempts: 0,
    };
    set((s) => ({ pendingOps: enqueueOp(s.pendingOps, op), lastWriteStatus: 'queued' }));
    persistAll();
    const outcome = await gateway.setBloodInterest(requestId, 'accepted');
    return applyOutcome(op, outcome);
  },
  requestDonor: async (donor, city) => {
    const user = useAuthStore.getState().user;
    const requesterUserId = user?.id ?? 'anonymous-user';
    const normalizedCity = city.trim();
    const alreadyPending = get().donorMatchRequests.some(
      (request) =>
        request.requesterUserId === requesterUserId &&
        request.donorId === donor.id &&
        request.bloodGroup === donor.bloodGroup &&
        request.city.toLowerCase() === normalizedCity.toLowerCase() &&
        request.status === 'pending',
    );
    if (alreadyPending) return { ok: false, status: 'synced' };

    const remote = gateway.remoteEnabled;
    const request: LocalDonorMatchRequest = {
      id: 'dmr-' + Math.random().toString(36).substring(2, 10),
      requesterUserId,
      requesterName: user?.name?.trim() || 'Faazio User',
      donorId: donor.id,
      donorUserId: donor.userId,
      donorName: donor.name,
      bloodGroup: donor.bloodGroup,
      city: normalizedCity,
      requestedAt: nowIso(),
      status: 'pending',
      pendingSync: remote,
    };
    set((s) => ({ donorMatchRequests: [request, ...s.donorMatchRequests] }));
    if (!remote) {
      persistAll();
      return { ok: true, status: 'offline', requestId: request.id };
    }
    const op: PendingDonorOp = {
      id: opId(), kind: 'match', targetId: request.id, donorUserId: donor.userId, bloodGroup: donor.bloodGroup, city: normalizedCity, createdAt: nowIso(), attempts: 0,
    };
    set((s) => ({ pendingOps: enqueueOp(s.pendingOps, op), lastWriteStatus: 'queued' }));
    persistAll();
    const outcome = await gateway.createDonorMatch(donor.userId, donor.bloodGroup, normalizedCity);
    return { ...applyOutcome(op, outcome), requestId: request.id };
  },
  respondToMatch: async (matchId, status) => {
    const current = get().incomingMatchRequests.find((m) => m.id === matchId);
    if (!current || current.status !== 'pending') return { ok: false, status: 'synced' };
    set((s) => ({
      incomingMatchRequests: s.incomingMatchRequests.map((m) =>
        m.id === matchId ? { ...m, status, pendingSync: gateway.remoteEnabled } : m,
      ),
    }));
    if (!gateway.remoteEnabled) {
      persistAll();
      return { ok: true, status: 'offline' };
    }
    const op: PendingDonorOp = {
      id: opId(), kind: 'match-status', targetId: matchId, status, createdAt: nowIso(), attempts: 0,
    };
    set((s) => ({ pendingOps: enqueueOp(s.pendingOps, op), lastWriteStatus: 'queued' }));
    persistAll();
    const outcome = await gateway.setDonorMatchStatus(matchId, status);
    return applyOutcome(op, outcome);
  },
  postBloodRequest: async (city, bloodGroup) => {
    const normalizedCity = city.trim();
    // No durable board home in mock mode — never pretend a public post landed.
    if (!gateway.remoteEnabled) return { ok: false, status: 'offline' };
    const id = opId();
    const op: PendingDonorOp = {
      id, kind: 'request', targetId: id, bloodGroup, city: normalizedCity, createdAt: nowIso(), attempts: 0,
    };
    set((s) => ({ pendingOps: enqueueOp(s.pendingOps, op), lastWriteStatus: 'queued' }));
    persistAll();
    const outcome = await gateway.createBloodRequest({ bloodGroup, city: normalizedCity });
    return applyOutcome(op, outcome);
  },
  refreshIncoming: async () => {
    if (!gateway.remoteEnabled) return;
    try {
      reconcileIncoming(await gateway.getIncomingDonorMatches());
    } catch {
      // Offline — keep the cached incoming list.
    }
  },
  reset: () => {
    set({
      draft: EMPTY_DRAFT,
      registration: null,
      interestedRequestIds: [],
      acceptedRequestIds: [],
      donorMatchRequests: [],
      incomingMatchRequests: [],
      pendingOps: [],
      lastWriteStatus: null,
    });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

/**
 * Replay the offline outbox against the durable registry. Offline writes stay queued; a `synced`
 * write is dequeued and its row untagged. Never called in mock mode (no server to sync to).
 */
async function flushPendingOps(): Promise<void> {
  if (!gateway.remoteEnabled) return;
  const ops = useBloodDonorStore.getState().pendingOps;
  if (ops.length === 0) return;
  for (const op of ops) {
    try {
      let outcome: BloodWriteOutcome;
      if (op.kind === 'register') {
        const registration = useBloodDonorStore.getState().registration;
        if (!registration) {
          dequeueOp(op.id);
          continue;
        }
        const p = registration.profile;
        outcome = await gateway.saveDonorProfile({
          name: useAuthStore.getState().user?.name?.trim() || 'Faazio User',
          bloodGroup: (p.bloodGroup ?? 'O+') as BloodGroup,
          city: p.preferredLocation?.trim() || '',
          ageRange: p.ageRange ?? undefined,
          weightKg: p.weightKg ?? undefined,
          donationType: p.donationType ?? undefined,
          willingToTravel: p.willingToTravel === 'yes',
          available: true,
          consent: p.consentGiven,
          notif: p.notificationPrefs,
        });
      } else if (op.kind === 'interest') {
        outcome = await gateway.setBloodInterest(op.targetId ?? '', op.interestKind ?? 'interested');
      } else if (op.kind === 'match') {
        outcome = await gateway.createDonorMatch(op.donorUserId ?? '', op.bloodGroup ?? '', op.city ?? '');
      } else if (op.kind === 'match-status') {
        outcome = await gateway.setDonorMatchStatus(op.targetId ?? '', op.status ?? 'accepted');
      } else {
        outcome = await gateway.createBloodRequest({ bloodGroup: op.bloodGroup ?? 'O+', city: op.city ?? '' });
      }
      applyOutcome(op, outcome);
    } catch {
      // leave the op queued; a later foreground/hydration retries.
    }
  }
}

/** Server registration supersedes a local one only when there is no unsynced local write. */
function reconcileRegistration(profile: BloodDonorProfile | null): void {
  if (!profile) return;
  const s = useBloodDonorStore.getState();
  const hasPendingRegister = s.pendingOps.some((o) => o.kind === 'register');
  if (!s.registration) {
    useBloodDonorStore.setState({ registration: registrationFromServer(profile) });
  } else if (!hasPendingRegister && s.registration.pendingSync) {
    useBloodDonorStore.setState({ registration: { ...s.registration, pendingSync: false } });
  }
}

/** Merge the caller's server match rows over the local mirrors (server wins, local-only preserved). */
function reconcileMatches(matches: DonorMatchRecord[]): void {
  const remote = matches.map(toDonorMatchRequest);
  if (remote.length === 0) return;
  useBloodDonorStore.setState((s) => ({
    donorMatchRequests: mergeMatches(s.donorMatchRequests, remote),
  }));
}

/**
 * Replace the incoming (recipient) list with the authoritative server rows. Skipped while a response
 * is queued so an in-flight accept/decline is not reverted to `pending` by a stale server read.
 */
function reconcileIncoming(matches: DonorMatchRecord[]): void {
  const s = useBloodDonorStore.getState();
  if (s.pendingOps.some((o) => o.kind === 'match-status')) return;
  useBloodDonorStore.setState({ incomingMatchRequests: matches.map(toDonorMatchRequest) });
}

/**
 * Read-back hydration from the durable server registry. Pushes any queued local-first writes first,
 * then reconciles the authoritative rows over the local mirrors. In mock mode the gateway returns
 * null/[] so this is a no-op and the AsyncStorage cache stands.
 */
async function hydrateFromServer(): Promise<void> {
  await flushPendingOps();
  try {
    const [profile, matches, incoming] = await Promise.all([
      gateway.getDonorProfile(),
      gateway.getDonorMatches(),
      gateway.getIncomingDonorMatches(),
    ]);
    reconcileRegistration(profile);
    reconcileMatches(matches);
    reconcileIncoming(incoming);
  } catch {
    // Offline / mock — the local AsyncStorage cache remains the source of truth.
  }
}

// Hydrate at store creation (fire-and-forget, searchStore-style). The stored draft
// merges over EMPTY_DRAFT so older persisted drafts pick up newly added fields
// with sane defaults instead of crashing on missing keys.
AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedBlob;
    const stored = parsed.draft ?? {};
    const draft: BloodDonorDraft = {
      ...EMPTY_DRAFT,
      ...stored,
      notificationPrefs: {
        ...EMPTY_DRAFT.notificationPrefs,
        ...(stored.notificationPrefs ?? {}),
      },
    };
    useBloodDonorStore.setState({
      draft,
      registration: parsed.registration ?? null,
      interestedRequestIds: parsed.interestedRequestIds ?? [],
      acceptedRequestIds: parsed.acceptedRequestIds ?? [],
      donorMatchRequests: parsed.donorMatchRequests ?? [],
      incomingMatchRequests: parsed.incomingMatchRequests ?? [],
      pendingOps: parsed.pendingOps ?? [],
    });
  })
  .catch(() => {})
  .finally(() => {
    useBloodDonorStore.setState({ hydrated: true });
    void hydrateFromServer();
  });

// Retry queued writes when the app returns to the foreground (network likely restored).
AppState.addEventListener('change', (state) => {
  if (state === 'active') void flushPendingOps();
});