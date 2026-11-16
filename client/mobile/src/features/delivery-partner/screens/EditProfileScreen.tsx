import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Minus, Plus } from 'lucide-react-native';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPBackLink,
  DPSectionCard,
  DPKeyValueRow,
  DPField,
  DPFilterChip,
  DPButton,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { gateway, type DeliveryVehicleType } from '@/services/api/GatewayClient';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { hs, ms, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';
import { DeliveryHeader } from '../components/DeliveryHeader';
import { DELIVERY_VEHICLES, capacityCapFor } from '../vehicles';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'EditProfile'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Dedicated editor for the rider's own profile: contact email plus the work preferences the server
 * accepts on `PUT /delivery/me` (vehicle, capacity, hub zone). Identity, KYC documents and bank
 * details stay admin-owned and are shown read-only.
 */
export function EditProfileScreen({ navigation }: Props) {
  const rider = useDeliveryPartnerStore((s) => s.rider);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);

  const [email, setEmail] = useState(rider?.email ?? '');
  const [vehicleType, setVehicleType] = useState<DeliveryVehicleType>(
    rider?.vehicleType ?? 'TWO_WHEELER',
  );
  const [capacity, setCapacity] = useState(rider?.maxCapacity ?? 2);
  const [hubZone, setHubZone] = useState(rider?.hubZone ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!rider) return;
    setEmail(rider.email ?? '');
    setVehicleType(rider.vehicleType);
    setCapacity(rider.maxCapacity);
    setHubZone(rider.hubZone);
  }, [rider]);

  const capacityCap = capacityCapFor(vehicleType);
  const minCapacity = Math.max(1, rider?.currentLoad ?? 0);
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedHubZone = hubZone.trim();
  const dirty = Boolean(
    rider &&
      (trimmedEmail !== (rider.email ?? '') ||
        vehicleType !== rider.vehicleType ||
        capacity !== rider.maxCapacity ||
        trimmedHubZone !== rider.hubZone),
  );

  const options = useMemo(
    () =>
      DELIVERY_VEHICLES.map((v) => ({
        ...v,
        disabled: v.cap < (rider?.currentLoad ?? 0),
      })),
    [rider?.currentLoad],
  );

  const chooseVehicle = useCallback(
    (next: DeliveryVehicleType, cap: number) => {
      setSaved(false);
      setSaveError(null);
      setVehicleType(next);
      setCapacity((current) => Math.min(Math.max(current, minCapacity), cap));
    },
    [minCapacity],
  );

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await gateway.updateDeliveryPartnerProfile({
        email: trimmedEmail,
        vehicleType,
        maxCapacity: capacity,
        hubZone: trimmedHubZone,
      });
      setRider(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }, [capacity, dirty, saving, setRider, trimmedEmail, trimmedHubZone, vehicleType]);

  const emailError =
    trimmedEmail.length > 0 && !EMAIL_RE.test(trimmedEmail)
      ? 'Enter a valid email address.'
      : null;
  const canSave = dirty && EMAIL_RE.test(trimmedEmail) && trimmedHubZone !== '';

  return (
    <DPPage header={<DeliveryHeader />}>
      <DPBackLink onPress={() => navigation.goBack()} />
      <DPPageHeader title="My profile" />

      <DPSectionCard style={styles.card} title="Personal details">
        <DPKeyValueRow label="Name" value={rider?.fullName || '—'} />
        <DPKeyValueRow label="Phone" value={rider?.phone || '—'} />
        <DPField
          label="Email"
          value={email}
          onChangeText={(value) => {
            setSaved(false);
            setEmail(value);
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          placeholder="you@example.com"
          error={emailError}
        />
      </DPSectionCard>

      <DPSectionCard style={styles.card} title="Work details">
        <AppText style={styles.fieldLabel}>Vehicle</AppText>
        <View style={styles.chips}>
          {options.map((v) => (
            <DPFilterChip
              key={v.id}
              label={v.label}
              active={vehicleType === v.id}
              disabled={v.disabled}
              onPress={() => chooseVehicle(v.id, v.cap)}
            />
          ))}
        </View>

        <AppText style={styles.fieldLabel}>
          Max orders at once (capped by vehicle): {capacity} of {capacityCap}
        </AppText>
        <View style={styles.stepper}>
          <DPButton
            label="Decrease capacity"
            iconOnly
            icon={<Minus size={ms(16)} color={DELIVERY.brand} strokeWidth={2} />}
            size="sm"
            variant="outline"
            fullWidth={false}
            onPress={() => {
              setSaved(false);
              setCapacity((c) => Math.max(minCapacity, c - 1));
            }}
            disabled={capacity <= minCapacity}
            accessibilityLabel="Decrease capacity"
          />
          <AppText style={styles.stepValue}>{capacity}</AppText>
          <DPButton
            label="Increase capacity"
            iconOnly
            icon={<Plus size={ms(16)} color={DELIVERY.brand} strokeWidth={2} />}
            size="sm"
            variant="outline"
            fullWidth={false}
            onPress={() => {
              setSaved(false);
              setCapacity((c) => Math.min(capacityCap, c + 1));
            }}
            disabled={capacity >= capacityCap}
            accessibilityLabel="Increase capacity"
          />
        </View>

        <DPField
          label="Hub zone"
          value={hubZone}
          onChangeText={(value) => {
            setSaved(false);
            setHubZone(value);
          }}
          placeholder="e.g. Madhapur"
          autoCapitalize="words"
        />

        {saveError ? <AppText style={styles.saveError}>{saveError}</AppText> : null}
        {saved && !dirty ? <AppText style={styles.saved}>Saved</AppText> : null}

        <DPButton label="Save changes" onPress={() => void save()} disabled={!canSave} loading={saving} />
      </DPSectionCard>
    </DPPage>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: vs(12) },
  fieldLabel: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(4) },
  chips: { flexDirection: 'row', gap: hs(8), flexWrap: 'wrap', marginTop: vs(8) },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: hs(12), marginTop: vs(8) },
  stepValue: { ...DP_TYPE.title, color: DELIVERY.ink, minWidth: hs(28), textAlign: 'center' },
  saveError: { ...DP_TYPE.caption, color: DELIVERY.danger, marginTop: vs(8) },
  saved: { ...DP_TYPE.caption, color: DELIVERY.success, marginTop: vs(8) },
});
