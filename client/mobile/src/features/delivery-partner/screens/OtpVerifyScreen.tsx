import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { Card, DP, ErrorText, Field, PrimaryButton, Screen } from '../components';
import { sendOtp, verifyOtp } from '@/services/firebaseAuth';
import { gateway, GatewayHttpError } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { hs, ms, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'OtpVerify'>;

export function OtpVerifyScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const login = useAuthStore((s) => s.login);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);

  const onVerify = useCallback(async () => {
    if (code.length !== 6) return;
    setError(null);
    setVerifying(true);
    try {
      const session = await verifyOtp(phone, code);
      await login({
        user: {
          id: session.user.uid,
          name: session.user.phoneNumber || phone,
          email: session.user.email || '',
          phone: session.user.phoneNumber || phone,
        },
        accessToken: session.accessToken,
      });
      try {
        const rider = await gateway.getDeliveryPartnerMe();
        setRider(rider);
        navigation.replace(rider.status === 'ACTIVE' ? 'Dashboard' : 'Status');
      } catch (err) {
        if (err instanceof GatewayHttpError && err.status === 404) {
          navigation.replace('Register');
        } else {
          setError('Could not load your rider profile. Try again.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect OTP. Try again.');
    } finally {
      setVerifying(false);
    }
  }, [code, login, navigation, phone, setRider]);

  const onResend = useCallback(async () => {
    setError(null);
    setResending(true);
    try {
      await sendOtp(phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the OTP.');
    } finally {
      setResending(false);
    }
  }, [phone]);

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <AppText style={styles.title}>Verify your number</AppText>
          <AppText style={styles.subtitle}>Enter the 6-digit code sent to +91 {phone}.</AppText>
          <Card style={styles.card}>
            <Field
              label="OTP"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              placeholder="••••••"
              maxLength={6}
              style={styles.otp}
            />
            <ErrorText>{error}</ErrorText>
            <PrimaryButton
              label="Verify & continue"
              onPress={onVerify}
              disabled={code.length !== 6}
              loading={verifying}
            />
            <TouchableOpacity onPress={onResend} disabled={resending} style={styles.resend}>
              <AppText style={styles.resendText}>{resending ? 'Sending…' : 'Resend OTP'}</AppText>
            </TouchableOpacity>
          </Card>
          <TouchableOpacity onPress={() => navigation.replace('PhoneEntry')} style={styles.back}>
            <AppText style={styles.backText}>Change number</AppText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: hs(20), paddingTop: vs(40) },
  title: { fontSize: ms(26), fontWeight: '900', color: DP.ink },
  subtitle: { fontSize: ms(14), color: DP.muted, marginTop: vs(8), marginBottom: vs(20) },
  card: { paddingVertical: vs(20) },
  otp: { fontSize: ms(24), letterSpacing: 10, textAlign: 'center' },
  resend: { alignItems: 'center', marginTop: vs(16) },
  resendText: { fontSize: ms(12), fontWeight: '800', color: DP.brand },
  back: { alignItems: 'center', marginTop: vs(20) },
  backText: { fontSize: ms(12), fontWeight: '700', color: DP.muted },
});
