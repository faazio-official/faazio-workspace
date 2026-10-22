import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { Card, DP, ErrorText, Field, PrimaryButton, Screen } from '../components';
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
import { hs, ms, vs } from '@/utils/responsive';
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
      navigation.replace('Status');
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
    <Screen>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <AppText style={styles.kicker}>Step 2 of 2</AppText>
        <AppText style={styles.title}>Your application</AppText>
        <AppText style={styles.subtitle}>
          Documents are captured live (gallery uploads are blocked) and stored in a private bucket.
        </AppText>

        <Card style={styles.section}>
          <AppText style={styles.sectionTitle}>Personal details</AppText>
          <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="As on Aadhaar" />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Field
                label="State code"
                value={stateCode}
                onChangeText={(v) => setStateCode(v.replace(/[^a-zA-Z]/g, '').slice(0, 2))}
                autoCapitalize="characters"
                placeholder="TS"
              />
            </View>
            <View style={styles.rowItem}>
              <Field label="Hub zone" value={hubZone} onChangeText={setHubZone} placeholder="e.g. Madhapur" />
            </View>
          </View>
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="House / street / area" />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Field label="City" value={city} onChangeText={setCity} placeholder="Hyderabad" />
            </View>
            <View style={styles.rowItem}>
              <Field
                label="Pincode"
                value={pincode}
                onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="500081"
              />
            </View>
          </View>
          <Field
            label="Emergency contact"
            value={emergencyContact}
            onChangeText={(v) => setEmergencyContact(v.replace(/[^\d]/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            placeholder="10-digit number"
          />
        </Card>

        <Card style={styles.section}>
          <AppText style={styles.sectionTitle}>Vehicle & capacity</AppText>
          <View style={styles.chips}>
            {VEHICLES.map((v) => {
              const active = vehicleType === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => chooseVehicle(v.id, v.cap)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <AppText style={[styles.chipText, active && styles.chipTextActive]}>{v.label}</AppText>
                </TouchableOpacity>
              );
            })}
          </View>
          <AppText style={styles.capacityLabel}>
            Max orders at once (capped by vehicle): {capacity} of {capacityCap}
          </AppText>
          <View style={styles.stepper}>
            <TouchableOpacity
              onPress={() => setCapacity((c) => Math.max(1, c - 1))}
              style={styles.stepButton}
            >
              <AppText style={styles.stepText}>−</AppText>
            </TouchableOpacity>
            <AppText style={styles.stepValue}>{capacity}</AppText>
            <TouchableOpacity
              onPress={() => setCapacity((c) => Math.min(capacityCap, c + 1))}
              style={styles.stepButton}
            >
              <AppText style={styles.stepText}>+</AppText>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.section}>
          <AppText style={styles.sectionTitle}>KYC documents</AppText>
          {requiredDocs.map((d) => {
            const captured = docs[d.id];
            const busy = uploading === d.id;
            return (
              <View key={d.id} style={styles.docRow}>
                <View style={styles.flex}>
                  <AppText style={styles.docLabel}>{d.label}</AppText>
                  <AppText style={[styles.docStatus, captured && styles.docOk]}>
                    {busy ? 'Uploading…' : captured ? 'Captured & uploaded' : 'Required'}
                  </AppText>
                </View>
                {busy ? (
                  <ActivityIndicator color={DP.brand} />
                ) : (
                  <TouchableOpacity
                    style={[styles.docButton, captured && styles.docButtonDone]}
                    onPress={() => setCaptureFor(d)}
                  >
                    <AppText style={[styles.docButtonText, captured && styles.docButtonTextDone]}>
                      {captured ? 'Retake' : 'Capture'}
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </Card>

        <Card style={styles.section}>
          <AppText style={styles.sectionTitle}>Payout account (pending review)</AppText>
          <Field label="Account holder name" value={accountName} onChangeText={setAccountName} />
          <Field
            label="Account number"
            value={accountNumber}
            onChangeText={(v) => setAccountNumber(v.replace(/\D/g, '').slice(0, 18))}
            keyboardType="number-pad"
          />
          <Field
            label="IFSC"
            value={ifsc}
            onChangeText={(v) => setIfsc(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11))}
            autoCapitalize="characters"
            placeholder="HDFC0001234"
          />
          <AppText style={styles.hint}>
            Only the last 4 digits are stored. Payouts are not enabled yet (Phase 5).
          </AppText>
        </Card>

        <ErrorText>{error}</ErrorText>
        <PrimaryButton
          label={missingDocs > 0 ? `Capture ${missingDocs} more document${missingDocs > 1 ? 's' : ''}` : 'Submit for review'}
          onPress={onSubmit}
          disabled={missingDocs > 0}
          loading={submitting}
        />
      </ScrollView>

      <DocumentCapture
        visible={captureFor !== null}
        title={captureFor?.label ?? 'Capture'}
        onClose={() => setCaptureFor(null)}
        onCaptured={onCaptured}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: hs(16), paddingBottom: vs(40) },
  kicker: { fontSize: ms(11), fontWeight: '900', color: DP.brand, textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { fontSize: ms(26), fontWeight: '900', color: DP.ink, marginTop: vs(4) },
  subtitle: { fontSize: ms(13), lineHeight: ms(19), color: DP.muted, marginTop: vs(6), marginBottom: vs(16) },
  section: { marginBottom: vs(14) },
  sectionTitle: { fontSize: ms(15), fontWeight: '900', color: DP.ink, marginBottom: vs(12) },
  row: { flexDirection: 'row', gap: hs(10) },
  rowItem: { flex: 1 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: hs(8), flexWrap: 'wrap' },
  chip: {
    borderWidth: 1, borderColor: DP.line, borderRadius: ms(10), paddingHorizontal: hs(12),
    paddingVertical: vs(8), backgroundColor: '#ffffff',
  },
  chipActive: { borderColor: DP.brand, backgroundColor: '#eef2ff' },
  chipText: { fontSize: ms(12), fontWeight: '800', color: DP.muted },
  chipTextActive: { color: DP.brand },
  capacityLabel: { fontSize: ms(12), color: DP.muted, marginTop: vs(12) },
  stepper: { flexDirection: 'row', alignItems: 'center', marginTop: vs(8) },
  stepButton: {
    width: ms(40), height: ms(40), borderRadius: ms(10), borderWidth: 1, borderColor: DP.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff',
  },
  stepText: { fontSize: ms(20), fontWeight: '900', color: DP.ink },
  stepValue: { width: ms(48), textAlign: 'center', fontSize: ms(18), fontWeight: '900', color: DP.ink },
  docRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: vs(10),
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DP.line,
  },
  docLabel: { fontSize: ms(13), fontWeight: '800', color: DP.ink },
  docStatus: { fontSize: ms(11), color: DP.warning, marginTop: vs(2) },
  docOk: { color: DP.success },
  docButton: {
    borderWidth: 1, borderColor: DP.brand, borderRadius: ms(8), paddingHorizontal: hs(12),
    paddingVertical: vs(6),
  },
  docButtonDone: { borderColor: DP.line },
  docButtonText: { fontSize: ms(11), fontWeight: '900', color: DP.brand },
  docButtonTextDone: { color: DP.muted },
  hint: { fontSize: ms(11), color: DP.muted, lineHeight: ms(16) },
});
