import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/state/authStore';
import type { BloodDonorDraft, BloodDonorRegistration, UserBloodRequest } from '@data/index';

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
  askRequests?: UserBloodRequest[];
}

const persist = (
  draft: BloodDonorDraft,
  registration: BloodDonorRegistration | null,
  interestedRequestIds: string[],
  acceptedRequestIds: string[],
  askRequests: UserBloodRequest[],
) => {
  AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ draft, registration, interestedRequestIds, acceptedRequestIds, askRequests }),
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
  /** Blood requests the user posted via "Ask Blood" (newest first, device-local). */
  askRequests: UserBloodRequest[];
  /** True once the AsyncStorage hydration read has settled. */
  hydrated: boolean;
  updateDraft: (patch: Partial<BloodDonorDraft>) => void;
  /** Promotes the current draft to a committed registration (snapshot + account phone). */
  register: () => void;
  /** Toggles the donor's "interested" flag on a request (persisted). */
  toggleInterested: (requestId: string) => void;
  /** Records the donor's confirmed acceptance of a request (persisted). */
  acceptRequest: (requestId: string) => void;
  /** Posts a user "Ask Blood" request (stamps id + postedAt, prepends, persists). */
  postAskRequest: (input: Omit<UserBloodRequest, 'id' | 'postedAt'>) => void;
  reset: () => void;
}

export const useBloodDonorStore = create<BloodDonorState>()((set, get) => ({
  draft: EMPTY_DRAFT,
  registration: null,
  interestedRequestIds: [],
  acceptedRequestIds: [],
  askRequests: [],
  hydrated: false,
  updateDraft: (patch) => {
    const draft = { ...get().draft, ...patch };
    set({ draft });
    persist(draft, get().registration, get().interestedRequestIds, get().acceptedRequestIds, get().askRequests);
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
    persist(draft, registration, get().interestedRequestIds, get().acceptedRequestIds, get().askRequests);
  },
  toggleInterested: (requestId) => {
    const { interestedRequestIds } = get();
    const next = interestedRequestIds.includes(requestId)
      ? interestedRequestIds.filter((id) => id !== requestId)
      : [...interestedRequestIds, requestId];
    set({ interestedRequestIds: next });
    persist(get().draft, get().registration, next, get().acceptedRequestIds, get().askRequests);
  },
  acceptRequest: (requestId) => {
    const { acceptedRequestIds } = get();
    if (acceptedRequestIds.includes(requestId)) return;
    const next = [...acceptedRequestIds, requestId];
    set({ acceptedRequestIds: next });
    persist(get().draft, get().registration, get().interestedRequestIds, next, get().askRequests);
  },
  postAskRequest: (input) => {
    const request: UserBloodRequest = {
      ...input,
      id: 'uba-' + Math.random().toString(36).substring(2, 10),
      postedAt: new Date().toISOString(),
    };
    const askRequests = [request, ...get().askRequests];
    set({ askRequests });
    persist(get().draft, get().registration, get().interestedRequestIds, get().acceptedRequestIds, askRequests);
  },
  reset: () => {
    set({ draft: EMPTY_DRAFT, registration: null, interestedRequestIds: [], acceptedRequestIds: [], askRequests: [] });
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
      askRequests: parsed.askRequests ?? [],
    });
  })
  .catch(() => {})
  .finally(() => {
    useBloodDonorStore.setState({ hydrated: true });
  });
