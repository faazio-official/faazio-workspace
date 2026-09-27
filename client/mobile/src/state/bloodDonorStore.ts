import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/state/authStore';
import type { BloodDonorDraft, BloodDonorRegistration, DonorMatchRequest, DonorProfile } from '@data/index';

const STORAGE_KEY = 'faazio/bloodDonor/v1';

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
  registration?: BloodDonorRegistration | null;
  interestedRequestIds?: string[];
  acceptedRequestIds?: string[];
  donorMatchRequests?: DonorMatchRequest[];
}

const persist = (
  draft: BloodDonorDraft,
  registration: BloodDonorRegistration | null,
  interestedRequestIds: string[],
  acceptedRequestIds: string[],
  donorMatchRequests: DonorMatchRequest[],
) => {
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ draft, registration, interestedRequestIds, acceptedRequestIds, donorMatchRequests }),
  ).catch(() => {
    // Best-effort device-local state; failures are silent and never logged (PII rule).
  });
};

interface BloodDonorState {
  /** Per-step answers captured mid-wizard (survives restarts via AsyncStorage). */
  draft: BloodDonorDraft;
  /** Committed registration — null until the wizard is completed; persists across restarts. */
  registration: BloodDonorRegistration | null;
  /** Request ids the donor marked "interested" on the dashboard (toggleable). */
  interestedRequestIds: string[];
  /** Request ids the donor accepted via the confirm dialog (not toggleable). */
  acceptedRequestIds: string[];
  /** Targeted donor requests, owned by the requester and selected donor. */
  donorMatchRequests: DonorMatchRequest[];
  /** True once the AsyncStorage hydration read has settled. */
  hydrated: boolean;
  updateDraft: (patch: Partial<BloodDonorDraft>) => void;
  /** Promotes the current draft to a committed registration (snapshot + account phone). */
  register: () => void;
  /** Toggles the donor's "interested" flag on a request (persisted). */
  toggleInterested: (requestId: string) => void;
  /** Records the donor's confirmed acceptance of a request (persisted). */
  acceptRequest: (requestId: string) => void;
  /** Sends one targeted request to the selected matching donor. */
  requestDonor: (donor: DonorProfile, city: string) => boolean;
  reset: () => void;
}

export const useBloodDonorStore = create<BloodDonorState>()((set, get) => ({
  draft: EMPTY_DRAFT,
  registration: null,
  interestedRequestIds: [],
  acceptedRequestIds: [],
  donorMatchRequests: [],
  hydrated: false,
  updateDraft: (patch) => {
    const draft = { ...get().draft, ...patch };
    set({ draft });
    persist(draft, get().registration, get().interestedRequestIds, get().acceptedRequestIds, get().donorMatchRequests);
  },
  register: () => {
    const { draft } = get();
    if (!draft.bloodGroup) return;
    const accountPhone = useAuthStore.getState().user?.phone ?? null;
    const registration: BloodDonorRegistration = {
      id: Math.random().toString(36).substring(2, 10),
      registeredAt: new Date().toISOString(),
      profile: { ...draft },
      accountPhone,
    };
    set({ registration });
    persist(draft, registration, get().interestedRequestIds, get().acceptedRequestIds, get().donorMatchRequests);
  },
  toggleInterested: (requestId) => {
    const { interestedRequestIds } = get();
    const next = interestedRequestIds.includes(requestId)
      ? interestedRequestIds.filter((id) => id !== requestId)
      : [...interestedRequestIds, requestId];
    set({ interestedRequestIds: next });
    persist(get().draft, get().registration, next, get().acceptedRequestIds, get().donorMatchRequests);
  },
  acceptRequest: (requestId) => {
    const { acceptedRequestIds } = get();
    if (acceptedRequestIds.includes(requestId)) return;
    const next = [...acceptedRequestIds, requestId];
    set({ acceptedRequestIds: next });
    persist(get().draft, get().registration, get().interestedRequestIds, next, get().donorMatchRequests);
  },
  requestDonor: (donor, city) => {
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
    if (alreadyPending) return false;

    const request: DonorMatchRequest = {
      id: 'dmr-' + Math.random().toString(36).substring(2, 10),
      requesterUserId,
      requesterName: user?.name?.trim() || 'Faazio User',
      donorId: donor.id,
      donorUserId: donor.userId,
      donorName: donor.name,
      bloodGroup: donor.bloodGroup,
      city: normalizedCity,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    const donorMatchRequests = [request, ...get().donorMatchRequests];
    set({ donorMatchRequests });
    persist(get().draft, get().registration, get().interestedRequestIds, get().acceptedRequestIds, donorMatchRequests);
    return true;
  },
  reset: () => {
    set({ draft: EMPTY_DRAFT, registration: null, interestedRequestIds: [], acceptedRequestIds: [], donorMatchRequests: [] });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

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
    });
  })
  .catch(() => {})
  .finally(() => {
    useBloodDonorStore.setState({ hydrated: true });
  });
