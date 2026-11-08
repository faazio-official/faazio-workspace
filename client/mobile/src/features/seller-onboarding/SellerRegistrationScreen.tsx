import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BadgeCheck,
  ChevronLeft,
  FileCheck2,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Store,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { CountryCodePicker } from '@/components/CountryCodePicker';
import { DEFAULT_COUNTRY, isValidPhone, toE164 } from '@/lib/phone';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { SELLER_SETUP_FIELDS } from '@data/index';
import type { DistrictInfo } from '@data/districts';
import {
  GatewayHttpError,
  gateway,
  type GeoState,
  type SellerApplication,
} from '@/services/api/GatewayClient';
import { firebaseAuthConfigured, sendSellerOtp, verifySellerOtp } from '@/services/firebaseAuth';
import { useSmsUserConsent } from '@/lib/smsUserConsent';
import { useAuthStore } from '@/state/authStore';
import type { RootStackParamList } from '@/navigation/types';
import DocumentCapture from './DocumentCapture';
import SellerLocationPicker from './SellerLocationPicker';
import { neutral, parentRamp, semantic, semanticTint } from '@/theme/brandTokens';
import ShopCard, { newVendorDraft, type VendorDraft } from './components/ShopCard';
import { DocumentRow, TextInputField } from './components/FormControls';

type Props = NativeStackScreenProps<RootStackParamList, 'SellWithUs'>;

/** Label/placeholder sourced from the stable @data contract (keeps the fixture meaningful). */
const setup = (key: string) => SELLER_SETUP_FIELDS.find((f) => f.key === key);

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
        return 'Phone verification is required. Please verify your number again and resubmit.';
      case 'unknown_district':
        return 'That district isn’t recognised. Re-pin your shop on the map and try again.';
      case 'sellers_unavailable':
      case 'seller_create_failed':
      case 'seller_update_failed':
        return 'The server couldn’t save your application. Please try again in a moment.';
      case 'bad_request':
        return err.message || 'Some details are invalid. Please review the form and try again.';
      default:
        return err.message || `Could not submit right now (error ${err.status}). Please try again.`;
    }
  }
  return 'Could not submit right now. Please try again.';
}

interface FormState {
  businessName: string;
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
 * Fold a place name/address for tolerant matching: case, accents, punctuation and the `(UT)`
 * suffix are removed, and the common `Pondicherry` spelling maps onto `Puducherry`.
 */
const foldGeo = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .replace(/pondicherry/g, 'puducherry');

function matchGeo(
  address: string,
  states: GeoState[],
  districts: DistrictInfo[],
): { stateCode: string; districtCode: string } | null {
  const haystack = foldGeo(address);
  if (!haystack) return null;
  const state = states.find((s) => {
    const name = foldGeo(s.name);
    return name.length > 0 && haystack.includes(name);
  });
  if (!state) return null;
  const district = districts.find((d) => {
    const name = foldGeo(d.name);
    return d.stateCode === state.stateCode && name.length > 0 && haystack.includes(name);
  });
  return { stateCode: state.stateCode, districtCode: district?.districtCode ?? '' };
}

/**
 * Account state/district come from the pinned shops. Prefer the first shop whose state is in the
 * district master (TN/PY today), so a covered shop always wins over one outside coverage; fall back
 * to the first matched shop when the district master has not loaded yet. The same shop supplies the
 * account-level coordinates, keeping `sellers.sellers`' pin and `stateCode` consistent.
 */
function deriveAccountGeo(
  vendors: VendorDraft[],
  states: GeoState[],
  districts: DistrictInfo[],
): { stateCode: string; districtCode: string; latitude: number; longitude: number } | null {
  const matches: {
    stateCode: string;
    districtCode: string;
    latitude: number;
    longitude: number;
  }[] = [];
  for (const shop of vendors) {
    if (shop.latitude == null || shop.longitude == null) continue;
    const geo = matchGeo(shop.pinnedAddress, states, districts);
    if (!geo) continue;
    matches.push({ ...geo, latitude: shop.latitude, longitude: shop.longitude });
  }
  if (matches.length === 0) return null;
  if (districts.length > 0) {
    return matches.find((m) => districts.some((d) => d.stateCode === m.stateCode)) ?? null;
  }
  return matches[0];
}

/**
 * Full seller registration in two parts:
 *   Part 1 — the brand-agnostic account (identity, KYC passbook, payout bank, OTP signature).
 *   Part 2 — one or more shops (vendors), each with its own app/category/fee, documents, optional
 *            bank override and map pin.
 *
 * There are no manual state/district dropdowns: the account state/district are derived from the
 * first shop pin (reverse-geocoded region/district matched against `GET /geo/states` and
 * `GET /geo/districts`). GSTIN is optional; PAN remains required.
 */
export function SellerRegistrationScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const authPhone = user?.phone ?? '';
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY);

  const [form, setForm] = useState<FormState>({
    businessName: '',
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
  const [capture, setCapture] = useState<'passbook' | 'fssai' | 'drug' | null>(null);
  const [captureVendorKey, setCaptureVendorKey] = useState<string | null>(null);
  const [pinTarget, setPinTarget] = useState<string | null>(null);

  const [states, setStates] = useState<GeoState[]>([]);
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);

  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpError, setOtpError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SellerApplication | null>(null);
  const [otpVerifiedAt, setOtpVerifiedAt] = useState('');
  // Cross-session status read: `loadingStatus` holds the form back until GET /sellers/me settles so
  // an existing PENDING/ACTIVE applicant never flashes the onboarding form.
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submittedApps, setSubmittedApps] = useState<string[]>([]);

  // Guards a category request per shop so a slower earlier app request cannot overwrite a newer one.
  const categoryReq = useRef<Record<string, number>>({});
  const sendRef = useRef(false);
  const submitRef = useRef(false);
  const autoSubmittedRef = useRef<string | null>(null);
  const consentArmedRef = useRef(false);
  const statusCheckedRef = useRef(false);

  const update = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const otpPhone = authPhone || form.contactPhone;
  // The number actually dialled/verified: E.164 for the selected country. Never truncate to the
  // last 10 digits — that silently mangles non-Indian numbers.
  const phoneE164 = useMemo(() => toE164(otpPhone, phoneCountry), [otpPhone, phoneCountry]);
  const phoneValid = useMemo(() => isValidPhone(otpPhone, phoneCountry), [otpPhone, phoneCountry]);
  // Snapshot for async guards: a phone edit mid-request must not mark the new number verified.
  const phoneE164Ref = useRef(phoneE164);
  useEffect(() => {
    phoneE164Ref.current = phoneE164;
  }, [phoneE164]);

  // Editing the phone (or its country) invalidates any OTP already sent/verified.
  const resetSignature = () => {
    setOtpCode('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpVerifiedAt('');
    setCountdown(0);
    setOtpError('');
    autoSubmittedRef.current = null;
    consentArmedRef.current = false;
    stopSmsConsent();
  };

  const updateContactPhone = (value: string) => {
    // The field is locked while a send/verify is in flight; ignore any programmatic edit as well so
    // an in-flight request can never sign a number the user just replaced.
    if (sendRef.current || submitRef.current) return;
    phoneE164Ref.current = toE164(value, phoneCountry);
    setForm((prev) => ({ ...prev, contactPhone: value }));
    resetSignature();
  };

  const changePhoneCountry = (code: string) => {
    if (sendRef.current || submitRef.current || code === phoneCountry) return;
    phoneE164Ref.current = toE164(form.contactPhone, code);
    setPhoneCountry(code);
    resetSignature();
  };

  const handleSmsCode = useCallback((code: string) => {
    if (!consentArmedRef.current || submitRef.current) return;
    // Defense in depth: the hook and native module already validate, but the single state binding
    // must never receive anything except six digits (a chip/paste must fully overwrite a typo).
    const digits = code.replace(/\D/g, '').slice(0, 6);
    if (digits.length !== 6) return;
    setOtpError('');
    setOtpCode(digits);
  }, []);

  const { restart: restartSmsConsent, stop: stopSmsConsent } = useSmsUserConsent(
    handleSmsCode,
    otpSent && !otpVerified,
  );

  const updateVendor = (key: string, patch: Partial<VendorDraft>) =>
    setVendors((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  // Superadmin-owned category taxonomy for one shop's app (GET /categories?app=). Server-only — no
  // fixture list. A failure leaves the picker empty so the seller can retry by re-selecting the app.
  function loadCategoriesFor(key: string, app: VendorDraft['app']) {
    const requestId = (categoryReq.current[key] ?? 0) + 1;
    categoryReq.current[key] = requestId;
    const isCurrent = () => categoryReq.current[key] === requestId;
    updateVendor(key, { categoriesLoading: true, categories: [] });
    gateway
      .fetchCategories(app)
      .then((rows) => {
        if (!isCurrent()) return;
        updateVendor(key, { categories: rows.filter((c) => c.parentId === null && c.isActive) });
      })
      .catch(() => {
        if (isCurrent()) updateVendor(key, { categories: [] });
      })
      .finally(() => {
        if (isCurrent()) updateVendor(key, { categoriesLoading: false });
      });
  }

  const changeVendorApp = (key: string, app: VendorDraft['app']) => {
    updateVendor(key, {
      app,
      categoryId: null,
      fssaiNumber: '',
      fssaiUri: null,
      drugLicenseNumber: '',
      drugLicenseUri: null,
    });
    loadCategoriesFor(key, app);
  };

  const addVendor = () => {
    const draft = newVendorDraft();
    setVendors((prev) => [...prev, draft]);
    loadCategoriesFor(draft.key, 'MART');
  };

  const removeVendor = (key: string) =>
    setVendors((prev) => (prev.length > 1 ? prev.filter((v) => v.key !== key) : prev));

  // Region/district come from the picker's formatted address (reverse geocode joins name, street,
  // district, city, region). The account state/district/coordinates are derived from the shops so
  // removing or re-pinning a shop cannot leave them stale.
  const accountGeo = useMemo(
    () => deriveAccountGeo(vendors, states, districts),
    [vendors, states, districts],
  );

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
    const first = vendors[0];
    if (first) loadCategoriesFor(first.key, first.app);
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
        if (alive) setResult(app);
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

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendSignatureOtp = async () => {
    // A resend must never overlap an in-flight verify or another send: Firebase replaces `pending`
    // per send, so an overlapping verify would resolve against the wrong request.
    if (sendRef.current || submitRef.current) return;
    setOtpError('');
    if (!phoneValid || !phoneE164) {
      setOtpError('Enter a valid contact phone number for the selected country.');
      return;
    }
    if (!firebaseAuthConfigured()) {
      setOtpError('OTP verification is not available in this build.');
      return;
    }
    const targetPhone = phoneE164;
    const wasSent = otpSent;
    sendRef.current = true;
    autoSubmittedRef.current = null;
    setOtpBusy(true);
    setOtpCode('');
    setOtpVerified(false);
    setOtpVerifiedAt('');
    // The User Consent API only observes SMS received after it starts — arm before the send.
    consentArmedRef.current = true;
    restartSmsConsent();
    try {
      await sendSellerOtp(targetPhone);
      if (phoneE164Ref.current !== targetPhone) {
        consentArmedRef.current = false;
        stopSmsConsent();
        return;
      }
      setOtpSent(true);
      setCountdown(60);
    } catch {
      consentArmedRef.current = false;
      stopSmsConsent();
      if (phoneE164Ref.current === targetPhone) {
        // A failed resend has already dropped the previous pending confirmation inside
        // firebaseAuth, so keeping the UI in "Verify" mode would only produce misleading errors.
        if (wasSent) {
          setOtpSent(false);
          setCountdown(0);
          setOtpCode('');
        }
        setOtpError('Could not send the OTP. Please try again.');
      }
    } finally {
      sendRef.current = false;
      setOtpBusy(false);
    }
  };

  const confirmSignatureOtp = useCallback(async () => {
    if (submitRef.current || sendRef.current) return;
    setOtpError('');
    if (!otpSent || otpCode.trim().length !== 6) {
      setOtpError('Enter the 6-digit code.');
      return;
    }
    const targetPhone = phoneE164;
    const code = otpCode.trim();
    submitRef.current = true;
    setOtpBusy(true);
    try {
      await verifySellerOtp(targetPhone, code);
      if (phoneE164Ref.current !== targetPhone) return;
      // The OTP is the digital signature; the shopper's primary Firebase session is untouched.
      consentArmedRef.current = false;
      setOtpVerified(true);
      setOtpVerifiedAt(new Date().toLocaleTimeString());
      setCountdown(0);
    } catch {
      if (phoneE164Ref.current === targetPhone) {
        setOtpError('That code is incorrect or expired. Request a new one.');
      }
    } finally {
      submitRef.current = false;
      setOtpBusy(false);
    }
  }, [otpCode, otpSent, phoneE164]);

  // Submission derives from state, not the 6th keystroke: this fires however the code arrived
  // (typing, paste, or Android SMS User Consent). A failed verify keeps the dedup value so it is
  // not retried in a loop; the visible Verify button remains available.
  useEffect(() => {
    if (otpCode.length !== 6) autoSubmittedRef.current = null;
    if (!otpSent || otpVerified || otpBusy || otpCode.length !== 6) return;
    if (autoSubmittedRef.current === otpCode) return;
    autoSubmittedRef.current = otpCode;
    void confirmSignatureOtp();
  }, [confirmSignatureOtp, otpCode, otpSent, otpVerified, otpBusy]);

  const validate = (): string | null => {
    const required: [keyof FormState, string][] = [
      ['businessName', 'business name'],
      ['ownerName', 'owner name'],
      ['pan', 'PAN'],
      ['businessAddress', 'business address'],
      ['contactPhone', 'contact phone'],
      ['contactEmail', 'contact email'],
      ['bankName', 'bank name'],
      ['bankAccountNumber', 'bank account number'],
      ['bankIfsc', 'IFSC'],
      ['bankBeneficiary', 'beneficiary name'],
    ];
    const missing = required.filter(([k]) => !form[k].trim()).map(([, label]) => label);
    if (missing.length > 0) return `Please fill in: ${missing.join(', ')}.`;
    if (!phoneValid) return 'Enter a valid contact phone number for the selected country.';
    if (!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) return 'Enter a valid contact email.';
    const accountDigits = form.bankAccountNumber.replace(/\D/g, '');
    if (accountDigits.length < 6 || accountDigits.length > 20) {
      return 'Enter a valid bank account number.';
    }
    if (form.bankIfsc.trim().length !== 11) return 'IFSC must be 11 characters.';
    if (!passbookUri) return 'Capture your bank passbook photo.';
    if (!otpVerified) return 'Verify the OTP to sign your application.';
    if (vendors.length === 0) return 'Add at least one shop.';
    if (!/^[A-Z]{2}$/.test(form.stateCode.trim().toUpperCase())) {
      return 'Pin at least one shop on the map in Tamil Nadu / Puducherry so the state and district can be set.';
    }
    if (!vendors.some((v) => v.latitude != null && v.longitude != null)) {
      return 'Pin at least one shop on the map in Tamil Nadu / Puducherry so the state and district can be set.';
    }

    for (const v of vendors) {
      const label = v.shopName.trim() || 'every shop';
      if (!v.shopName.trim()) return 'Give every shop a name.';
      if (!v.shopAddress.trim()) return `Enter the address for ${label}.`;
      if (!v.categoryId) {
        return v.categories.length === 0
          ? 'Categories are unavailable right now. Reconnect and try again.'
          : `Select a category for ${label}.`;
      }
      const pct = Number(v.platformFee);
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
        return `Platform fee for ${label} must be between 1 and 100.`;
      }
      if (v.app === 'FOOD' && pct < 5) {
        return `${label} is a food shop: its platform fee must be at least 5%.`;
      }
      if (v.app === 'FOOD' && (v.fssaiNumber.trim() === '') !== (v.fssaiUri === null)) {
        return `For ${label}, provide both the FSSAI number and certificate, or neither.`;
      }
      if (
        v.app === 'PHARMA' &&
        (v.drugLicenseNumber.trim() === '') !== (v.drugLicenseUri === null)
      ) {
        return `For ${label}, provide both the drug licence number and certificate, or neither.`;
      }
      if (!v.sameAsAccountBank) {
        const shopBank = [
          v.bankName,
          v.bankAccountNumber,
          v.bankIfsc,
          v.bankBeneficiary,
        ].map((field) => field.trim());
        if (shopBank.some(Boolean)) {
          if (shopBank.some((field) => !field)) {
            return `For ${label}, fill all shop bank fields or leave them blank.`;
          }
          const digits = v.bankAccountNumber.replace(/\D/g, '');
          if (digits.length < 6 || digits.length > 20) {
            return `Enter a valid bank account number for ${label}.`;
          }
          if (v.bankIfsc.trim().length !== 11) {
            return `IFSC for ${label} must be 11 characters.`;
          }
        }
      }
    }
    return null;
  };

  const submit = async () => {
    if (submitting) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    const ownerId = user?.id ? `seller-${user.id}` : 'seller-pending';
    try {
      const passbook = await gateway.uploadSellerDocument(passbookUri!, ownerId);
      const vendorPayload = await Promise.all(
        vendors.map(async (v) => {
          let fssai: { key: string; assetId: string } | undefined;
          if (v.app === 'FOOD' && v.fssaiUri) {
            fssai = await gateway.uploadSellerDocument(v.fssaiUri, ownerId);
          }
          let drug: { key: string; assetId: string } | undefined;
          if (v.app === 'PHARMA' && v.drugLicenseUri) {
            drug = await gateway.uploadSellerDocument(v.drugLicenseUri, ownerId);
          }
          const useShopBank =
            !v.sameAsAccountBank &&
            [v.bankName, v.bankAccountNumber, v.bankIfsc, v.bankBeneficiary].some((field) =>
              field.trim(),
            );
          return {
            name: v.shopName.trim(),
            app: v.app,
            categoryId: v.categoryId ?? undefined,
            platformFeePct: Number(v.platformFee),
            address: v.shopAddress.trim() || undefined,
            latitude: v.latitude,
            longitude: v.longitude,
            fssaiNumber: v.app === 'FOOD' ? v.fssaiNumber.trim() || undefined : undefined,
            fssaiFileKey: fssai?.key,
            fssaiAssetId: fssai?.assetId,
            drugLicenseNumber:
              v.app === 'PHARMA' ? v.drugLicenseNumber.trim() || undefined : undefined,
            drugLicenseFileKey: drug?.key,
            drugLicenseAssetId: drug?.assetId,
            bankName: useShopBank ? v.bankName.trim() : undefined,
            bankAccountNumber: useShopBank
              ? v.bankAccountNumber.replace(/\D/g, '')
              : undefined,
            bankIfsc: useShopBank ? v.bankIfsc.trim().toUpperCase() : undefined,
            bankBeneficiary: useShopBank ? v.bankBeneficiary.trim() : undefined,
          };
        }),
      );
      const res = await gateway.submitSellerApplication({
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        gstin: form.gstin.trim().toUpperCase(),
        pan: form.pan.trim().toUpperCase(),
        businessAddress: form.businessAddress.trim(),
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
        otpVerified: true,
      });
      setResult(res);
      setSubmittedApps(vendorPayload.map((v) => v.app).filter(Boolean));
    } catch (err) {
      setError(describeSubmitError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    otpVerified &&
    Boolean(passbookUri) &&
    /^[A-Z]{2}$/.test(form.stateCode.trim().toUpperCase()) &&
    vendors.length > 0 &&
    vendors.some((v) => v.latitude != null && v.longitude != null) &&
    vendors.every(
      (v) => Boolean(v.shopName.trim()) && Boolean(v.shopAddress.trim()) && Boolean(v.categoryId),
    );

  const stateName = states.find((s) => s.stateCode === form.stateCode)?.name;
  const districtName = districts.find((d) => d.districtCode === form.districtCode)?.name;
  const geoLabel = form.stateCode
    ? [stateName ?? form.stateCode, districtName].filter(Boolean).join(' · ')
    : '';

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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {!loadingStatus && !isUnderReview && !isActiveSeller ? (
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Store size={ms(22)} color={parentRamp.base} strokeWidth={2.2} />
            </View>
            <AppText style={styles.heroTitle}>Partner with Faazio</AppText>
            <AppText style={styles.heroSub}>
              Complete your business account first, then add every shop you run. A district admin
              reviews the application before your shops go live.
            </AppText>
          </View>
        ) : null}

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
            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <AppText style={styles.stepBadgeText}>1</AppText>
              </View>
              <AppText style={styles.stepTitle}>Business account</AppText>
            </View>

            <View style={styles.sectionCard}>
              <AppText style={styles.sectionTitle}>Business identity</AppText>
              <AppText style={styles.sectionNote}>
                The account that owns your shops. PAN is required; GSTIN is optional.
              </AppText>

              <TextInputField
                label={setup('businessName')?.label ?? 'Business name'}
                placeholder={setup('businessName')?.placeholder ?? 'e.g. Sharma Traders'}
                value={form.businessName}
                onChangeText={update('businessName')}
              />
              <TextInputField
                label={setup('ownerName')?.label ?? 'Owner / contact name'}
                placeholder={setup('ownerName')?.placeholder ?? 'Full name'}
                value={form.ownerName}
                onChangeText={update('ownerName')}
              />
              <TextInputField
                label={`${setup('gstin')?.label ?? 'GSTIN'} (optional)`}
                placeholder={setup('gstin')?.placeholder ?? '22ABCDE1234F1Z5'}
                value={form.gstin}
                onChangeText={update('gstin')}
                autoCapitalize="characters"
              />
              <TextInputField
                label={setup('pan')?.label ?? 'PAN'}
                placeholder={setup('pan')?.placeholder ?? 'ABCDE1234F'}
                value={form.pan}
                onChangeText={update('pan')}
                autoCapitalize="characters"
              />
              <TextInputField
                label={setup('businessAddress')?.label ?? 'Business address'}
                placeholder={setup('businessAddress')?.placeholder ?? 'Full address'}
                value={form.businessAddress}
                onChangeText={update('businessAddress')}
              />
              {authPhone ? (
                <TextInputField
                  label={setup('contactPhone')?.label ?? 'Contact phone'}
                  placeholder={setup('contactPhone')?.placeholder ?? '+91 00000 00000'}
                  value={form.contactPhone}
                  keyboardType="phone-pad"
                  editable={false}
                />
              ) : (
                <View style={styles.phoneRow}>
                  <CountryCodePicker
                    value={phoneCountry}
                    onChange={changePhoneCountry}
                    disabled={otpBusy}
                  />
                  <View style={styles.phoneInputWrap}>
                    <TextInputField
                      label={setup('contactPhone')?.label ?? 'Contact phone'}
                      placeholder={setup('contactPhone')?.placeholder ?? '+91 00000 00000'}
                      value={form.contactPhone}
                      onChangeText={updateContactPhone}
                      keyboardType="phone-pad"
                      editable={!otpBusy}
                    />
                  </View>
                </View>
              )}
              <TextInputField
                label={setup('contactEmail')?.label ?? 'Contact email'}
                placeholder={setup('contactEmail')?.placeholder ?? 'owner@business.com'}
                value={form.contactEmail}
                onChangeText={update('contactEmail')}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.sectionCard}>
              <AppText style={styles.sectionTitle}>KYC documents</AppText>
              <AppText style={styles.sectionNote}>
                Images are uploaded to a private bucket and shown only to you and the review team.
                Your state and district are set from the first shop pin in Part 2.
              </AppText>
              <DocumentRow
                label="Bank passbook"
                uri={passbookUri}
                onCapture={() => setCapture('passbook')}
                onRemove={() => setPassbookUri(null)}
              />
            </View>

            <View style={styles.sectionCard}>
              <AppText style={styles.sectionTitle}>Payout account</AppText>
              <AppText style={styles.sectionNote}>
                The default account for every shop. A shop can override it in Part 2. The full
                account number is sent to Razorpay and never stored by Faazio.
              </AppText>
              <TextInputField
                label={setup('bankName')?.label ?? 'Bank name'}
                placeholder={setup('bankName')?.placeholder ?? 'e.g. HDFC Bank'}
                value={form.bankName}
                onChangeText={update('bankName')}
              />
              <TextInputField
                label={setup('bankAccount')?.label ?? 'Account number'}
                placeholder={setup('bankAccount')?.placeholder ?? 'Enter account number'}
                value={form.bankAccountNumber}
                onChangeText={update('bankAccountNumber')}
                keyboardType="number-pad"
              />
              <TextInputField
                label={setup('ifsc')?.label ?? 'IFSC'}
                placeholder={setup('ifsc')?.placeholder ?? 'HDFC0001234'}
                value={form.bankIfsc}
                onChangeText={update('bankIfsc')}
                autoCapitalize="characters"
                maxLength={11}
              />
              <TextInputField
                label={setup('bankBeneficiary')?.label ?? 'Beneficiary name'}
                placeholder={setup('bankBeneficiary')?.placeholder ?? 'As printed on the passbook'}
                value={form.bankBeneficiary}
                onChangeText={update('bankBeneficiary')}
              />
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <AppText style={styles.sectionTitle}>Digital signature</AppText>
                {otpVerified ? (
                  <View style={styles.verifiedPill}>
                    <ShieldCheck size={ms(12)} color={semantic.success} strokeWidth={2.4} />
                    <AppText style={styles.verifiedText}>Verified</AppText>
                  </View>
                ) : null}
              </View>
              <AppText style={styles.sectionNote}>
                We send a one-time code to {otpPhone || 'your registered phone'}. Verifying it signs
                the application.
              </AppText>

              {!otpVerified ? (
                <>
                  <View style={styles.otpRow}>
                    <AppTextInput
                      style={[styles.input, styles.otpInput]}
                      placeholder="6-digit OTP"
                      placeholderTextColor={neutral.inkSubtle}
                      value={otpCode}
                      onChangeText={(v) => {
                        setOtpError('');
                        setOtpCode(v.replace(/\D/g, '').slice(0, 6));
                      }}
                      keyboardType="number-pad"
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      maxLength={6}
                      editable={!otpBusy}
                    />
                    <TouchableOpacity
                      style={[
                        styles.otpButton,
                        (otpBusy || (otpSent ? otpCode.length !== 6 : !phoneValid)) &&
                          styles.otpButtonDisabled,
                      ]}
                      onPress={otpSent ? confirmSignatureOtp : sendSignatureOtp}
                      disabled={otpBusy || (otpSent ? otpCode.length !== 6 : !phoneValid)}
                      activeOpacity={0.85}
                    >
                      {otpBusy ? (
                        <ActivityIndicator size="small" color={parentRamp.onBase} />
                      ) : (
                        <AppText style={styles.otpButtonText}>
                          {otpSent ? 'Verify' : 'Send OTP'}
                        </AppText>
                      )}
                    </TouchableOpacity>
                  </View>
                  {otpSent ? (
                    <TouchableOpacity
                      onPress={sendSignatureOtp}
                      disabled={countdown > 0 || otpBusy}
                      activeOpacity={0.7}
                    >
                      <AppText style={[styles.linkText, countdown > 0 && styles.linkTextMuted]}>
                        {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                      </AppText>
                    </TouchableOpacity>
                  ) : null}
                  {otpError ? <AppText style={styles.helperError}>{otpError}</AppText> : null}
                </>
              ) : (
                <View style={styles.signedBox}>
                  <FileCheck2 size={ms(18)} color={semantic.success} strokeWidth={2.2} />
                  <AppText style={styles.signedText}>
                    OTP verified at {otpVerifiedAt || 'this session'}. This is your digital
                    signature.
                  </AppText>
                </View>
              )}
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <AppText style={styles.stepBadgeText}>2</AppText>
              </View>
              <AppText style={styles.stepTitle}>Your shops</AppText>
            </View>

            <View style={styles.sectionCard}>
              <AppText style={styles.sectionNote}>
                Add every shop you run. Each shop picks its own app, category, platform fee,
                documents, optional bank account and map pin.
              </AppText>

              {vendors.map((vendor, index) => (
                <ShopCard
                  key={vendor.key}
                  vendor={vendor}
                  index={index}
                  canRemove={vendors.length > 1}
                  onRemove={() => removeVendor(vendor.key)}
                  onChange={(patch) => updateVendor(vendor.key, patch)}
                  onAppChange={(app) => changeVendorApp(vendor.key, app)}
                  onPinLocation={() => setPinTarget(vendor.key)}
                  onCaptureDoc={(kind) => {
                    setCaptureVendorKey(vendor.key);
                    setCapture(kind);
                  }}
                  onAddAnother={addVendor}
                />
              ))}

              <TouchableOpacity
                style={styles.addShopBtn}
                onPress={addVendor}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Plus size={ms(16)} color={parentRamp.base} strokeWidth={2.2} />
                <AppText style={styles.addShopText}>Add another shop</AppText>
              </TouchableOpacity>

              <View style={styles.geoNote}>
                <AppText style={styles.geoNoteText}>
                  {geoLabel
                    ? `State & district set from your pinned shop: ${geoLabel}.`
                    : 'Pin at least one shop on the map so your state and district can be set.'}
                </AppText>
              </View>
            </View>

            {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              activeOpacity={0.85}
              onPress={submit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={parentRamp.onBase} />
              ) : (
                <>
                  <Lock size={ms(16)} color={parentRamp.onBase} strokeWidth={2.2} />
                  <AppText style={styles.submitText}>
                    {canSubmit ? 'Submit for review' : 'Complete OTP and documents'}
                  </AppText>
                </>
              )}
            </TouchableOpacity>
            {submitting ? (
              <AppText style={styles.uploadingText}>Uploading documents securely…</AppText>
            ) : null}

            <View style={styles.secureNote}>
              <Mail size={ms(12)} color={neutral.inkSubtle} strokeWidth={2.2} />
              <AppText style={styles.secureNoteText}>
                Your bank details are sent over an authenticated connection. KYC images live in a
                private bucket; secrets and OTPs are never logged.
              </AppText>
            </View>
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
          } else if (capture === 'passbook') {
            setPassbookUri(uri);
          }
          setCapture(null);
          setCaptureVendorKey(null);
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
  heroCard: {
    backgroundColor: parentRamp.base,
    borderRadius: ms(20),
    padding: hs(18),
    marginBottom: SPACE.SECTION,
  },
  heroIcon: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(12),
    backgroundColor: neutral.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  heroTitle: { fontSize: ms(18), fontWeight: '900', color: parentRamp.onBase },
  heroSub: { fontSize: ms(12), color: parentRamp.tint, lineHeight: ms(18), marginTop: vs(6) },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: SPACE.BLOCK,
    marginTop: vs(2),
  },
  stepBadge: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    backgroundColor: parentRamp.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { fontSize: ms(12), fontWeight: '900', color: parentRamp.base },
  stepTitle: {
    fontSize: ms(13),
    fontWeight: '900',
    color: neutral.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionCard: {
    backgroundColor: neutral.card,
    borderRadius: ms(18),
    padding: hs(16),
    marginBottom: SPACE.SECTION,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: neutral.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionNote: {
    fontSize: ms(11),
    color: neutral.inkSubtle,
    marginTop: vs(2),
    marginBottom: SPACE.BLOCK,
    lineHeight: ms(16),
  },
  input: {
    height: Math.max(46, vs(46)),
    backgroundColor: neutral.surface,
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: neutral.border,
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    fontWeight: '600',
    color: neutral.ink,
  },
  helperError: { fontSize: ms(11), color: semantic.danger, fontWeight: '700', marginTop: vs(8) },
  linkText: { fontSize: ms(11), fontWeight: '800', color: parentRamp.base, marginTop: vs(8) },
  linkTextMuted: { color: neutral.inkSubtle },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(20),
    backgroundColor: semanticTint.success,
  },
  verifiedText: { fontSize: ms(10), fontWeight: '800', color: semantic.success },
  otpRow: { flexDirection: 'row', gap: hs(8), alignItems: 'center' },
  otpInput: { flex: 1 },
  otpButton: {
    height: Math.max(46, vs(46)),
    minWidth: hs(96),
    borderRadius: ms(12),
    backgroundColor: parentRamp.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpButtonDisabled: { opacity: 0.6 },
  otpButtonText: { fontSize: ms(12), fontWeight: '800', color: parentRamp.onBase, textTransform: 'uppercase' },
  signedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    padding: hs(12),
    borderRadius: ms(12),
    backgroundColor: semanticTint.success,
  },
  signedText: { flex: 1, fontSize: ms(11), color: semantic.success, lineHeight: ms(16), fontWeight: '600' },
  addShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    height: Math.max(46, vs(46)),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: parentRamp.tint,
    borderStyle: 'dashed',
    backgroundColor: neutral.surface,
  },
  addShopText: { fontSize: ms(12), fontWeight: '800', color: parentRamp.base },
  geoNote: {
    marginTop: SPACE.BLOCK,
    padding: hs(10),
    borderRadius: ms(10),
    backgroundColor: parentRamp.tint,
  },
  geoNoteText: { fontSize: ms(10.5), fontWeight: '600', color: parentRamp.deep, lineHeight: ms(15) },
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
  submitBtnDisabled: { opacity: 0.55 },
  submitText: { fontSize: ms(13), fontWeight: '800', color: parentRamp.onBase, textTransform: 'uppercase' },
  uploadingText: {
    fontSize: ms(10.5),
    color: neutral.inkMuted,
    textAlign: 'center',
    marginTop: vs(8),
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: vs(14),
    paddingHorizontal: hs(8),
    gap: hs(6),
  },
  secureNoteText: { fontSize: ms(10.5), color: neutral.inkSubtle, lineHeight: ms(15), flex: 1 },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: hs(8) },
  phoneInputWrap: { flex: 1 },
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
