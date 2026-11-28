import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppBrand } from '@data/types';
import type { VendorDraft } from './components/ShopCard';

/**
 * Local, device-only draft of the "Sell with us" onboarding form. The screen autosaves on every
 * change (no separate Save button) and restores the draft on the next open, so a half-filled
 * application survives leaving the screen, backgrounding or an app restart.
 *
 * Scope and honesty:
 * - A key is per signed-in account (`user?.id`, else `anon`) so one account's draft never leaks into
 *   another's form on a shared device.
 * - The OTP signature is deliberately NOT stored: it is a live Firebase confirmation, so the phone
 *   must be re-verified on a fresh open. The phone number itself is kept.
 * - Captured image URIs point at the app's local cache (Vision Camera `takePhoto`). They usually
 *   survive restarts but the OS may purge them; a missing file simply makes that field need a
 *   re-capture at submit time. We never upload or copy KYC bytes to persist a draft.
 * - This is the user's own data on their own device; nothing here is sent to the gateway.
 */

const VERSION = 1;

/** One shop, reduced to persisted fields (server-fetched `categories` are re-loaded on restore). */
export interface DraftVendor {
  key: string;
  app: AppBrand;
  shopName: string;
  shopPhone: string;
  sameAsOwnerPhone: boolean;
  shopAddress: string;
  platformFee: string;
  categoryId: string | null;
  fssaiNumber: string;
  fssaiUri: string | null;
  drugLicenseNumber: string;
  drugLicenseUri: string | null;
  shopPhotoUris: string[];
  sameAsAccountBank: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBeneficiary: string;
  latitude?: number;
  longitude?: number;
  pinnedAddress: string;
}

export interface DraftForm {
  ownerName: string;
  gstin: string;
  pan: string;
  businessAddress: string;
  contactPhone: string;
  contactEmail: string;
  stateCode: string;
  districtCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBeneficiary: string;
}

export interface SellerDraft {
  version: number;
  updatedAt: number;
  phoneCountry: string;
  form: DraftForm;
  vendors: DraftVendor[];
  passbookUri: string | null;
  tierCode: string | null;
}

function keyFor(userKey: string): string {
  return `faazio:seller-onboarding:draft:v${VERSION}:${userKey || 'anon'}`;
}

function toDraftVendor(v: VendorDraft): DraftVendor {
  return {
    key: v.key,
    app: v.app,
    shopName: v.shopName,
    shopPhone: v.shopPhone,
    sameAsOwnerPhone: v.sameAsOwnerPhone,
    shopAddress: v.shopAddress,
    platformFee: v.platformFee,
    categoryId: v.categoryId,
    fssaiNumber: v.fssaiNumber,
    fssaiUri: v.fssaiUri,
    drugLicenseNumber: v.drugLicenseNumber,
    drugLicenseUri: v.drugLicenseUri,
    shopPhotoUris: v.shopPhotoUris,
    sameAsAccountBank: v.sameAsAccountBank,
    bankName: v.bankName,
    bankAccountNumber: v.bankAccountNumber,
    bankIfsc: v.bankIfsc,
    bankBeneficiary: v.bankBeneficiary,
    latitude: v.latitude,
    longitude: v.longitude,
    pinnedAddress: v.pinnedAddress,
  };
}

/** Rebuild a full `VendorDraft` from a stored one; the category list is fetched again on restore.
 * Every field is coerced so a partially-written/corrupt blob can never yield `undefined` strings
 * (which would crash `.trim()` in validation or render an empty label). */
export function restoreVendor(d: DraftVendor): VendorDraft {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    key: str(d.key) || `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    app: d.app === 'FOOD' || d.app === 'PHARMA' || d.app === 'MART' ? d.app : 'MART',
    shopName: str(d.shopName),
    shopPhone: str(d.shopPhone),
    // Older drafts predate the tick: keep their typed shop number rather than overwriting it.
    sameAsOwnerPhone: d.sameAsOwnerPhone === true,
    shopAddress: str(d.shopAddress),
    platformFee: str(d.platformFee) || '10',
    categoryId: typeof d.categoryId === 'string' ? d.categoryId : null,
    fssaiNumber: str(d.fssaiNumber),
    fssaiUri: typeof d.fssaiUri === 'string' ? d.fssaiUri : null,
    drugLicenseNumber: str(d.drugLicenseNumber),
    drugLicenseUri: typeof d.drugLicenseUri === 'string' ? d.drugLicenseUri : null,
    shopPhotoUris: Array.isArray(d.shopPhotoUris)
      ? d.shopPhotoUris.filter((u): u is string => typeof u === 'string')
      : [],
    sameAsAccountBank: d.sameAsAccountBank !== false,
    bankName: str(d.bankName),
    bankAccountNumber: str(d.bankAccountNumber),
    bankIfsc: str(d.bankIfsc),
    bankBeneficiary: str(d.bankBeneficiary),
    latitude: typeof d.latitude === 'number' ? d.latitude : undefined,
    longitude: typeof d.longitude === 'number' ? d.longitude : undefined,
    pinnedAddress: str(d.pinnedAddress),
    categories: [],
    categoriesLoading: false,
  };
}

/** True when the draft holds anything worth restoring (so an emptied form clears its draft). */
export function hasDraftContent(draft: SellerDraft): boolean {
  const f = draft.form;
  const filled = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;
  const formFilled =
    filled(f.ownerName) ||
    filled(f.gstin) ||
    filled(f.pan) ||
    filled(f.businessAddress) ||
    filled(f.contactEmail) ||
    filled(f.bankName) ||
    filled(f.bankAccountNumber) ||
    filled(f.bankIfsc) ||
    filled(f.bankBeneficiary);
  if (formFilled || draft.passbookUri || draft.tierCode) return true;
  return draft.vendors.some(
    (v) =>
      filled(v.shopName) ||
      filled(v.shopAddress) ||
      filled(v.fssaiNumber) ||
      Boolean(v.fssaiUri) ||
      filled(v.drugLicenseNumber) ||
      Boolean(v.drugLicenseUri) ||
      (Array.isArray(v.shopPhotoUris) && v.shopPhotoUris.length > 0) ||
      v.latitude != null ||
      v.longitude != null ||
      filled(v.bankName) ||
      Boolean(v.categoryId),
  );
}

export function buildDraft(input: {
  form: DraftForm;
  vendors: VendorDraft[];
  passbookUri: string | null;
  tierCode: string | null;
  phoneCountry: string;
}): SellerDraft {
  return {
    version: VERSION,
    updatedAt: Date.now(),
    phoneCountry: input.phoneCountry,
    form: input.form,
    vendors: input.vendors.map(toDraftVendor),
    passbookUri: input.passbookUri,
    tierCode: input.tierCode,
  };
}

/** Read + validate the stored draft for one account. Corrupt/other-version data is ignored. */
export async function readSellerDraft(userKey: string): Promise<SellerDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SellerDraft>;
    if (!parsed || parsed.version !== VERSION || !parsed.form || !Array.isArray(parsed.vendors)) {
      return null;
    }
    return {
      version: VERSION,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      phoneCountry: typeof parsed.phoneCountry === 'string' ? parsed.phoneCountry : '',
      form: parsed.form as DraftForm,
      vendors: parsed.vendors as DraftVendor[],
      passbookUri: parsed.passbookUri ?? null,
      tierCode: parsed.tierCode ?? null,
    };
  } catch {
    return null;
  }
}

/** Persist a draft. Best-effort: storage failure never blocks the form. */
export async function writeSellerDraft(userKey: string, draft: SellerDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userKey), JSON.stringify(draft));
  } catch {
    // Device storage full/unavailable — the in-memory form still works.
  }
}

/** Remove a draft (after a successful submit or when an application is already on the server). */
export async function clearSellerDraft(userKey: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userKey));
  } catch {
    // ignore
  }
}
