import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { FaazioLogo } from '@/components/FaazioLogo';
import { Card, DP, ErrorText, Field, PrimaryButton, Screen } from '../components';
import { sendOtp } from '@/services/firebaseAuth';
import { GatewayHttpError, gateway } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { hs, ms, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'PhoneEntry'>;

function validPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 && /^[6-9]/.test(digits);
}

/** Resolve an existing online session straight to its rider status (cold-start convenience). */
function routeForStatus(status: string): 'Dashboard' | 'Status' {
  return status === 'ACTIVE' ? 'Dashboard' : 'Status';
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
    if (hydrated && isAuthenticated) void resume();
  }, [hydrated, isAuthenticated, resume]);

  const onSend = useCallback(async () => {
    setError(null);
    if (!validPhone(phone)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setSending(true);
    try {
      await sendOtp(phone);
      setStorePhone(phone);
      navigation.navigate('OtpVerify', { phone });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the OTP. Try again.');
    } finally {
      setSending(false);
    }
  }, [navigation, phone, setStorePhone]);

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <FaazioLogo size={30} />
            </View>
            <AppText style={styles.kicker}>Faazio</AppText>
            <AppText style={styles.title}>Delivery Partner</AppText>
            <AppText style={styles.subtitle}>
              Earn on your schedule. Verify your documents once, then go online and accept orders.
            </AppText>
          </View>

          <Card>
            <Field
              label="Mobile number"
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/[^\d]/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              maxLength={10}
            />
            <ErrorText>{error}</ErrorText>
            <PrimaryButton
              label="Get OTP"
              onPress={onSend}
              disabled={!validPhone(phone) || checking}
              loading={sending || checking}
            />
          </Card>

          <AppText style={styles.terms}>
            By continuing you agree to the Faazio Delivery Partner terms, including independent-contractor
            status and lawful assistance to police with an official request.
          </AppText>

          {isAuthenticated ? (
            <TouchableOpacity onPress={() => void resume()} style={styles.linkWrap}>
              <AppText style={styles.link}>Continue with the signed-in account</AppText>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: hs(20), paddingBottom: vs(32) },
  brand: { marginTop: vs(28), marginBottom: vs(24) },
  logo: { marginBottom: vs(16) },
  kicker: { fontSize: ms(12), fontWeight: '900', color: DP.brand, textTransform: 'uppercase', letterSpacing: 1.4 },
  title: { fontSize: ms(30), fontWeight: '900', color: DP.ink, marginTop: vs(4) },
  subtitle: { fontSize: ms(14), lineHeight: ms(21), color: DP.muted, marginTop: vs(8) },
  terms: { fontSize: ms(11), lineHeight: ms(16), color: DP.muted, marginTop: vs(16) },
  linkWrap: { marginTop: vs(18), alignItems: 'center' },
  link: { fontSize: ms(12), fontWeight: '800', color: DP.brand },
});
