import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { DPPage, DPPageHeader, DPButton, DPField, DPSectionCard } from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import {
  consumeAutoVerifiedOtp,
  sendOtp,
  subscribeOtpAutoVerified,
  verifyOtp,
  type FirebaseSession,
} from '@/services/firebaseAuth';
import { gateway, GatewayHttpError } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { useSmsUserConsent } from '@/lib/smsUserConsent';
import { ms, vs } from '@/utils/responsive';
import type { DeliveryPartnerStackParamList } from '../navigation';
import { resetToTab } from '../navigationRoutes';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'OtpVerify'>;

export function OtpVerifyScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const login = useAuthStore((s) => s.login);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const submitRef = useRef(false);
  const autoSubmittedRef = useRef<string | null>(null);

  const handleSmsCode = useCallback((smsCode: string) => {
    if (submitRef.current) return;
    setError(null);
    setCode(smsCode);
  }, []);
  const { restart: restartSmsConsent, stop: stopSmsConsent } = useSmsUserConsent(handleSmsCode, !verifying);

  const completeSignIn = useCallback(
    async (session: FirebaseSession) => {
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
        if (rider.status === 'ACTIVE') resetToTab(navigation, 'Dashboard');
        else navigation.replace('SubmissionSuccess');
      } catch (err) {
        if (err instanceof GatewayHttpError && err.status === 404) {
          navigation.replace('Register');
          return;
        }
        throw err;
      }
    },
    [login, navigation, phone, setRider],
  );

  const onVerify = useCallback(async () => {
    if (submitRef.current || code.length !== 6) return;
    submitRef.current = true;
    setError(null);
    setVerifying(true);
    try {
      const session = await verifyOtp(phone, code);
      await completeSignIn(session);
    } catch (err) {
      submitRef.current = false;
      setError(err instanceof Error ? err.message : 'Incorrect OTP. Try again.');
    } finally {
      setVerifying(false);
    }
  }, [code, completeSignIn, phone]);

  const applyAutoVerified = useCallback(() => {
    const session = consumeAutoVerifiedOtp(phone);
    if (!session || submitRef.current) return;
    submitRef.current = true;
    setError(null);
    setVerifying(true);
    void completeSignIn(session)
      .catch((err: unknown) => {
        submitRef.current = false;
        setError(err instanceof Error ? err.message : 'Could not load your rider profile. Try again.');
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [completeSignIn, phone]);

  useEffect(() => {
    applyAutoVerified();
    return subscribeOtpAutoVerified(applyAutoVerified);
  }, [applyAutoVerified]);

  useEffect(() => {
    if (code.length !== 6) {
      autoSubmittedRef.current = null;
      return;
    }
    if (autoSubmittedRef.current === code || verifying || resending) return;
    autoSubmittedRef.current = code;
    void onVerify();
  }, [code, onVerify, resending, verifying]);

  const onResend = useCallback(async () => {
    if (resending || verifying) return;
    setError(null);
    setCode('');
    submitRef.current = false;
    autoSubmittedRef.current = null;
    setResending(true);
    // Re-arm before the resend SMS leaves the server.
    restartSmsConsent();
    try {
      await sendOtp(phone);
    } catch (err) {
      stopSmsConsent();
      setError(err instanceof Error ? err.message : 'Could not resend the OTP.');
    } finally {
      setResending(false);
    }
  }, [phone, restartSmsConsent, resending, stopSmsConsent, verifying]);

  return (
    <DPPage contentStyle={styles.body} keyboardAvoiding>
      <DPPageHeader
        kicker="Verification"
        title="Verify your number"
        description={`Enter the 6-digit code sent to +91 ${phone}.`}
      />
      <DPSectionCard>
        <DPField
          label="OTP"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          placeholder="••••••"
          maxLength={6}
          editable={!verifying}
          error={error}
          inputStyle={styles.otp}
        />
        <DPButton
          label="Verify & continue"
          onPress={() => void onVerify()}
          disabled={code.length !== 6 || verifying}
          loading={verifying}
        />
        <TouchableOpacity
          onPress={() => void onResend()}
          disabled={resending || verifying}
          style={styles.resend}
          accessibilityRole="button"
        >
          <AppText style={styles.resendText}>{resending ? 'Sending...' : 'Resend OTP'}</AppText>
        </TouchableOpacity>
      </DPSectionCard>
      <TouchableOpacity
        onPress={() => {
          if (!verifying) navigation.replace('PhoneEntry');
        }}
        disabled={verifying}
        style={styles.back}
        accessibilityRole="button"
      >
        <AppText style={styles.backText}>Change number</AppText>
      </TouchableOpacity>
    </DPPage>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: vs(28) },
  otp: { fontSize: ms(24), letterSpacing: 10, textAlign: 'center', fontWeight: '600' },
  resend: { minHeight: DELIVERY.touch.min, alignItems: 'center', justifyContent: 'center', marginTop: vs(8) },
  resendText: { fontSize: DP_TYPE.label.fontSize, fontWeight: '600', color: DELIVERY.brand },
  back: { minHeight: DELIVERY.touch.min, alignItems: 'center', justifyContent: 'center', marginTop: vs(12) },
  backText: { fontSize: DP_TYPE.caption.fontSize, fontWeight: '500', color: DELIVERY.inkMuted },
});