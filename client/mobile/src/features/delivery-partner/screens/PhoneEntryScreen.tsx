import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import { DPPage, DPPageHeader, DPButton, DPField, DPSectionCard } from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { sendOtp } from '@/services/firebaseAuth';
import { armSmsUserConsent, disarmSmsUserConsent } from '@/lib/smsUserConsent';
import { GatewayHttpError, gateway } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { hs, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'PhoneEntry'>;

function validPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 && /^[6-9]/.test(digits);
}

/** Resolve an existing online session straight to its rider status (cold-start convenience). */
function routeForStatus(status: string): 'Dashboard' | 'SubmissionSuccess' {
  return status === 'ACTIVE' ? 'Dashboard' : 'SubmissionSuccess';
}

export function PhoneEntryScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setStorePhone = useDeliveryPartnerStore((s) => s.setPhone);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const [checking, setChecking] = useState(false);
  const isFocused = useIsFocused();

  const resume = useCallback(async () => {
    setChecking(true);
    try {
      const rider = await gateway.getDeliveryPartnerMe();
      setRider(rider);
      navigation.replace(routeForStatus(rider.status));
    } catch (err) {
      if (err instanceof GatewayHttpError && err.status === 404) {
        navigation.replace('Register');
      }
      // Offline or any other error — stay on phone entry and let the rider retry.
    } finally {
      setChecking(false);
    }
  }, [navigation, setRider]);

  useEffect(() => {
    // Only the focused screen may navigate; otherwise OtpVerify's login would re-fire this resume
    // from the still-mounted PhoneEntry route and race a duplicate Dashboard/Register replace.
    if (isFocused && hydrated && isAuthenticated) void resume();
  }, [hydrated, isAuthenticated, isFocused, resume]);

  const onSend = useCallback(async () => {
    setError(null);
    if (!validPhone(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setSending(true);
    // Start listening before the SMS is sent; the OTP screen attaches the listener on mount.
    armSmsUserConsent();
    try {
      await sendOtp(phone);
      setStorePhone(phone);
      navigation.navigate('OtpVerify', { phone });
    } catch (err) {
      disarmSmsUserConsent();
      setError(err instanceof Error ? err.message : 'Could not send the OTP. Try again.');
    } finally {
      setSending(false);
    }
  }, [navigation, phone, setStorePhone]);

  return (
    <DPPage contentStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardAvoiding>
      <DPPageHeader
        leading={<FaazioLogo size={30} />}
        kicker="Faazio"
        title="Delivery Partner"
        description="Earn on your schedule. Verify your documents once, then go online and accept orders."
      />

      <DPSectionCard>
        <DPField
          label="Mobile number"
          value={phone}
          onChangeText={(v) => setPhone(v.replace(/[^\d]/g, '').slice(0, 10))}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder="10-digit mobile number"
          maxLength={10}
          error={error}
        />
        <DPButton
          label="Get OTP"
          onPress={() => void onSend()}
          disabled={!validPhone(phone) || checking}
          loading={sending || checking}
        />
      </DPSectionCard>

      <AppText style={styles.terms}>
        By continuing you agree to the Faazio Delivery Partner terms, including independent-contractor
        status and lawful assistance to police with an official request.
      </AppText>

      {isAuthenticated ? (
        <TouchableOpacity onPress={() => void resume()} style={styles.linkWrap} accessibilityRole="button">
          <AppText style={styles.link}>Continue with the signed-in account</AppText>
        </TouchableOpacity>
      ) : null}
    </DPPage>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: vs(20) },
  terms: { ...DP_TYPE.caption, color: DELIVERY.inkMuted, marginTop: vs(16) },
  linkWrap: { minHeight: DELIVERY.touch.min, justifyContent: 'center', alignItems: 'center', marginTop: vs(12) },
  link: { fontSize: DP_TYPE.label.fontSize, fontWeight: '600', color: DELIVERY.brand },
});