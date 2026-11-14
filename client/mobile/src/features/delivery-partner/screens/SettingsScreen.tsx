import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import {
  DPPage,
  DPPageHeader,
  DPSectionCard,
  DPToggle,
  DPListRow,
  DPKeyValueRow,
  DPButton,
} from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { APP_VERSION } from '@/lib/config';
import { gateway } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { useDeliverySettingsStore } from '@/state/deliverySettingsStore';
import { vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const rider = useDeliveryPartnerStore((s) => s.rider);
  const reset = useDeliveryPartnerStore((s) => s.reset);
  const logout = useAuthStore((s) => s.logout);
  const vibrateOnOffer = useDeliverySettingsStore((s) => s.vibrateOnOffer);
  const hydrateSettings = useDeliverySettingsStore((s) => s.hydrate);
  const setVibrateOnOffer = useDeliverySettingsStore((s) => s.setVibrateOnOffer);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await gateway.getDeliveryPartnerMe();
    } catch {
      // Non-fatal; the displayed profile comes from the store.
    } finally {
      setLoading(false);
    }
  }, []);

  const openSystemSettings = useCallback(() => {
    void Linking.openSettings().catch(() => undefined);
  }, []);

  const onLogout = useCallback(async () => {
    await logout();
    reset();
    navigation.replace('PhoneEntry');
  }, [logout, navigation, reset]);

  return (
    <DPPage refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button">
        <AppText style={styles.backText}>← Back</AppText>
      </TouchableOpacity>
      <DPPageHeader kicker="Settings" title="Preferences" />

      <DPSectionCard style={styles.card} title="Account">
        <DPKeyValueRow label="Name" value={rider?.fullName || '—'} />
        <DPKeyValueRow label="Phone" value={rider?.phone || '—'} />
        <DPKeyValueRow label="Vehicle" value={rider ? rider.vehicleType.replace(/_/g, ' ').toLowerCase() : '—'} />
        <DPKeyValueRow label="Bank account" value="Reviewed by Faazio admin" />
      </DPSectionCard>

      <DPSectionCard style={styles.card} title="Notifications">
        <DPToggle
          label="Vibrate on new offer"
          description="Haptic alert when a delivery offer arrives while the app is open."
          value={vibrateOnOffer}
          onValueChange={(next) => void setVibrateOnOffer(next)}
        />
        <DPListRow
          title="System notification settings"
          subtitle="Open Android settings to manage push permission"
          onPress={openSystemSettings}
        />
      </DPSectionCard>

      <DPSectionCard style={styles.card} title="About">
        <DPKeyValueRow label="App" value="Faazio Delivery Partner" />
        <DPKeyValueRow label="Version" value={APP_VERSION} />
        <DPKeyValueRow label="Platform" value={Platform.OS} />
      </DPSectionCard>

      <DPButton label="Sign out" variant="outline" onPress={() => void onLogout()} style={styles.signOut} />
    </DPPage>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: vs(8), paddingBottom: vs(4) },
  backText: { ...DP_TYPE.label, color: DELIVERY.brand, fontWeight: '600' },
  card: { marginBottom: vs(12) },
  signOut: { marginTop: vs(8) },
});