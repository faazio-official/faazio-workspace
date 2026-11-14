import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPButton,
  DPField,
  DPSectionCard,
  DPFilterChip,
  DPStatusPill,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import DocumentCapture from '@/features/seller-onboarding/DocumentCapture';
import {
  GatewayHttpError,
  gateway,
  type DeliveryApplicationInput,
  type DeliveryDocType,
  type DeliveryVehicleType,
} from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { hs, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'Register'>;

const VEHICLES: { id: DeliveryVehicleType; label: string; cap: number }[] = [
  { id: 'BICYCLE', label: 'Bicycle', cap: 1 },
  { id: 'TWO_WHEELER', label: 'Two-wheeler', cap: 2 },
  { id: 'FOUR_WHEELER', label: 'Four-wheeler', cap: 5 },
];

const BASE_DOCS: { id: DeliveryDocType; label: string }[] = [
  { id: 'AADHAAR', label: 'Aadhaar' },
  { id: 'PAN', label: 'PAN' },
  { id: 'SELFIE', label: 'Live selfie' },
];

const MOTOR_DOCS: { id: DeliveryDocType; label: string }[] = [
  { id: 'DL_FRONT', label: 'Driving licence (front)' },
  { id: 'DL_BACK', label: 'Driving licence (back)' },
  { id: 'RC_FRONT', label: 'RC (front)' },
  { id: 'RC_BACK', label: 'RC (back)' },
  { id: 'INSURANCE_FRONT', label: 'Insurance (front)' },
  { id: 'INSURANCE_BACK', label: 'Insurance (back)' },
];

type CapturedDoc = { key: string; assetId?: string };

export function RegistrationFormScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const storedPhone = useDeliveryPartnerStore((s) => s.phone);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const phone = storedPhone || (user?.phone ? user.phone.replace('+91', '') : '');

  const [fullName, setFullName] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [hubZone, setHubZone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vehicleType, setVehicleType] = useState<DeliveryVehicleType>('TWO_WHEELER');
  const [capacity, setCapacity] = useState(2);
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [docs, setDocs] = useState<Partial<Record<DeliveryDocType, CapturedDoc>>>({});
  const [captureFor, setCaptureFor] = useState<{ id: DeliveryDocType; label: string } | null>(null);
  const [uploading, setUploading] = useState<DeliveryDocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requiredDocs = useMemo(
    () => (vehicleType === 'BICYCLE' ? BASE_DOCS : [...BASE_DOCS, ...MOTOR_DOCS]),
    [vehicleType],
  );
  const capacityCap = VEHICLES.find((v) => v.id === vehicleType)?.cap ?? 2;
  const missingDocs = requiredDocs.filter((d) => !docs[d.id]).length;

  const chooseVehicle = useCallback((id: DeliveryVehicleType, cap: number) => {
    setVehicleType(id);
    setCapacity(cap);
  }, []);

  const onCaptured = useCallback(
    async (uri: string) => {
      if (!captureFor) return;
      const target = captureFor;
      setCaptureFor(null);
      setError(null);
      setUploading(target.id);
      try {
        const uploaded = await gateway.uploadSellerDocument(uri, `delivery-${phone || 'pending'}`);
        setDocs((prev) => ({ ...prev, [target.id]: { key: uploaded.key, assetId: uploaded.assetId } }));
      } catch {
        setError(`Could not upload ${target.label}. Check your connection and try again.`);
      } finally {
        setUploading(null);
      }
    },
    [captureFor, phone],
  );

  const validate = useCallback((): string | null => {
    if (fullName.trim().length < 3) return 'Enter your full name as on your ID.';
    if (stateCode.trim().length !== 2) return 'Enter the 2-letter state code (e.g. TS).';
    if (hubZone.trim() === '') return 'Enter your hub zone.';
    if (address.trim().length < 5) return 'Enter your delivery address.';
    if (city.trim() === '') return 'Enter your city.';
    if (!/^\d{6}$/.test(pincode.trim())) return 'Enter a 6-digit pincode.';
    if (!/^[6-9]\d{9}$/.test(emergencyContact.trim())) {
      return 'Enter a valid 10-digit emergency contact.';
    }
    if (missingDocs > 0) return 'Capture every required document.';
    if (accountName.trim() === '') return 'Enter the bank account holder name.';
    if (accountNumber.replace(/\D/g, '').length < 9) return 'Enter a valid bank account number.';
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim())) return 'Enter a valid IFSC code.';
    return null;
  }, [
    accountName, accountNumber, address, city, emergencyContact, fullName, hubZone, ifsc,
    missingDocs, pincode, stateCode,
  ]);

  const onSubmit = useCallback(async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    const payload: DeliveryApplicationInput = {
      fullName: fullName.trim(),
      stateCode: stateCode.trim().toUpperCase(),
      hubZone: hubZone.trim(),
      address: address.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      emergencyContact: emergencyContact.trim(),
      vehicleType,
      maxCapacity: capacity,
      phone: phone || undefined,
      documents: requiredDocs.flatMap((d) => {
        const captured = docs[d.id];
        return captured ? [{ docType: d.id, fileKey: captured.key, assetId: captured.assetId }] : [];
      }),
      bank: {
        accountName: accountName.trim(),
        accountNumber: accountNumber.replace(/\D/g, ''),
        ifsc: ifsc.trim().toUpperCase(),
      },
    };
    try {
      const rider = await gateway.registerDeliveryPartner(payload);
      setRider(rider);
      navigation.replace('SubmissionSuccess');
    } catch (err) {
      setError(
        err instanceof GatewayHttpError && err.status === 409
          ? 'This phone already has an active application. Contact support if this is unexpected.'
          : 'Application could not be submitted. Check your details and connection.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    accountName, accountNumber, address, capacity, city, docs, emergencyContact, fullName,
    hubZone, ifsc, navigation, phone, requiredDocs, setRider, stateCode, validate, vehicleType,
  ]);

  return (
    <DPPage>
      <DPPageHeader
        kicker="Step 2 of 2"
        title="Your application"
        description="Documents are captured live (gallery uploads are blocked) and stored in a private bucket."
      />

      <DPSectionCard title="Personal details" style={styles.section}>
        <DPField label="Full name" value={fullName} onChangeText={setFullName} placeholder="As on Aadhaar" />
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <DPField
              label="State code"
              value={stateCode}
              onChangeText={(v) => setStateCode(v.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
              autoCapitalize="characters"
              placeholder="TS"
            />
          </View>
          <View style={styles.rowItem}>
            <DPField label="Hub zone" value={hubZone} onChangeText={setHubZone} placeholder="e.g. Madhapur" />
          </View>
        </View>
        <DPField label="Address" value={address} onChangeText={setAddress} placeholder="House / street / area" />
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <DPField label="City" value={city} onChangeText={setCity} placeholder="Hyderabad" />
          </View>
          <View style={styles.rowItem}>
            <DPField
              label="Pincode"
              value={pincode}
              onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="500081"
            />
          </View>
        </View>
        <DPField
          label="Emergency contact"
          value={emergencyContact}
          onChangeText={(v) => setEmergencyContact(v.replace(/[^\d]/g, '').slice(0, 10))}
          keyboardType="phone-pad"
          placeholder="10-digit number"
        />
      </DPSectionCard>

      <DPSectionCard title="Vehicle & capacity" style={styles.section}>
        <View style={styles.chips}>
          {VEHICLES.map((v) => (
            <DPFilterChip
              key={v.id}
              label={v.label}
              active={vehicleType === v.id}
              onPress={() => chooseVehicle(v.id, v.cap)}
            />
          ))}
        </View>
        <AppText style={styles.capacityLabel}>
          Max orders at once (capped by vehicle): {capacity} of {capacityCap}
        </AppText>
        <View style={styles.stepper}>
          <DPButton
            label="−"
            size="sm"
            variant="outline"
            fullWidth={false}
            onPress={() => setCapacity((c) => Math.max(1, c - 1))}
            accessibilityLabel="Decrease capacity"
          />
          <AppText style={styles.stepValue}>{capacity}</AppText>
          <DPButton
            label="+"
            size="sm"
            variant="outline"
            fullWidth={false}
            onPress={() => setCapacity((c) => Math.min(capacityCap, c + 1))}
            accessibilityLabel="Increase capacity"
          />
        </View>
      </DPSectionCard>

      <DPSectionCard title="KYC documents" style={styles.section}>
        {requiredDocs.map((d) => {
          const captured = docs[d.id];
          const busy = uploading === d.id;
          return (
            <View key={d.id} style={styles.docRow}>
              <View style={styles.flex}>
                <AppText style={styles.docLabel}>{d.label}</AppText>
                <View style={styles.docStatus}>
                  {busy ? (
                    <DPStatusPill status="PENDING" label="Uploading…" />
                  ) : captured ? (
                    <DPStatusPill status="VERIFIED" label="Captured & uploaded" />
                  ) : (
                    <DPStatusPill status="PENDING" label="Required" />
                  )}
                </View>
              </View>
              {busy ? (
                <ActivityIndicator color={DELIVERY.brand} />
              ) : (
                <DPButton
                  label={captured ? 'Retake' : 'Capture'}
                  size="sm"
                  variant="outline"
                  fullWidth={false}
                  onPress={() => setCaptureFor(d)}
                  accessibilityLabel={`${captured ? 'Retake' : 'Capture'} ${d.label}`}
                />
              )}
            </View>
          );
        })}
      </DPSectionCard>

      <DPSectionCard title="Payout account (pending review)" style={styles.section}>
        <DPField label="Account holder name" value={accountName} onChangeText={setAccountName} />
        <DPField
          label="Account number"
          value={accountNumber}
          onChangeText={(v) => setAccountNumber(v.replace(/\D/g, '').slice(0, 18))}
          keyboardType="number-pad"
        />
        <DPField
          label="IFSC"
          value={ifsc}
          onChangeText={(v) => setIfsc(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11))}
          autoCapitalize="characters"
          placeholder="HDFC0001234"
          hint="Only the last 4 digits are stored. Payouts are not enabled yet (Phase 5)."
        />
      </DPSectionCard>

      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      <DPButton
        label={missingDocs > 0 ? `Capture ${missingDocs} more document${missingDocs > 1 ? 's' : ''}` : 'Submit for review'}
        onPress={() => void onSubmit()}
        disabled={missingDocs > 0}
        loading={submitting}
      />

      <DocumentCapture
        visible={captureFor !== null}
        title={captureFor?.label ?? 'Capture'}
        onClose={() => setCaptureFor(null)}
        onCaptured={onCaptured}
      />
    </DPPage>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: vs(14) },
  row: { flexDirection: 'row', gap: hs(10) },
  rowItem: { flex: 1 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: hs(8), flexWrap: 'wrap' },
  capacityLabel: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(12) },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: hs(12), marginTop: vs(8) },
  stepValue: { ...DP_TYPE.title, color: DELIVERY.ink, fontWeight: '700', minWidth: hs(28), textAlign: 'center' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingVertical: vs(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DELIVERY.border,
  },
  docLabel: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
  docStatus: { marginTop: vs(4) },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginBottom: vs(10) },
});