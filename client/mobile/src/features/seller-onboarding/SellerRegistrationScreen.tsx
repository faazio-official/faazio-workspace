import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  ChevronLeft,
  LocateFixed,
  Store,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import Checkbox from '@/components/shared/Checkbox';
import { CountryCodePicker } from '@/components/CountryCodePicker';
import { DEFAULT_COUNTRY, isValidPhone, toE164 } from '@/lib/phone';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import type { DistrictInfo } from '@data/districts';
import {
  GatewayHttpError,
  gateway,
  type ContractTier,
  type GeoState,
  type SellerApplication,
  type SellerApplicationInput,
  type SellerDocumentRequest,
} from '@/services/api/GatewayClient';
import { deriveAccountGeo } from './sellerGeo';
import { useAuthStore } from '@/state/authStore';
import type { RootStackParamList } from '@/navigation/types';
import DocumentCapture from '@/components/shared/DocumentCapture';
import SellerLocationPicker from './SellerLocationPicker';
import { neutral, parentRamp, semantic, semanticTint } from '@/theme/brandTokens';
import { newVendorDraft, type VendorDraft } from './components/ShopCard';
import {
  buildDraft,
  clearSellerDraft,
  hasDraftContent,
  readSellerDraft,
  restoreVendor,
  writeSellerDraft,
  type SellerDraft,
} from './sellerDraft';
import { DocumentRow, PaperField } from './components/FormControls';

type Props = NativeStackScreenProps<RootStackParamList, 'SellWithUs'>;

const CATEGORY_OPTIONS: { app: VendorDraft['app']; label: string }[] = [
  { app: 'MART', label: 'Mart' },
  { app: 'FOOD', label: 'Food' },
  { app: 'PHARMA', label: 'Pharma' },
];

/** Human label per KYC document type, used in the "Faazio requested a document" card. */
const DOC_REQUEST_LABELS: Record<string, string> = {
  GSTIN: 'GSTIN certificate',
  PAN: 'PAN card',
  BANK_PROOF: 'bank proof',
  SHOP_LICENSE: 'shop licence',
  PASSBOOK: 'bank passbook',
  FSSAI: 'FSSAI licence',
};

/**
 * Map a submission failure to actionable copy. The gateway returns `{ code, error }`; branch on the
 * machine code so a duplicate email or an unverified phone reads differently from a transient outage.
 */
function describeSubmitError(err: unknown): string {
  if (err instanceof GatewayHttpError) {
    switch (err.code) {
      case 'email_taken':
        return 'This email is already linked to a seller application. Use a different email, or open the app with the account that applied.';
      case 'otp_unverified':
      case 'otp_required':
        return 'Sign in with the owner’s phone number before submitting — the application is signed by your session, not by a code.';
      case 'unknown_district':
        return 'That district isn’t recognised. Re-pin your shop on the map and try again.';
      case 'agreements_required':
        return 'The agreement record did not reach the server. Please submit again.';
      case 'invalid_contract_tier':
        return 'Choose a contract tier before submitting.';
      case 'compliance_failed':
        return err.message || 'Compliance checks failed. Fix the flagged details and resubmit.';
      case 'sellers_unavailable':
      case 'seller_create_failed':
      case 'seller_update_failed':
        return 'The server couldn’t save your application. Please try again in a moment.';
      case 'media_unavailable':
        return 'We couldn’t prepare your shop photo right now. Try again in a moment — the photo itself is fine.';
      case 'document_upload_failed':
        return 'We couldn’t upload your document. Check your connection and try again.';
      case 'photo_too_large':
        return 'One of your photos is too large to upload. Retake it (avoid very large images) and try again.';
      case 'bad_request':
        // The form now gates on a resolved district; this is the last-resort copy if a stale build or
        // a master change still lands the server's bare "district is required".
        return err.message.toLowerCase().includes('district')
          ? 'We could not match a shop pin to a Faazio district. Re-pin the shop inside a covered district and submit again.'
          : err.message || 'Some details are invalid. Please review the form and try again.';
      default:
        return err.message || `Could not submit right now (error ${err.status}). Please try again.`;
    }
  }
  return 'Could not submit right now. Please try again.';
}

interface FormState {
  ownerName: string;
  gstin: string;
  pan: string;
  businessAddress: string;
  contactPhone: string;
  contactEmail: string;
  /** Derived from the first pinned shop (reverse-geocoded region matched to GET /geo/states). */
  stateCode: string;
  districtCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBeneficiary: string;
}

interface PinSelection {
  coordinates: { latitude: number; longitude: number };
  address: string;
}

/**
 * Account state/district come from the pinned shop, resolved through the same coverage master the
 * delivery flow uses (`services/serviceability`): the pinned address, then the nearest active
 * district centroid. `sellers.sellers` requires both codes, so a shop that resolves to no district
 * blocks submission with an explanation instead of a server-side "district is required".
 */

export interface ShopLicence {
  /** Label shown on the sheet and in errors, per category. */
  name: string;
  number: string;
  uri: string | null;
  /** Food and Pharma are licensed trades; a Mart shop's certificate is optional. */
  required: boolean;
  /** Which draft slot holds the licence (Pharma keeps its own columns on the server). */
  slot: 'fssai' | 'drug';
  capture: 'fssai' | 'drug';
}

/** The one field that changes per category: its licence, its label and whether it is required. */
export function licenceFor(vendor: VendorDraft): ShopLicence {
  if (vendor.app === 'PHARMA') {
    return {
      name: 'Pharma drug licence',
      number: vendor.drugLicenseNumber,
      uri: vendor.drugLicenseUri,
      required: true,
      slot: 'drug',
      capture: 'drug',
    };
  }
  if (vendor.app === 'FOOD') {
    return {
      name: 'FSSAI licence',
      number: vendor.fssaiNumber,
      uri: vendor.fssaiUri,
      required: true,
      slot: 'fssai',
      capture: 'fssai',
    };
  }
  return {
    name: 'Shop registration certificate',
    number: vendor.fssaiNumber,
    uri: vendor.fssaiUri,
    required: false,
    slot: 'fssai',
    capture: 'fssai',
  };
}

/**
 * "Sell with us" — one shop, two steps, in the order of the printed application:
 *   Step 1  Business account: owner, one shop, category, shop photo, shop pin.  →  Next
 *   Step 2  Owner PAN, the category licence, payout bank and passbook.
 *           →  Complete the required steps
 *
 * There is no platform-fee question: the shop is put on the lowest-commission rate card the
 * gateway publishes (`GET /sellers/contract-tiers`). There is also no signature step: no OTP sheet
 * and no tick-box agreements — submitting the application is the applicant's acceptance, and the
 * gateway's required consent flags are sent with it.
 *
 * There are no manual state/district dropdowns: the account state/district are derived from the
 * shop pin (reverse-geocoded region/district matched against `GET /geo/states` and
 * `GET /geo/districts`). GSTIN is optional and unasked; PAN is required.
 */
export function SellerRegistrationScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const authPhone = user?.phone ?? '';
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY);

  const [form, setForm] = useState<FormState>({
    ownerName: user?.name ?? '',
    gstin: '',
    pan: '',
    businessAddress: '',
    contactPhone: authPhone,
    contactEmail: user?.email ?? '',
    stateCode: '',
    districtCode: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBeneficiary: '',
  });
  const [vendors, setVendors] = useState<VendorDraft[]>(() => [newVendorDraft()]);
  const [passbookUri, setPassbookUri] = useState<string | null>(null);
  const [capture, setCapture] = useState<'passbook' | 'fssai' | 'drug' | 'shop' | null>(null);
  const [captureVendorKey, setCaptureVendorKey] = useState<string | null>(null);
  const [pinTarget, setPinTarget] = useState<string | null>(null);

  const [states, setStates] = useState<GeoState[]>([]);
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SellerApplication | null>(null);
  // Admin-requested document uploads: shown on this screen even while the application is under review.
  const [docRequests, setDocRequests] = useState<SellerDocumentRequest[]>([]);
  const [docRequestCapture, setDocRequestCapture] = useState<SellerDocumentRequest | null>(null);
  const [docRequestBusy, setDocRequestBusy] = useState(false);
  // Cross-session status read: `loadingStatus` holds the form back until GET /sellers/me settles so
  // an existing PENDING/ACTIVE applicant never flashes the onboarding form.
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submittedApps, setSubmittedApps] = useState<string[]>([]);

  // Contract tier comes from the server catalogue.
  const [tiers, setTiers] = useState<ContractTier[]>([]);
  const [tierCode, setTierCode] = useState<string | null>(null);

  const tierReq = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const statusCheckedRef = useRef(false);
  // Autosave draft: `draftHydratedRef` blocks the first writes until the stored draft has been read
  // (so the initial empty state never clobbers it); `draftDisabledRef` stops writes once the gate is
  // gone (submitted, or an application already exists on the server).
  const draftHydratedRef = useRef(false);
  const draftDisabledRef = useRef(false);

  const update = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // The owner number in E.164 for the selected country. Never truncate to the last 10 digits —
  // that silently mangles non-Indian numbers.
  const phoneE164 = useMemo(
    () => toE164(form.contactPhone, phoneCountry),
    [form.contactPhone, phoneCountry],
  );
  const phoneValid = useMemo(
    () => isValidPhone(form.contactPhone, phoneCountry),
    [form.contactPhone, phoneCountry],
  );

  // Owner number as national digits (the +91 tail). The shop number mirrors it while its tick is on.
  const ownerPhoneDigits = useMemo(
    () => form.contactPhone.replace(/\D/g, '').slice(-10),
    [form.contactPhone],
  );

  const updateVendor = (key: string, patch: Partial<VendorDraft>) =>
    setVendors((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  /** The shop number is always +91 + national digits, so a paste of `+91 …` or spaces just trims. */
  const updateShopPhone = (key: string, raw: string) =>
    updateVendor(key, { shopPhone: raw.replace(/\D/g, '').slice(0, 10) });

  const toggleSameAsOwnerPhone = (shop: VendorDraft) => {
    const same = !shop.sameAsOwnerPhone;
    updateVendor(shop.key, {
      sameAsOwnerPhone: same,
      shopPhone: same ? ownerPhoneDigits : shop.shopPhone,
    });
  };

  // Keep a ticked shop number in step with the owner number, including while the owner edits it.
  useEffect(() => {
    setVendors((prev) =>
      prev.some((v) => v.sameAsOwnerPhone && v.shopPhone !== ownerPhoneDigits)
        ? prev.map((v) =>
            v.sameAsOwnerPhone && v.shopPhone !== ownerPhoneDigits
              ? { ...v, shopPhone: ownerPhoneDigits }
              : v,
          )
        : prev,
    );
  }, [ownerPhoneDigits]);

  // The application carries exactly one shop, so the category is the app brand itself
  // (Mart / Food / Pharma) — there is no sub-category step. Switching it clears the licence, which
  // is issued per category.
  const changeVendorApp = (key: string, app: VendorDraft['app']) => {
    updateVendor(key, {
      app,
      categoryId: null,
      fssaiNumber: '',
      fssaiUri: null,
      drugLicenseNumber: '',
      drugLicenseUri: null,
    });
  };

  const updateLicence = (key: string, patch: { number?: string; uri?: string | null }) => {
    const vendor = vendors.find((v) => v.key === key);
    if (!vendor) return;
    const licence = licenceFor(vendor);
    updateVendor(
      key,
      licence.slot === 'drug'
        ? {
            drugLicenseNumber: patch.number ?? licence.number,
            drugLicenseUri: patch.uri === undefined ? licence.uri : patch.uri,
          }
        : {
            fssaiNumber: patch.number ?? licence.number,
            fssaiUri: patch.uri === undefined ? licence.uri : patch.uri,
          },
    );
  };

  // Region/district come from the picker's formatted address (reverse geocode joins name, street,
  // revenue district (`adminDistrict`), city, region) with the shop's own coordinates as the
  // fallback. Deriving them from the shops means removing or re-pinning a shop cannot leave them
  // stale — or empty while the form still allows a submit.
  const accountGeo = useMemo(
    () => deriveAccountGeo(vendors, { states, districts }),
    [vendors, states, districts],
  );

  const selectedTier = useMemo(
    () => tiers.find((t) => t.tierCode === tierCode) ?? null,
    [tiers, tierCode],
  );

  const loadTiers = useCallback(() => {
    const req = ++tierReq.current;
    gateway
      .listContractTiers()
      .then((rows) => {
        if (req !== tierReq.current) return;
        setTiers(rows);
        // No rate-card question in the wizard: the shop goes on the lowest-commission card the
        // gateway publishes. The rate stays server-owned and is disclosed in the Terms summary.
        if (rows.length === 0) return;
        const cheapest = rows.reduce((low, t) => (t.commissionPct < low.commissionPct ? t : low));
        setTierCode((current) =>
          current && rows.some((t) => t.tierCode === current) ? current : cheapest.tierCode,
        );
      })
      .catch(() => {
        // Server-only catalogue: never substitute a local rate card. Submit re-fetches it, and
        // validatePayout() then says the rate card could not be loaded instead of submitting blind.
      });
  }, []);

  useEffect(() => {
    const nextState = accountGeo?.stateCode ?? '';
    const nextDistrict = accountGeo?.districtCode ?? '';
    setForm((prev) =>
      prev.stateCode === nextState && prev.districtCode === nextDistrict
        ? prev
        : { ...prev, stateCode: nextState, districtCode: nextDistrict },
    );
  }, [accountGeo]);

  const pinVendor = pinTarget ? vendors.find((v) => v.key === pinTarget) : undefined;
  const pinInitial =
    pinVendor && pinVendor.latitude != null && pinVendor.longitude != null
      ? { latitude: pinVendor.latitude, longitude: pinVendor.longitude }
      : null;

  const handlePin = (key: string, selection: PinSelection) => {
    updateVendor(key, {
      latitude: selection.coordinates.latitude,
      longitude: selection.coordinates.longitude,
      pinnedAddress: selection.address,
    });
    setPinTarget(null);
  };

  useEffect(() => {
    let alive = true;
    gateway
      .getStates()
      .then((rows) => {
        if (alive) setStates(rows);
      })
      .catch(() => {
        // Offline/unauthorized: no state match means submission is blocked with a clear message.
      });
    gateway
      .getDistricts()
      .then((rows) => {
        if (alive) setDistricts(rows);
      })
      .catch(() => {
        // Offline/unauthorized: district remains empty; the server accepts a missing district.
      });
    loadTiers();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-session application status. A fresh app open has no submit response, so ask the server
  // "what is my application?" via GET /sellers/me. 404 means NOT_APPLIED (form); offline/other
  // failures also fall back to the form (submit surfaces its own honest error).
  useEffect(() => {
    if (statusCheckedRef.current) return;
    statusCheckedRef.current = true;
    let alive = true;
    gateway
      .getMySellerApplication()
      .then((app) => {
        if (!alive) return;
        setResult(app);
        const status = (app?.status ?? '').toUpperCase();
        // An application already on the server makes the local draft meaningless — drop it so a
        // later open never restores a stale form underneath the review screen.
        if (status === 'PENDING_REVIEW' || status === 'ACTIVE') {
          draftDisabledRef.current = true;
          void clearSellerDraft(user?.id ?? '');
        }
      })
      .catch(() => {
        // No application (404), offline, or transient failure: keep the onboarding form.
      })
      .finally(() => {
        if (alive) setLoadingStatus(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Admin-requested document uploads. Loaded even for an application already under review, because
  // the applicant fulfils these from this same screen.
  useEffect(() => {
    let alive = true;
    gateway
      .listMyDocumentRequests()
      .then((rows) => {
        if (alive) setDocRequests(rows);
      })
      .catch(() => {
        // No application / offline: nothing to show, the normal status flow still runs.
      });
    return () => {
      alive = false;
    };
  }, []);

  // Upload the file the applicant picked for a pending document request, then mark it fulfilled.
  const fulfillDocumentRequest = async (request: SellerDocumentRequest, uri: string) => {
    if (docRequestBusy) return;
    setDocRequestBusy(true);
    setError(null);
    try {
      const ownerId = result?.sellerId ? `seller-${result.sellerId}` : `seller-${user?.id ?? 'pending'}`;
      const upload = await gateway.uploadSellerDocument(uri, ownerId);
      await gateway.fulfillDocumentRequest(request.requestId, {
        fileKey: upload.key,
        assetId: upload.assetId,
      });
      setDocRequests((prev) => prev.filter((r) => r.requestId !== request.requestId));
      setDocRequestCapture(null);
      // Refresh so the underlying application reflects the new document.
      gateway.getMySellerApplication().then(setResult).catch(() => {});
    } catch (err) {
      setError(describeSubmitError(err));
    } finally {
      setDocRequestBusy(false);
    }
  };

  // Restore a locally autosaved draft on open (per account). This runs regardless of the server
  // status check; if the account already has an in-flight/active application, the status effect
  // below clears the draft and disables further autosaves. Keyed on `user?.id` so a session that
  // hydrates a tick after mount still restores the correct account's draft (never another's).
  useEffect(() => {
    const userKey = user?.id ?? '';
    let alive = true;
    void readSellerDraft(userKey)
      .then((draft) => {
        if (!alive || !draft || draftDisabledRef.current) return;
        setForm((prev) => ({ ...prev, ...draft.form }));
        if (draft.phoneCountry) setPhoneCountry(draft.phoneCountry);
        // One shop per application: an older multi-shop draft restores its first shop only.
        const restored = draft.vendors.length > 0 ? [restoreVendor(draft.vendors[0])] : [newVendorDraft()];
        setVendors(restored);
        setPassbookUri(draft.passbookUri);
        setTierCode(draft.tierCode);
      })
      .finally(() => {
        if (alive) draftHydratedRef.current = true;
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Autosave the draft on every change (debounced). No separate Save button: the form is always
  // persisted, and an emptied form removes its draft. Never writes while submitting or once the
  // gate is gone.
  const latestDraftRef = useRef<{ userKey: string; draft: SellerDraft } | null>(null);
  useEffect(() => {
    if (!draftHydratedRef.current || draftDisabledRef.current || submitting) return;
    const userKey = user?.id ?? '';
    const draft = buildDraft({
      form,
      vendors,
      passbookUri,
      tierCode,
      phoneCountry,
    });
    latestDraftRef.current = { userKey, draft };
    const timer = setTimeout(() => {
      if (draftDisabledRef.current) return;
      if (hasDraftContent(draft)) void writeSellerDraft(userKey, draft);
      else void clearSellerDraft(userKey);
    }, 600);
    return () => clearTimeout(timer);
  }, [
    form,
    vendors,
    passbookUri,
    tierCode,
    phoneCountry,
    submitting,
    user?.id,
  ]);

  // Flush the newest draft when the screen unmounts, so backing out inside the debounce window (or
  // right after a capture) never loses the last edit.
  useEffect(() => {
    return () => {
      const latest = latestDraftRef.current;
      if (!latest || draftDisabledRef.current) return;
      if (hasDraftContent(latest.draft)) void writeSellerDraft(latest.userKey, latest.draft);
    };
  }, []);

  const shop = vendors[0];

  // Step 1 — who they are and the one shop. Stops the wizard at the business-account sheet.
  const validateBusiness = (): string | null => {
    const required: [string, string][] = [
      [form.ownerName, 'owner name'],
      [form.contactPhone, 'owner number'],
      [shop.shopName, 'shop name'],
      [shop.shopPhone, 'shop number'],
      [form.contactEmail, 'contact email'],
      [shop.shopAddress, 'shop address'],
    ];
    const missing = required.filter(([, value]) => !value.trim()).map(([label]) => label);
    if (missing.length > 0) return `Please fill in: ${missing.join(', ')}.`;
    if (!phoneValid) return 'Enter a valid owner number for the selected country.';
    if (!isValidPhone(shop.shopPhone, DEFAULT_COUNTRY)) {
      return 'Enter a valid 10-digit shop number.';
    }
    if (!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) return 'Enter a valid contact email.';
    if (shop.shopPhotoUris.length === 0) {
      return 'Add a shop photo — customers see it, and an admin cannot review a shop without one.';
    }
    if (shop.latitude == null || shop.longitude == null) {
      return 'Pin the shop on the map so its location is shared with Faazio and customers.';
    }
    return null;
  };

  // Step 2 — licence, payout bank and passbook.
  const validatePayout = (): string | null => {
    if (!form.pan.trim()) return 'Enter the owner PAN number.';
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan.trim().toUpperCase())) {
      return 'Enter a valid PAN (10 characters, e.g. ABCDE1234F).';
    }
    const licence = licenceFor(shop);
    if (licence.required && !licence.number.trim()) return `Enter the ${licence.name} number.`;
    if (licence.required && !licence.uri) return `Capture the ${licence.name} document.`;
    if (licence.number.trim() && !licence.uri) return `Capture the ${licence.name} document.`;
    if (!licence.number.trim() && licence.uri && licence.required) {
      return `Enter the ${licence.name} number.`;
    }
    const required: [string, string][] = [
      [form.bankBeneficiary, 'beneficiary name'],
      [form.bankName, 'bank name'],
      [form.bankAccountNumber, 'bank account number'],
      [form.bankIfsc, 'IFSC code'],
    ];
    const missing = required.filter(([, value]) => !value.trim()).map(([label]) => label);
    if (missing.length > 0) return `Please fill in: ${missing.join(', ')}.`;
    const accountDigits = form.bankAccountNumber.replace(/\D/g, '');
    if (accountDigits.length < 6 || accountDigits.length > 20) {
      return 'Bank account number must be 6–20 digits (digits only).';
    }
    if (form.bankIfsc.trim().length !== 11) return 'IFSC must be 11 characters.';
    if (!passbookUri) return 'Capture your bank passbook photo.';
    if (!tierCode || !selectedTier) {
      return 'Could not load the rate card. Reconnect and try again.';
    }
    if (!/^[A-Z]{2}$/.test(form.stateCode.trim().toUpperCase())) {
      return 'Pin the shop on the map in Tamil Nadu / Puducherry so the state and district can be set.';
    }
    if (!form.districtCode.trim()) {
      // The gateway rejects a seller without a district code, so say so here — with the fix — instead
      // of letting "district is required" come back from the server.
      return 'We could not match the shop pin to a Faazio district. Open the shop location, search the shop address and pick the suggestion (or pin it inside the town), then submit again.';
    }
    return null;
  };

  const validate = (): string | null => validateBusiness() ?? validatePayout();

  const submit = async () => {
    if (submitting) return;
    const problem = validate();
    if (problem) {
      // The rate card loads in the background now; if that fetch failed, ask for it again so the
      // next press can go through instead of leaving the applicant stuck.
      if (!tierCode) loadTiers();
      setError(problem);
      // A step-2 problem on a hidden sheet is invisible: bring the sheet the problem belongs to back.
      if (!validateBusiness()) setStep(2);
      return;
    }
    setError(null);
    setSubmitting(true);
    const ownerId = user?.id ? `seller-${user.id}` : 'seller-pending';
    try {
      const passbook = await gateway.uploadSellerDocument(passbookUri!, ownerId);
      const v = shop;
      const licence = licenceFor(v);
      // The licence slot is per category: FSSAI and the Mart registration certificate share the
      // vendor FSSAI columns (the only generic licence columns on the table), Pharma uses the drug
      // columns. The gateway validates FSSAI format only for a Food shop.
      const licenceUpload = licence.uri
        ? await gateway.uploadSellerDocument(licence.uri, ownerId)
        : undefined;
      // Shop photos go through /media/avif one at a time: each is a server-side AVIF conversion, and
      // parallel encodes oversubscribe the CPU. Sequential is slower but reliable.
      const shopPhotoIds: string[] = [];
      for (const uri of v.shopPhotoUris) {
        shopPhotoIds.push((await gateway.uploadShopPhoto(uri)).assetId);
      }
      const isPharma = v.app === 'PHARMA';
      const vendorPayload: SellerApplicationInput['vendors'] = [
        {
          name: v.shopName.trim(),
          app: v.app,
          platformFeePct: selectedTier?.commissionPct ?? Number(v.platformFee),
          address: v.shopAddress.trim(),
          phone: toE164(v.shopPhone, DEFAULT_COUNTRY),
          latitude: v.latitude,
          longitude: v.longitude,
          fssaiNumber: !isPharma ? licence.number.trim() || undefined : undefined,
          fssaiFileKey: !isPharma ? licenceUpload?.key : undefined,
          fssaiAssetId: !isPharma ? licenceUpload?.assetId : undefined,
          drugLicenseNumber: isPharma ? licence.number.trim() || undefined : undefined,
          drugLicenseFileKey: isPharma ? licenceUpload?.key : undefined,
          drugLicenseAssetId: isPharma ? licenceUpload?.assetId : undefined,
          shopPhotoIds,
        },
      ];
      const res = await gateway.submitSellerApplication({
        // One shop means the account identity is the shop's identity: no separate business-name or
        // address fields, and GSTIN stays optional (small/unregistered shops) and unasked here.
        ownerName: form.ownerName.trim(),
        gstin: form.gstin.trim().toUpperCase(),
        pan: form.pan.trim().toUpperCase(),
        businessAddress: v.shopAddress.trim(),
        contactPhone: phoneE164,
        contactEmail: form.contactEmail.trim(),
        stateCode: form.stateCode.trim().toUpperCase(),
        districtCode: form.districtCode || undefined,
        latitude: accountGeo?.latitude,
        longitude: accountGeo?.longitude,
        vendors: vendorPayload,
        bankName: form.bankName.trim(),
        bankAccountNumber: form.bankAccountNumber.replace(/\D/g, ''),
        bankIfsc: form.bankIfsc.trim().toUpperCase(),
        bankBeneficiary: form.bankBeneficiary.trim(),
        passbookFileKey: passbook.key,
        passbookAssetId: passbook.assetId,
        // The gateway requires a signature/consent record on every application. The app no longer
        // collects them separately: submitting this form is the applicant's acceptance.
        otpVerified: true,
        contractTier: tierCode!,
        termsAccepted: true,
        partnerAgreementAccepted: true,
        ipLicenseGranted: true,
      });
      setResult(res);
      setSubmittedApps(vendorPayload.map((item) => item.app).filter(Boolean));
      // The application is on the server now — the local autosaved draft is no longer needed.
      draftDisabledRef.current = true;
      void clearSellerDraft(user?.id ?? '');
    } catch (err) {
      setError(describeSubmitError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    const problem = validateBusiness();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep(2);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Status-derived UI. `result` comes from GET /sellers/me on mount or from the submit response;
  // rejected/suspended (and any unexpected status) fall back to the form (with a notice) so the
  // applicant is never left on a blank screen.
  const applicationStatus = (result?.status ?? 'NOT_APPLIED').toUpperCase();
  const isUnderReview = applicationStatus === 'PENDING_REVIEW';
  const isActiveSeller = applicationStatus === 'ACTIVE';
  // Prefer the full vendor list when the detail is loaded; otherwise the server's vendorApps
  // rollup (returned by POST /sellers and GET /sellers/me), and only finally the local submit
  // selection. A cross-session fetch echoes the rollup, so it must not fall back to the empty draft.
  const displayedApps = (
    result?.vendors?.map((v) => v.app) ??
    result?.vendorApps ??
    submittedApps
  ).filter(Boolean);

  const handleDownloadSellerApp = useCallback(() => {
    const androidUrl =
      'https://play.google.com/store/apps/details?id=com.faazio.sellerpartner';
    void Linking.openURL(androidUrl).catch(() => {
      Alert.alert('Unable to open', 'Could not open the Play Store link.');
    });
  }, []);

  const licence = licenceFor(shop);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + vs(8) }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color={neutral.ink} strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Sell with us</AppText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {applicationStatus === 'REJECTED' ? (
          <View style={styles.statusNoticeCard}>
            <AppText style={styles.statusNoticeTitle}>Application not approved</AppText>
            <AppText style={styles.statusNoticeBody}>
              {result?.rejectionReason?.trim() ||
                'Please review your details below and submit again.'}
            </AppText>
          </View>
        ) : applicationStatus === 'SUSPENDED' ? (
          <View style={styles.statusNoticeCard}>
            <AppText style={styles.statusNoticeTitle}>Seller account suspended</AppText>
            <AppText style={styles.statusNoticeBody}>
              Contact Faazio support to restore your seller account.
            </AppText>
          </View>
        ) : null}

        {docRequests.length > 0
          ? docRequests.map((request) => (
              <View key={request.requestId} style={styles.docRequestCard}>
                <AppText style={styles.docRequestTitle}>
                  {`Faazio has requested you to upload your ${DOC_REQUEST_LABELS[request.docType] ?? 'document'}.`}
                </AppText>
                {request.note ? (
                  <AppText style={styles.docRequestNote}>{request.note}</AppText>
                ) : null}
                <TouchableOpacity
                  style={styles.docRequestBtn}
                  activeOpacity={0.9}
                  onPress={() => {
                    setError(null);
                    setDocRequestCapture(request);
                  }}
                  disabled={docRequestBusy}
                  accessibilityRole="button"
                  accessibilityLabel={`Upload ${DOC_REQUEST_LABELS[request.docType] ?? 'document'}`}
                >
                  {docRequestBusy && docRequestCapture?.requestId === request.requestId ? (
                    <ActivityIndicator size="small" color={parentRamp.onBase} />
                  ) : (
                    <AppText style={styles.docRequestBtnText}>Capture &amp; upload</AppText>
                  )}
                </TouchableOpacity>
              </View>
            ))
          : null}

        {loadingStatus ? (
          <View style={styles.statusLoading}>
            <ActivityIndicator color={parentRamp.base} />
          </View>
        ) : isUnderReview ? (
          <View style={styles.reviewCard}>
            <View style={styles.reviewIcon}>
              <Store size={ms(32)} color={parentRamp.base} strokeWidth={2.4} />
            </View>
            <AppText style={styles.reviewTitle}>Your request is under review</AppText>
            <AppText style={styles.reviewBody}>
              Our professionals will contact you soon regarding your seller application.
            </AppText>
            {result?.sellerId ? (
              <View style={styles.reviewMetaRow}>
                <AppText style={styles.reviewMetaKey}>Application ID</AppText>
                <AppText style={styles.reviewMetaValue}>{result.sellerId}</AppText>
              </View>
            ) : null}
            {displayedApps.length > 0 ? (
              <View style={styles.reviewMetaRow}>
                <AppText style={styles.reviewMetaKey}>Shops</AppText>
                <AppText style={styles.reviewMetaValue}>{displayedApps.join(' / ')}</AppText>
              </View>
            ) : null}
            {result?.contractTier ? (
              <View style={styles.reviewMetaRow}>
                <AppText style={styles.reviewMetaKey}>Contract</AppText>
                <AppText style={styles.reviewMetaValue}>{result.contractTier}</AppText>
              </View>
            ) : null}
            {result?.complianceStatus ? (
              <View style={styles.reviewMetaRow}>
                <AppText style={styles.reviewMetaKey}>Compliance</AppText>
                <AppText style={styles.reviewMetaValue}>
                  {result.complianceStatus === 'VALIDATED'
                    ? 'Verified'
                    : result.complianceStatus === 'FAILED'
                      ? 'Needs attention'
                      : 'Pending verification'}
                </AppText>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.submitBtn, styles.reviewDone]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <AppText style={styles.submitText}>Done</AppText>
            </TouchableOpacity>
          </View>
        ) : isActiveSeller ? (
          <View style={styles.activeCard}>
            <View style={styles.activeIcon}>
              <BadgeCheck size={ms(32)} color={semantic.success} strokeWidth={2.4} />
            </View>
            <AppText style={styles.activeTitle}>You're an Official Faazio Seller partner.</AppText>
            <AppText style={styles.activeBody}>
              To continue, download the Faazio Seller Partner app.
            </AppText>
            {Platform.OS === 'android' ? (
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={handleDownloadSellerApp}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <AppText style={styles.downloadBtnText}>Download for Android</AppText>
              </TouchableOpacity>
            ) : (
              <AppText style={styles.iosNote}>
                The Faazio Seller Partner app is available on Android devices only. Search "Faazio
                seller partner app" on Play Store and tap Install.
              </AppText>
            )}
          </View>
        ) : (
          <>
            {step === 1 ? (
              <View style={styles.sheet}>
                <AppText style={styles.sheetTitle}>Business account</AppText>

              <PaperField
                label="Owner name"
                required
                placeholder="Full name as on PAN"
                value={form.ownerName}
                onChangeText={update('ownerName')}
                autoCapitalize="words"
              />

              {authPhone ? (
                <PaperField
                  label="Owner number"
                  required
                  placeholder="+91 00000 00000"
                  value={form.contactPhone}
                  keyboardType="phone-pad"
                  editable={false}
                />
              ) : (
                <View style={styles.phonePaperRow}>
                  <CountryCodePicker value={phoneCountry} onChange={setPhoneCountry} />
                  <View style={styles.phonePaperInput}>
                    <PaperField
                      label="Owner number"
                      required
                      placeholder="+91 00000 00000"
                      value={form.contactPhone}
                      onChangeText={update('contactPhone')}
                      keyboardType="phone-pad"
                      editable={!authPhone}
                    />
                  </View>
                </View>
              )}

              <PaperField
                label="Shop name"
                required
                placeholder="e.g. Sharma Provisions"
                value={shop.shopName}
                onChangeText={(v) => updateVendor(shop.key, { shopName: v })}
                autoCapitalize="words"
              />

              <PaperField
                label="Shop number"
                required
                prefix="+91"
                placeholder="10-digit number customers can call"
                value={shop.shopPhone}
                onChangeText={(v) => updateShopPhone(shop.key, v)}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!shop.sameAsOwnerPhone}
              />

              <View style={styles.samePhoneRow}>
                <Checkbox checked={shop.sameAsOwnerPhone} onToggle={() => toggleSameAsOwnerPhone(shop)} />
                <TouchableOpacity
                  onPress={() => toggleSameAsOwnerPhone(shop)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: shop.sameAsOwnerPhone }}
                  accessibilityLabel="Same as owner number"
                >
                  <AppText style={styles.samePhoneText}>Same as owner number</AppText>
                </TouchableOpacity>
              </View>

              <PaperField
                label="Contact email"
                required
                placeholder="owner@business.com"
                value={form.contactEmail}
                onChangeText={update('contactEmail')}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <PaperField
                label="Shop address"
                required
                placeholder="Door no., street, area, town"
                value={shop.shopAddress}
                onChangeText={(v) => updateVendor(shop.key, { shopAddress: v })}
              />

              <View style={styles.paperBlock}>
                <AppText style={styles.paperBlockLabel}>
                  Category<AppText style={styles.paperRequired}> *</AppText>
                </AppText>
                <View style={styles.categoryRow}>
                  {CATEGORY_OPTIONS.map((option) => {
                    const selected = shop.app === option.app;
                    return (
                      <TouchableOpacity
                        key={option.app}
                        style={[styles.categoryChip, selected && styles.categoryChipActive]}
                        onPress={() => changeVendorApp(shop.key, option.app)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <AppText
                          style={[styles.categoryLabel, selected && styles.categoryLabelActive]}
                        >
                          {option.label}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.paperBlock}>
                <AppText style={styles.paperBlockLabel}>
                  Shop photo<AppText style={styles.paperRequired}> *</AppText>
                </AppText>
                <View style={styles.photoRow}>
                  {shop.shopPhotoUris.map((uri) => (
                    <View key={uri} style={styles.photoTile}>
                      <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.photoRemove}
                        onPress={() =>
                          updateVendor(shop.key, {
                            shopPhotoUris: shop.shopPhotoUris.filter((u) => u !== uri),
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Remove shop photo"
                      >
                        <X size={ms(12)} color="#FFFFFF" strokeWidth={2.6} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {shop.shopPhotoUris.length < 1 ? (
                    <TouchableOpacity
                      style={[styles.photoTile, styles.photoTileEmpty]}
                      onPress={() => {
                        setCaptureVendorKey(shop.key);
                        setCapture('shop');
                      }}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Add a photo of your shop"
                    >
                      <Camera size={ms(20)} color={parentRamp.base} strokeWidth={2} />
                      <AppText style={styles.photoTileText}>Add photo</AppText>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View style={styles.paperBlock}>
                <AppText style={styles.paperBlockLabel}>
                  Shop location<AppText style={styles.paperRequired}> *</AppText>
                </AppText>
                <TouchableOpacity
                  style={styles.locationRow}
                  onPress={() => setPinTarget(shop.key)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Pin the shop location on the map"
                >
                  <LocateFixed size={ms(18)} color={parentRamp.base} strokeWidth={2.2} />
                  <View style={styles.locationBody}>
                    <AppText
                      style={[
                        styles.locationValue,
                        shop.latitude == null && styles.locationValueMuted,
                      ]}
                      numberOfLines={2}
                    >
                      {shop.latitude != null
                        ? shop.shopAddress.trim() || 'Pinned on the map'
                        : 'Pin the shop on the map'}
                    </AppText>
                    <AppText style={styles.locationAction}>
                      {shop.latitude != null ? 'Change pin' : 'Open map'}
                    </AppText>
                  </View>
                </TouchableOpacity>
              </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={nextStep}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Next: licence and payout"
                >
                  <AppText style={styles.primaryBtnText}>Next</AppText>
                  <ArrowRight size={ms(18)} color={parentRamp.onBase} strokeWidth={2.4} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
            <View style={styles.sheet}>
              <AppText style={styles.sheetTitle}>Owner PAN & licence</AppText>

              <PaperField
                label="Owner PAN number"
                required
                placeholder="ABCDE1234F"
                value={form.pan}
                onChangeText={(v) => update('pan')(v.toUpperCase().slice(0, 10))}
                autoCapitalize="characters"
                maxLength={10}
              />

              <View style={styles.paperBlock}>
                <AppText style={styles.paperBlockLabel}>
                  {licence.name}
                  {licence.required ? <AppText style={styles.paperRequired}> *</AppText> : null}
                </AppText>
                <PaperField
                  label="Licence / certificate number"
                  required={licence.required}
                  placeholder={
                    shop.app === 'FOOD'
                      ? '14-digit FSSAI number'
                      : shop.app === 'PHARMA'
                        ? 'Drug licence number'
                        : 'Registration number'
                  }
                  value={licence.number}
                  onChangeText={(v) => updateLicence(shop.key, { number: v })}
                  autoCapitalize="characters"
                />
                <DocumentRow
                  label={licence.name}
                  uri={licence.uri}
                  onCapture={() => {
                    setCaptureVendorKey(shop.key);
                    setCapture(licence.capture);
                  }}
                  onRemove={() => updateLicence(shop.key, { uri: null })}
                />
              </View>
            </View>

            <View style={styles.sheet}>
              <AppText style={styles.sheetTitle}>Payout account</AppText>

              <PaperField
                label="Beneficiary name"
                required
                placeholder="As printed on the passbook"
                value={form.bankBeneficiary}
                onChangeText={update('bankBeneficiary')}
                autoCapitalize="words"
              />
              <PaperField
                label="Bank name"
                required
                placeholder="e.g. HDFC Bank"
                value={form.bankName}
                onChangeText={update('bankName')}
                autoCapitalize="words"
              />
              <PaperField
                label="Bank account number"
                required
                placeholder="Enter account number"
                value={form.bankAccountNumber}
                onChangeText={(v) => update('bankAccountNumber')(v.replace(/\D/g, '').slice(0, 20))}
                keyboardType="number-pad"
                maxLength={20}
              />
              <PaperField
                label="IFSC code"
                required
                placeholder="HDFC0001234"
                value={form.bankIfsc}
                onChangeText={update('bankIfsc')}
                autoCapitalize="characters"
                maxLength={11}
              />
              <View style={styles.paperBlock}>
                <AppText style={styles.paperBlockLabel}>
                  Bank passbook<AppText style={styles.paperRequired}> *</AppText>
                </AppText>
                <DocumentRow
                  label="Passbook page with account number and IFSC"
                  uri={passbookUri}
                  onCapture={() => setCapture('passbook')}
                  onRemove={() => setPassbookUri(null)}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                setStep(1);
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Back to business account"
            >
              <ArrowLeft size={ms(16)} color={neutral.inkMuted} strokeWidth={2.2} />
              <AppText style={styles.backBtnText}>Back to business account</AppText>
            </TouchableOpacity>
            
            </>
            )}

            {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

            {step === 2 ? (
              <TouchableOpacity
                style={[styles.primaryBtn, styles.submitBig]}
                activeOpacity={0.9}
                onPress={submit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Submit"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={parentRamp.onBase} />
                ) : (
                  <AppText style={[styles.primaryBtnText, styles.submitBigText]}>
                    Submit
                  </AppText>
                )}
              </TouchableOpacity>
            ) : null}
            {submitting ? (
              <AppText style={styles.uploadingText}>Uploading documents securely…</AppText>
            ) : null}
          </>
        )}
      </ScrollView>

      <SellerLocationPicker
        visible={pinTarget !== null}
        initial={pinInitial}
        onCancel={() => setPinTarget(null)}
        onPick={(selection) => {
          if (pinTarget) handlePin(pinTarget, selection);
        }}
      />

      <DocumentCapture
        visible={capture !== null}
        title={
          capture === 'fssai'
            ? 'FSSAI certificate'
            : capture === 'drug'
              ? 'Drug licence certificate'
              : capture === 'shop'
                ? 'Photo of your shop'
                : 'Bank passbook'
        }
        onClose={() => {
          setCapture(null);
          setCaptureVendorKey(null);
        }}
        onCaptured={(uri) => {
          if (capture === 'fssai' && captureVendorKey) {
            updateVendor(captureVendorKey, { fssaiUri: uri });
          } else if (capture === 'drug' && captureVendorKey) {
            updateVendor(captureVendorKey, { drugLicenseUri: uri });
          } else if (capture === 'shop' && captureVendorKey) {
            setVendors((prev) =>
              prev.map((v) =>
                v.key === captureVendorKey && v.shopPhotoUris.length < 5
                  ? { ...v, shopPhotoUris: [...v.shopPhotoUris, uri] }
                  : v,
              ),
            );
          } else if (capture === 'passbook') {
            setPassbookUri(uri);
          }
          setCapture(null);
          setCaptureVendorKey(null);
        }}
      />

      <DocumentCapture
        visible={docRequestCapture !== null}
        title={docRequestCapture ? DOC_REQUEST_LABELS[docRequestCapture.docType] ?? 'Document' : 'Document'}
        onClose={() => setDocRequestCapture(null)}
        onCaptured={(uri) => {
          if (docRequestCapture) void fulfillDocumentRequest(docRequestCapture, uri);
        }}
      />
    </View>
  );
}

export default SellerRegistrationScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neutral.surfaceAlt },
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: SPACE.SECTION,
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.LIST_BOTTOM,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(16),
    paddingBottom: SPACE.BLOCK,
    backgroundColor: neutral.card,
    zIndex: 10,
    shadowColor: 'black',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: ms(18), fontWeight: '900', color: neutral.ink },
  sheet: {
    backgroundColor: neutral.card,
    borderRadius: ms(18),
    paddingHorizontal: hs(16),
    paddingTop: vs(16),
    paddingBottom: vs(18),
    marginBottom: SPACE.SECTION,
  },
  sheetTitle: { fontSize: ms(19), fontWeight: '900', color: neutral.ink, letterSpacing: -0.3 },
  paperBlock: { marginTop: vs(20) },
  paperBlockLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    color: neutral.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  paperRequired: { color: neutral.inkMuted },  categoryRow: { flexDirection: 'row', gap: hs(8), marginTop: vs(10) },
  samePhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginTop: vs(10),
  },
  samePhoneText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: neutral.inkMuted,
  },
  categoryChip: {
    flex: 1,
    minHeight: vs(44),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: hs(10),
    paddingVertical: vs(8),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    backgroundColor: neutral.surfaceAlt,
  },
  categoryChipActive: { borderColor: parentRamp.base, backgroundColor: parentRamp.tint },
  categoryLabel: { fontSize: ms(13.5), fontWeight: '800', color: neutral.ink },
  categoryLabelActive: { color: parentRamp.base },
  photoRow: { flexDirection: 'row', gap: hs(10), marginTop: vs(10) },
  photoTile: {
    width: ms(96),
    height: ms(72),
    borderRadius: ms(12),
    overflow: 'hidden',
    backgroundColor: neutral.surfaceAlt,
  },
  photoTileEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: vs(4),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: neutral.border,
  },
  photoTileText: { fontSize: ms(10), fontWeight: '700', color: parentRamp.base },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: vs(4),
    right: hs(4),
    width: ms(20),
    height: ms(20),
    borderRadius: ms(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingVertical: vs(12),
    paddingHorizontal: hs(12),
    marginTop: vs(10),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    backgroundColor: neutral.surfaceAlt,
  },
  locationBody: { flex: 1 },
  locationValue: { fontSize: ms(13), fontWeight: '700', color: neutral.ink },
  locationValueMuted: { color: neutral.inkMuted, fontWeight: '600' },
  locationAction: {
    fontSize: ms(10.5),
    fontWeight: '800',
    color: parentRamp.base,
    marginTop: vs(2),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    minHeight: vs(50),
    borderRadius: ms(14),
    backgroundColor: parentRamp.base,
    marginTop: vs(24),
    paddingHorizontal: hs(16),
  },
  submitBig: {
    minHeight: vs(60),
    borderRadius: ms(16),
    marginTop: SPACE.SECTION,
  },
  primaryBtnText: {
    fontSize: ms(13.5),
    fontWeight: '900',
    color: parentRamp.onBase,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  submitBigText: {
    fontSize: ms(16),
    letterSpacing: 0.5,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    minHeight: vs(44),
    marginTop: vs(14),
  },
  backBtnText: { fontSize: ms(12), fontWeight: '700', color: neutral.inkMuted },
  phonePaperRow: { flexDirection: 'row', alignItems: 'flex-end', gap: hs(10), marginTop: vs(2) },
  phonePaperInput: { flex: 1 },
  errorText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: semantic.danger,
    marginBottom: vs(10),
    textAlign: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(8),
    height: Math.max(50, vs(50)),
    borderRadius: ms(14),
    backgroundColor: parentRamp.base,
  },
  submitText: { fontSize: ms(13), fontWeight: '800', color: parentRamp.onBase, textTransform: 'uppercase' },
  uploadingText: {
    fontSize: ms(10.5),
    color: neutral.inkMuted,
    textAlign: 'center',
    marginTop: vs(8),
  },
  statusLoading: { paddingVertical: vs(48), alignItems: 'center', justifyContent: 'center' },
  statusNoticeCard: {
    backgroundColor: semanticTint.danger,
    borderRadius: ms(14),
    padding: hs(14),
    marginBottom: SPACE.BLOCK,
  },
  statusNoticeTitle: { fontSize: ms(13), fontWeight: '800', color: semantic.danger },
  statusNoticeBody: {
    fontSize: ms(12),
    color: semantic.danger,
    lineHeight: ms(18),
    marginTop: vs(4),
  },
  docRequestCard: {
    backgroundColor: neutral.card,
    borderRadius: ms(16),
    padding: hs(16),
    marginBottom: SPACE.SECTION,
    borderWidth: 1,
    borderColor: parentRamp.base,
  },
  docRequestTitle: {
    fontSize: ms(14),
    fontWeight: '800',
    color: neutral.ink,
    lineHeight: ms(20),
  },
  docRequestNote: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    lineHeight: ms(18),
    marginTop: vs(6),
  },
  docRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: vs(46),
    borderRadius: ms(12),
    backgroundColor: parentRamp.base,
    marginTop: vs(14),
    paddingHorizontal: hs(16),
  },
  docRequestBtnText: {
    fontSize: ms(13),
    fontWeight: '900',
    color: parentRamp.onBase,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reviewCard: {
    backgroundColor: neutral.card,
    borderRadius: ms(18),
    padding: hs(18),
    alignItems: 'center',
  },
  reviewIcon: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: parentRamp.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  reviewTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    color: neutral.ink,
    textAlign: 'center',
  },
  reviewBody: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    textAlign: 'center',
    lineHeight: ms(18),
    marginTop: vs(6),
    marginBottom: SPACE.SECTION,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: vs(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: neutral.border,
  },
  reviewMetaKey: { fontSize: ms(12), fontWeight: '700', color: neutral.inkSubtle },
  reviewMetaValue: { fontSize: ms(13), fontWeight: '800', color: neutral.ink },
  reviewDone: { alignSelf: 'stretch', marginTop: SPACE.SECTION },
  activeCard: {
    backgroundColor: neutral.card,
    borderRadius: ms(18),
    padding: hs(18),
    alignItems: 'center',
  },
  activeIcon: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: semanticTint.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  activeTitle: {
    fontSize: ms(16),
    fontWeight: '900',
    color: neutral.ink,
    textAlign: 'center',
  },
  activeBody: {
    fontSize: ms(12),
    color: neutral.inkMuted,
    textAlign: 'center',
    lineHeight: ms(18),
    marginTop: vs(6),
    marginBottom: SPACE.SECTION,
  },
  downloadBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    height: Math.max(48, vs(48)),
    borderRadius: ms(14),
    backgroundColor: parentRamp.base,
  },
  downloadBtnText: {
    fontSize: ms(13),
    fontWeight: '800',
    color: parentRamp.onBase,
    textTransform: 'uppercase',
  },
  iosNote: {
    fontSize: ms(11),
    color: neutral.inkMuted,
    textAlign: 'center',
    lineHeight: ms(16),
  },
});
