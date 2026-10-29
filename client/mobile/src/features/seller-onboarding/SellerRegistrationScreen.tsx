import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BadgeCheck,
  Camera,
  ChevronLeft,
  FileCheck2,
  LocateFixed,
  Lock,
  Mail,
  ShieldCheck,
  Store,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import InfoButton from '@/components/shared/InfoButton';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { SELLER_SETUP_FIELDS } from '@data/index';
import { districtsForState } from '@data/districts';
import type { AppBrand } from '@data/types';
import { gateway, type SellerApplication } from '@/services/api/GatewayClient';
import { firebaseAuthConfigured, sendSellerOtp, verifySellerOtp } from '@/services/firebaseAuth';
import { getCurrentAddress, type Coordinates } from '@/services/location';
import SellerLocationPicker from './SellerLocationPicker';
import { useAuthStore } from '@/state/authStore';
import type { RootStackParamList } from '@/navigation/types';
import DocumentCapture from './DocumentCapture';

type Props = NativeStackScreenProps<RootStackParamList, 'SellWithUs'>;

const CATEGORIES: { value: AppBrand; label: string }[] = [
  { value: 'MART', label: 'Mart' },
  { value: 'FOOD', label: 'Food' },
  { value: 'PHARMA', label: 'Pharma' },
];

const INDIAN_STATES: Record<string, string> = {
  maharashtra: 'MH', karnataka: 'KA', delhi: 'DL', 'new delhi': 'DL', gujarat: 'GJ',
  'tamil nadu': 'TN', telangana: 'TG', 'andhra pradesh': 'AP', 'uttar pradesh': 'UP',
  'west bengal': 'WB', rajasthan: 'RJ', 'madhya pradesh': 'MP', kerala: 'KL', punjab: 'PB',
  haryana: 'HR', bihar: 'BR', odisha: 'OR', jharkhand: 'JH', chhattisgarh: 'CG',
  assam: 'AS', uttarakhand: 'UK', 'himachal pradesh': 'HP', goa: 'GA', tripura: 'TR',
  manipur: 'MN', meghalaya: 'ML', mizoram: 'MZ', nagaland: 'NL', sikkim: 'SK',
  'arunachal pradesh': 'AR', 'jammu and kashmir': 'JK', ladakh: 'LA', puducherry: 'PY',
  chandigarh: 'CH', 'andaman and nicobar islands': 'AN', lakshadweep: 'LD',
  'dadra and nagar haveli and daman and diu': 'DN',
};

/** Label/placeholder sourced from the stable @data contract (keeps the fixture meaningful). */
const setup = (key: string) => SELLER_SETUP_FIELDS.find((f) => f.key === key);

interface FormState {
  businessName: string;
  ownerName: string;
  gstin: string;
  pan: string;
  businessAddress: string;
  contactPhone: string;
  contactEmail: string;
  stateCode: string;
  districtCode: string;
  platformFee: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBeneficiary: string;
  fssaiNumber: string;
}

/**
 * Full seller registration: business identity, location-derived state, platform fee, payout bank
 * account, mandatory passbook (+ FSSAI for food) and an OTP digital signature. Documents upload
 * straight to the private R2 bucket via a presigned PUT; the server stores keys/asset ids only.
 */
export function SellerRegistrationScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const authPhone = user?.phone ?? '';

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
    platformFee: '10',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBeneficiary: '',
    fssaiNumber: '',
  });
  const [category, setCategory] = useState<AppBrand>('MART');
  const [passbookUri, setPassbookUri] = useState<string | null>(null);
  const [fssaiUri, setFssaiUri] = useState<string | null>(null);
  const [capture, setCapture] = useState<'passbook' | 'fssai' | null>(null);

  const [locating, setLocating] = useState(false);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationError, setLocationError] = useState('');
  const [shopPin, setShopPin] = useState<Coordinates | null>(null);
  const [shopAddress, setShopAddress] = useState('');
  const [pinOpen, setPinOpen] = useState(false);

  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpError, setOtpError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SellerApplication | null>(null);

  const update = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const otpPhone = authPhone || form.contactPhone;
  const phoneDigits = useMemo(() => otpPhone.replace(/\D/g, '').slice(-10), [otpPhone]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const detectLocation = async () => {
    setLocating(true);
    setLocationError('');
    try {
      const address = await getCurrentAddress();
      if (!address) {
        setLocationError('Location permission was denied. Enter your state code manually.');
        return;
      }
      const region = address.place?.region ?? '';
      const key = region.trim().toLowerCase();
      const code = INDIAN_STATES[key] ?? (/^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : '');
      if (code) {
        setForm((prev) => ({ ...prev, stateCode: code }));
        setLocationLabel(region || code);
      } else {
        setLocationError('Could not detect your state. Enter the 2-letter code manually.');
      }
    } catch {
      setLocationError('Could not read your location. Enter the state code manually.');
    } finally {
      setLocating(false);
    }
  };

  const sendSignatureOtp = async () => {
    setOtpError('');
    if (phoneDigits.length !== 10) {
      setOtpError('A valid 10-digit mobile number is required.');
      return;
    }
    if (!firebaseAuthConfigured()) {
      setOtpError('OTP verification is not available in this build.');
      return;
    }
    setOtpBusy(true);
    try {
      await sendSellerOtp(phoneDigits);
      setOtpSent(true);
      setCountdown(60);
      setOtpVerified(false);
    } catch {
      setOtpError('Could not send the OTP. Please try again.');
    } finally {
      setOtpBusy(false);
    }
  };

  const confirmSignatureOtp = async () => {
    setOtpError('');
    if (!otpSent || otpCode.trim().length !== 6) {
      setOtpError('Enter the 6-digit code.');
      return;
    }
    setOtpBusy(true);
    try {
      await verifySellerOtp(phoneDigits, otpCode.trim());
      // The OTP is the digital signature; the shopper's primary Firebase session is untouched.
      setOtpVerified(true);
      setCountdown(0);
    } catch {
      setOtpError('That code is incorrect or expired. Request a new one.');
    } finally {
      setOtpBusy(false);
    }
  };

  const validate = (): string | null => {
    const required: [keyof FormState, string][] = [
      ['businessName', 'business name'],
      ['ownerName', 'owner name'],
      ['gstin', 'GSTIN'],
      ['pan', 'PAN'],
      ['businessAddress', 'business address'],
      ['contactPhone', 'contact phone'],
      ['contactEmail', 'contact email'],
      ['stateCode', 'state code'],
      ['bankName', 'bank name'],
      ['bankAccountNumber', 'bank account number'],
      ['bankIfsc', 'IFSC'],
      ['bankBeneficiary', 'beneficiary name'],
    ];
    const missing = required.filter(([k]) => !form[k].trim()).map(([, label]) => label);
    if (missing.length > 0) return `Please fill in: ${missing.join(', ')}.`;
    const stateCode = form.stateCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(stateCode)) return 'Enter a 2-letter state code.';
    if (districtsForState(stateCode).length > 0 && !form.districtCode) return 'Select your district.';
    if (!/^\S+@\S+\.\S+$/.test(form.contactEmail.trim())) return 'Enter a valid contact email.';
    if (form.bankAccountNumber.replace(/\D/g, '').length < 6) return 'Enter a valid bank account number.';
    if (form.bankIfsc.trim().length !== 11) return 'IFSC must be 11 characters.';

    const pct = Number(form.platformFee);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) return 'Platform fee must be between 1 and 100.';
    if (category === 'FOOD' && pct < 5) return 'Food sellers must set a platform fee of at least 5%.';

    if (!passbookUri) return 'Capture your bank passbook photo.';
    if (category === 'FOOD') {
      if (!form.fssaiNumber.trim()) return 'Enter your FSSAI licence number.';
      if (!fssaiUri) return 'Capture your FSSAI certificate.';
    }
    if (!otpVerified) return 'Verify the OTP to sign your application.';
    return null;
  };

  const submit = async () => {
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
      let fssai: { key: string; assetId: string } | undefined;
      if (category === 'FOOD' && fssaiUri) {
        fssai = await gateway.uploadSellerDocument(fssaiUri, ownerId);
      }
      const res = await gateway.submitSellerApplication({
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        category,
        gstin: form.gstin.trim().toUpperCase(),
        pan: form.pan.trim().toUpperCase(),
        businessAddress: form.businessAddress.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim(),
        stateCode: form.stateCode.trim().toUpperCase(),
        districtCode: form.districtCode || undefined,
        latitude: shopPin?.latitude,
        longitude: shopPin?.longitude,
        platformFeePct: Number(form.platformFee),
        bankName: form.bankName.trim(),
        bankAccountNumber: form.bankAccountNumber.replace(/\D/g, ''),
        bankIfsc: form.bankIfsc.trim().toUpperCase(),
        bankBeneficiary: form.bankBeneficiary.trim(),
        passbookFileKey: passbook.key,
        passbookAssetId: passbook.assetId,
        fssaiNumber: form.fssaiNumber.trim() || undefined,
        fssaiFileKey: fssai?.key,
        fssaiAssetId: fssai?.assetId,
        otpVerified: true,
      });
      setResult(res);
    } catch {
      setError('Could not submit right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting && otpVerified && Boolean(passbookUri) &&
    (category !== 'FOOD' || Boolean(fssaiUri));

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
          <ChevronLeft size={ms(26)} color="#0f172a" strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Sell with us</AppText>
        <InfoButton contentKey="SellWithUs" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Store size={ms(22)} color="#1162D3" strokeWidth={2.2} />
          </View>
          <AppText style={styles.heroTitle}>Partner with Faazio</AppText>
          <AppText style={styles.heroSub}>
            Complete your business, payout and KYC details. A district admin reviews every application
            before your store goes live.
          </AppText>
        </View>

        {result ? (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <BadgeCheck size={ms(26)} color="#16A34A" strokeWidth={2.2} />
            </View>
            <AppText style={styles.successTitle}>Application submitted</AppText>
            <AppText style={styles.successBody}>
              Your KYC is queued for state-admin review. You will be notified when it is verified.
            </AppText>
            <View style={styles.successRow}>
              <AppText style={styles.successKey}>Application ID</AppText>
              <AppText style={styles.successValue}>{result.sellerId}</AppText>
            </View>
            <View style={styles.successRow}>
              <AppText style={styles.successKey}>Status</AppText>
              <AppText style={styles.successValue}>Pending review</AppText>
            </View>
            <View style={styles.successRow}>
              <AppText style={styles.successKey}>Platform fee</AppText>
              <AppText style={styles.successValue}>{result.platformFeePct}%</AppText>
            </View>
            <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.goBack()} activeOpacity={0.9}>
              <AppText style={styles.submitText}>Done</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionCard}>
              <AppText style={styles.sectionTitle}>Business details</AppText>
              <AppText style={styles.sectionNote}>All fields are required.</AppText>

              <AppText style={styles.inputLabel}>Category</AppText>
              <View style={styles.chipRow}>
                {CATEGORIES.map((c) => {
                  const active = category === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCategory(c.value)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <AppText style={[styles.chipText, active && styles.chipTextActive]}>
                        {c.label}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>

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
                label={setup('gstin')?.label ?? 'GSTIN'}
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
              <TouchableOpacity
                style={styles.pinButton}
                onPress={() => setPinOpen(true)}
                activeOpacity={0.8}
              >
                <LocateFixed size={ms(16)} color="#1162D3" strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <AppText style={styles.pinButtonTitle}>
                    {shopPin ? 'Shop pin selected' : 'Pin shop location on map'}
                  </AppText>
                  <AppText style={styles.pinButtonValue} numberOfLines={1}>
                    {shopPin
                      ? shopAddress ||
                        `${shopPin.latitude.toFixed(5)}, ${shopPin.longitude.toFixed(5)}`
                      : 'Helps customers find you and powers nearby ranking'}
                  </AppText>
                </View>
              </TouchableOpacity>
              <TextInputField
                label={setup('contactPhone')?.label ?? 'Contact phone'}
                placeholder={setup('contactPhone')?.placeholder ?? '+91 00000 00000'}
                value={form.contactPhone}
                onChangeText={authPhone ? undefined : update('contactPhone')}
                keyboardType="phone-pad"
                editable={!authPhone}
              />
              <TextInputField
                label={setup('contactEmail')?.label ?? 'Contact email'}
                placeholder={setup('contactEmail')?.placeholder ?? 'owner@business.com'}
                value={form.contactEmail}
                onChangeText={update('contactEmail')}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.stateRow}>
                <View style={{ flex: 1 }}>
                  <TextInputField
                    label={setup('state')?.label ?? 'State'}
                    placeholder={setup('state')?.placeholder ?? 'e.g. MH'}
                    value={form.stateCode}
                    onChangeText={(v) => {
                      setLocationLabel('');
                      setForm((prev) => ({
                        ...prev,
                        stateCode: v.toUpperCase(),
                        districtCode: '',
                      }));
                    }}
                    autoCapitalize="characters"
                    maxLength={2}
                    editable={!locationLabel}
                  />
                </View>
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={detectLocation}
                  disabled={locating}
                  activeOpacity={0.8}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color="#1162D3" />
                  ) : (
                    <LocateFixed size={ms(16)} color="#1162D3" strokeWidth={2.2} />
                  )}
                  <AppText style={styles.locationText}>
                    {locationLabel ? 'Detected' : 'Use location'}
                  </AppText>
                </TouchableOpacity>
              </View>
              {districtsForState(form.stateCode).length > 0 ? (
                <View style={styles.districtBlock}>
                  <AppText style={styles.districtLabel}>District</AppText>
                  <View style={styles.districtChips}>
                    {districtsForState(form.stateCode).map((d) => {
                      const active = form.districtCode === d.districtCode;
                      return (
                        <TouchableOpacity
                          key={d.districtCode}
                          style={[styles.districtChip, active && styles.districtChipActive]}
                          onPress={() => update('districtCode')(d.districtCode)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          <AppText
                            style={[styles.districtChipText, active && styles.districtChipTextActive]}
                          >
                            {d.name}
                          </AppText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              {locationLabel ? (
                <TouchableOpacity onPress={() => setLocationLabel('')} activeOpacity={0.7}>
                  <AppText style={styles.linkText}>Change state manually</AppText>
                </TouchableOpacity>
              ) : null}
              {locationError ? <AppText style={styles.helperError}>{locationError}</AppText> : null}

              <TextInputField
                label={setup('platformFee')?.label ?? 'Platform fee %'}
                placeholder={category === 'FOOD' ? '5 – 100' : '1 – 100'}
                value={form.platformFee}
                onChangeText={update('platformFee')}
                keyboardType="number-pad"
                maxLength={3}
              />
              <AppText style={styles.helperText}>
                The platform retains this share of each order; the rest is settled to your bank
                after the 14-day buyer-protection hold.
              </AppText>
            </View>

            <View style={styles.sectionCard}>
              <AppText style={styles.sectionTitle}>Payout account</AppText>
              <AppText style={styles.sectionNote}>
                The full account number is sent to Razorpay and never stored by Faazio.
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
              <AppText style={styles.sectionTitle}>KYC documents</AppText>
              <AppText style={styles.sectionNote}>
                Images are uploaded to a private bucket and shown only to you and the review team.
              </AppText>

              <DocumentRow
                label="Bank passbook"
                uri={passbookUri}
                onCapture={() => setCapture('passbook')}
                onRemove={() => setPassbookUri(null)}
              />

              {category === 'FOOD' ? (
                <>
                  <TextInputField
                    label={setup('fssaiNumber')?.label ?? 'FSSAI licence number'}
                    placeholder={setup('fssaiNumber')?.placeholder ?? '14-digit licence number'}
                    value={form.fssaiNumber}
                    onChangeText={update('fssaiNumber')}
                    keyboardType="number-pad"
                  />
                  <DocumentRow
                    label="FSSAI certificate"
                    uri={fssaiUri}
                    onCapture={() => setCapture('fssai')}
                    onRemove={() => setFssaiUri(null)}
                  />
                </>
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <AppText style={styles.sectionTitle}>Digital signature</AppText>
                {otpVerified ? (
                  <View style={styles.verifiedPill}>
                    <ShieldCheck size={ms(12)} color="#16A34A" strokeWidth={2.4} />
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
                      placeholderTextColor="#94A3B8"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <TouchableOpacity
                      style={[
                        styles.otpButton,
                        (otpBusy || (!otpSent ? phoneDigits.length !== 10 : countdown > 0)) &&
                          styles.otpButtonDisabled,
                      ]}
                      onPress={otpSent ? confirmSignatureOtp : sendSignatureOtp}
                      disabled={otpBusy || (!otpSent ? phoneDigits.length !== 10 : countdown > 0)}
                      activeOpacity={0.85}
                    >
                      {otpBusy ? (
                        <ActivityIndicator size="small" color="#ffffff" />
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
                  <FileCheck2 size={ms(18)} color="#16A34A" strokeWidth={2.2} />
                  <AppText style={styles.signedText}>
                    OTP verified at {new Date().toLocaleTimeString()}. This is your digital
                    signature.
                  </AppText>
                </View>
              )}
            </View>

            {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              activeOpacity={0.85}
              onPress={submit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Lock size={ms(16)} color="#ffffff" strokeWidth={2.2} />
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
              <Mail size={ms(12)} color="#94A3B8" strokeWidth={2.2} />
              <AppText style={styles.secureNoteText}>
                Your bank details are sent over an authenticated connection. KYC images live in a
                private bucket; secrets and OTPs are never logged.
              </AppText>
            </View>
          </>
        )}
      </ScrollView>

      <SellerLocationPicker
        visible={pinOpen}
        initial={shopPin}
        onCancel={() => setPinOpen(false)}
        onPick={({ coordinates, address }) => {
          setShopPin(coordinates);
          setShopAddress(address);
          setPinOpen(false);
        }}
      />

      <DocumentCapture
        visible={capture !== null}
        title={capture === 'fssai' ? 'FSSAI certificate' : 'Bank passbook'}
        onClose={() => setCapture(null)}
        onCaptured={(uri) => {
          if (capture === 'fssai') setFssaiUri(uri);
          else setPassbookUri(uri);
          setCapture(null);
        }}
      />
    </View>
  );
}

interface TextInputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText?: (value: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'email-address';
  maxLength?: number;
  editable?: boolean;
}

function TextInputField({
  label,
  placeholder,
  value,
  onChangeText,
  autoCapitalize,
  keyboardType,
  maxLength,
  editable = true,
}: TextInputFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <AppText style={styles.inputLabel}>{label}</AppText>
      <AppTextInput
        style={[styles.input, !editable && styles.inputReadOnly]}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={editable}
      />
    </View>
  );
}

function DocumentRow({
  label,
  uri,
  onCapture,
  onRemove,
}: {
  label: string;
  uri: string | null;
  onCapture: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.docRow}>
      <View style={[styles.docIcon, uri && styles.docIconDone]}>
        {uri ? (
          <BadgeCheck size={ms(18)} color="#16A34A" strokeWidth={2.2} />
        ) : (
          <Camera size={ms(18)} color="#1162D3" strokeWidth={2.2} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={styles.docLabel}>{label}</AppText>
        <AppText style={styles.docStatus}>{uri ? 'Captured' : 'Required'}</AppText>
      </View>
      <TouchableOpacity
        style={styles.docButton}
        onPress={uri ? onRemove : onCapture}
        activeOpacity={0.8}
      >
        <AppText style={styles.docButtonText}>{uri ? 'Retake' : 'Capture'}</AppText>
      </TouchableOpacity>
    </View>
  );
}

export default SellerRegistrationScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
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
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backButton: { width: ms(40), height: ms(40), alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: ms(18), fontWeight: '900', color: '#0f172a' },
  heroCard: {
    backgroundColor: '#1162D3',
    borderRadius: ms(20),
    padding: hs(18),
    marginBottom: SPACE.SECTION,
  },
  heroIcon: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  heroTitle: { fontSize: ms(18), fontWeight: '900', color: '#FFFFFF' },
  heroSub: { fontSize: ms(12), color: '#DBEAFE', lineHeight: ms(18), marginTop: vs(6) },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(18),
    padding: hs(16),
    marginBottom: SPACE.SECTION,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    fontSize: ms(14),
    fontWeight: '900',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionNote: {
    fontSize: ms(11),
    color: '#94A3B8',
    marginTop: vs(2),
    marginBottom: SPACE.BLOCK,
  },
  fieldWrap: { marginTop: vs(12) },
  inputLabel: {
    fontSize: ms(11),
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: vs(6),
  },
  input: {
    height: Math.max(46, vs(46)),
    backgroundColor: '#F8FAFC',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: hs(12),
    fontSize: ms(14),
    fontWeight: '600',
    color: '#0f172a',
  },
  inputReadOnly: { backgroundColor: '#EEF2F7', color: '#64748B' },
  chipRow: { flexDirection: 'row', gap: hs(8) },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(10),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  chipActive: { borderColor: '#1162D3', backgroundColor: '#EFF6FF' },
  chipText: { fontSize: ms(13), fontWeight: '800', color: '#64748B' },
  chipTextActive: { color: '#1162D3' },
  districtBlock: { marginTop: vs(10) },
  districtLabel: { fontSize: ms(12), fontWeight: '800', color: '#334155', marginBottom: vs(8) },
  districtChips: { flexDirection: 'row', flexWrap: 'wrap', gap: hs(8) },
  districtChip: {
    paddingHorizontal: hs(12),
    paddingVertical: vs(7),
    borderRadius: ms(16),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  districtChipActive: { backgroundColor: '#1162D3', borderColor: '#1162D3' },
  districtChipText: { fontSize: ms(11.5), fontWeight: '700', color: '#64748B' },
  districtChipTextActive: { color: '#FFFFFF' },
  stateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: hs(8) },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hs(6),
    height: Math.max(46, vs(46)),
    paddingHorizontal: hs(12),
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingHorizontal: hs(12),
    paddingVertical: vs(10),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#BFD7F7',
    backgroundColor: '#F5F9FF',
    marginTop: vs(10),
  },
  pinButtonTitle: { fontSize: ms(11), fontWeight: '800', color: '#0f172a' },
  pinButtonValue: { fontSize: ms(10), color: '#64748B', marginTop: vs(1) },
  locationText: { fontSize: ms(11), fontWeight: '800', color: '#1162D3' },
  helperText: {
    fontSize: ms(10.5),
    color: '#94A3B8',
    lineHeight: ms(15),
    marginTop: vs(8),
  },
  helperError: { fontSize: ms(11), color: '#DC2626', fontWeight: '700', marginTop: vs(8) },
  linkText: { fontSize: ms(11), fontWeight: '800', color: '#1162D3', marginTop: vs(8) },
  linkTextMuted: { color: '#94A3B8' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingVertical: vs(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEF1F5',
  },
  docIcon: {
    width: ms(38),
    height: ms(38),
    borderRadius: ms(11),
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIconDone: { backgroundColor: '#DCFCE7' },
  docLabel: { fontSize: ms(13), fontWeight: '800', color: '#0f172a' },
  docStatus: { fontSize: ms(10.5), color: '#94A3B8', marginTop: vs(2) },
  docButton: {
    paddingHorizontal: hs(12),
    paddingVertical: vs(8),
    borderRadius: ms(10),
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  docButtonText: { fontSize: ms(11), fontWeight: '800', color: '#1162D3' },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(4),
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(20),
    backgroundColor: '#DCFCE7',
  },
  verifiedText: { fontSize: ms(10), fontWeight: '800', color: '#16A34A' },
  otpRow: { flexDirection: 'row', gap: hs(8), alignItems: 'center' },
  otpInput: { flex: 1 },
  otpButton: {
    height: Math.max(46, vs(46)),
    minWidth: hs(96),
    borderRadius: ms(12),
    backgroundColor: '#1162D3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpButtonDisabled: { opacity: 0.6 },
  otpButtonText: { fontSize: ms(12), fontWeight: '800', color: '#ffffff', textTransform: 'uppercase' },
  signedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    padding: hs(12),
    borderRadius: ms(12),
    backgroundColor: '#F0FDF4',
  },
  signedText: { flex: 1, fontSize: ms(11), color: '#166534', lineHeight: ms(16), fontWeight: '600' },
  errorText: {
    fontSize: ms(12),
    fontWeight: '700',
    color: '#DC2626',
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
    backgroundColor: '#1162D3',
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitText: { fontSize: ms(13), fontWeight: '800', color: '#ffffff', textTransform: 'uppercase' },
  uploadingText: {
    fontSize: ms(10.5),
    color: '#64748B',
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
  secureNoteText: { fontSize: ms(10.5), color: '#94A3B8', lineHeight: ms(15), flex: 1 },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(18),
    padding: hs(18),
    alignItems: 'center',
  },
  successIcon: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.BLOCK,
  },
  successTitle: { fontSize: ms(16), fontWeight: '900', color: '#0f172a' },
  successBody: {
    fontSize: ms(12),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: ms(18),
    marginTop: vs(6),
    marginBottom: SPACE.SECTION,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: vs(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEF1F5',
  },
  successKey: { fontSize: ms(12), fontWeight: '700', color: '#94A3B8' },
  successValue: { fontSize: ms(13), fontWeight: '800', color: '#0f172a' },
});
