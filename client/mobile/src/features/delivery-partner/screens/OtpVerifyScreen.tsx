import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, StyleSheet, TouchableOpacity, View, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AppText from '@/components/AppText';
import AppTextInput from '@/components/AppTextInput';
import { DPPage, DPButton, DPSectionCard } from '@/components/shared/dp';
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
import { otpErrorCode, otpErrorMessage } from '@/lib/otpError';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ms, vs } from '@/utils/responsive';
import { DpAuthHero } from '../components/DpAuthHero';
import type { DeliveryPartnerStackParamList } from '../navigation';
import { resetToTab } from '../navigationRoutes';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'OtpVerify'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

/**
 * A rider-profile load failure happens after Firebase has already accepted the code, so this copy
 * must never blame the OTP. The verified session is kept and the screen offers Retry instead of
 * asking for a new code.
 */
function profileErrorMessage(err: unknown): string {
  if (err instanceof GatewayHttpError && err.status >= 500) {
    return "You're signed in, but your rider profile could not load. Tap Retry.";
  }
  return "You're signed in, but we couldn't load your rider profile. Check your connection and tap Retry.";
}

export function OtpVerifyScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  // A code was just sent before this screen mounted, so the cooldown starts full.
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_S);
  // Firebase already accepted the code but the rider profile has not loaded yet. Keeping the
  // session means Retry never asks for another OTP.
  const [verifiedSession, setVerifiedSession] = useState<FirebaseSession | null>(null);
  const profilePending = verifiedSession !== null;
  const login = useAuthStore((s) => s.login);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const reduceMotion = useReducedMotion();
  const submitRef = useRef(false);
  const autoSubmittedRef = useRef<string | null>(null);
  const otpInputRef = useRef<TextInput>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const digitAnimsRef = useRef<Animated.Value[] | null>(null);
  if (!digitAnimsRef.current) {
    digitAnimsRef.current = Array.from({ length: OTP_LENGTH }, () => new Animated.Value(1));
  }
  const digitAnims = digitAnimsRef.current;
  const prevOtpLength = useRef(0);

  const handleSmsCode = useCallback((smsCode: string) => {
    if (submitRef.current || verifiedSession) return;
    setError(null);
    setCode(smsCode);
  }, [verifiedSession]);
  const { restart: restartSmsConsent, stop: stopSmsConsent } = useSmsUserConsent(
    handleSmsCode,
    !verifying && !profilePending,
  );

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      otpInputRef.current?.focus();
      if (otpInputRef.current && !otpInputRef.current.isFocused()) {
        retryTimer = setTimeout(() => otpInputRef.current?.focus(), 200);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -5, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, shakeAnim]);

  useEffect(() => {
    if (!reduceMotion) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [pulseAnim, reduceMotion]);

  useEffect(() => {
    if (error) {
      digitAnims.forEach((anim) => anim.setValue(1));
      prevOtpLength.current = code.length;
      triggerShake();
    }
    // Re-run only when the error message changes; digit/code refs are read intentionally.
  }, [error]);

  useEffect(() => {
    if (code.length > prevOtpLength.current) {
      const newIdx = prevOtpLength.current;
      if (newIdx < OTP_LENGTH) {
        digitAnims[newIdx].setValue(0);
        Animated.spring(digitAnims[newIdx], {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }).start();
      }
    } else if (code.length < prevOtpLength.current) {
      const removedIdx = prevOtpLength.current - 1;
      if (removedIdx >= 0 && removedIdx < OTP_LENGTH) digitAnims[removedIdx].setValue(1);
    }
    prevOtpLength.current = code.length;
  }, [code, digitAnims]);

  const loadRider = useCallback(
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

  // The code is already verified; a profile-load failure leaves the session live so the user can
  // retry the read instead of being sent back to the OTP step.
  const completeSignIn = useCallback(
    async (session: FirebaseSession) => {
      try {
        await loadRider(session);
      } catch (err) {
        setVerifiedSession(session);
        throw err;
      }
    },
    [loadRider],
  );

  const retryProfile = useCallback(async () => {
    if (!verifiedSession) return;
    setError(null);
    setVerifying(true);
    try {
      await loadRider(verifiedSession);
    } catch (err) {
      setError(profileErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  }, [loadRider, verifiedSession]);

  const onVerify = useCallback(async () => {
    if (submitRef.current || code.length !== OTP_LENGTH) return;
    submitRef.current = true;
    setError(null);
    setVerifying(true);
    let session: FirebaseSession;
    try {
      session = await verifyOtp(phone, code);
    } catch (err) {
      // A rejected code is the only failure that is actually an OTP problem. Anything without an
      // `auth/*` code means the pending verification was lost (e.g. a reload or a second tap) —
      // say so instead of blaming the digits with the generic fallback.
      submitRef.current = false;
      setVerifying(false);
      setError(
        otpErrorCode(err)
          ? otpErrorMessage(err, 'Incorrect OTP. Try again.')
          : 'That verification expired. Tap "Resend OTP" to get a new code.',
      );
      return;
    }
    // The code is accepted and the session is live; only the rider-profile load can now fail.
    try {
      await completeSignIn(session);
    } catch (err) {
      submitRef.current = false;
      setError(profileErrorMessage(err));
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
        setError(profileErrorMessage(err));
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
    if (verifiedSession) return;
    if (code.length !== OTP_LENGTH) {
      autoSubmittedRef.current = null;
      return;
    }
    if (autoSubmittedRef.current === code || verifying || resending) return;
    autoSubmittedRef.current = code;
    void onVerify();
  }, [code, onVerify, resending, verifiedSession, verifying]);

  const handleOtpChange = useCallback((value: string) => {
    // The code is already accepted; keep the digits and let Retry re-run the profile read.
    if (verifiedSession) return;
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length < OTP_LENGTH) {
      submitRef.current = false;
      setVerifying(false);
    }
  }, [verifiedSession]);

  const onResend = useCallback(async () => {
    if (verifiedSession || resending || verifying || resendCooldown > 0) return;
    setError(null);
    setCode('');
    submitRef.current = false;
    autoSubmittedRef.current = null;
    setResendCooldown(RESEND_COOLDOWN_S);
    setResending(true);
    // Re-arm before the resend SMS leaves the server.
    restartSmsConsent();
    try {
      await sendOtp(phone);
    } catch (err) {
      stopSmsConsent();
      setError(otpErrorMessage(err, 'Could not resend the OTP. Try again.'));
    } finally {
      setResending(false);
    }
  }, [phone, restartSmsConsent, resendCooldown, resending, stopSmsConsent, verifiedSession, verifying]);

  const goBackToPhoneEntry = useCallback(() => {
    // Never abandon the screen mid-verification; the in-flight `verifyOtp` would still navigate.
    if (verifying) return;
    setVerifiedSession(null);
    // PhoneEntry stays mounted below in the stack, so its typed number is preserved.
    navigation.goBack();
  }, [navigation, verifying]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (verifying) return true; // swallow back while a verification is in flight
        return false; // default pop → PhoneEntry (number preserved)
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [verifying]),
  );

  const resendDisabled = profilePending || resending || verifying || resendCooldown > 0;

  return (
    <DPPage contentStyle={styles.body} keyboardAvoiding>
      <DpAuthHero
        headline="Verify your number"
        description={`Enter the 6-digit code sent to +91 ${phone}`}
      />
      <DPSectionCard>
        <AppText style={styles.label}>OTP</AppText>
        <TouchableOpacity
          style={[styles.otpField, error ? styles.otpFieldError : null]}
          activeOpacity={1}
          onPress={() => otpInputRef.current?.focus()}
          accessibilityRole="none"
        >
          <AppTextInput
            ref={otpInputRef}
            style={styles.hiddenOtpInput}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            value={code}
            onChangeText={handleOtpChange}
            caretHidden
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            editable={!verifying && !profilePending}
            accessibilityLabel="Enter the 6-digit code"
            accessibilityHint="The code was sent to your phone"
            accessibilityValue={{ text: `${code.length} of ${OTP_LENGTH} digits entered` }}
          />

          <View style={styles.segmentsRow}>
            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
              const digit = code[index];
              const isCurrent = index === code.length;
              const isFilled = digit !== undefined;
              const digitAnim = digitAnims[index];
              return (
                <View key={index} style={styles.segmentColumn}>
                  <View style={styles.segmentDigitContainer}>
                    {isFilled ? (
                      <Animated.View
                        style={{
                          opacity: digitAnim,
                          transform: [
                            {
                              scale: digitAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.8, 1],
                              }),
                            },
                          ],
                        }}
                      >
                        <AppText style={styles.segmentDigit}>{digit}</AppText>
                      </Animated.View>
                    ) : (
                      <AppText style={styles.segmentDot}>•</AppText>
                    )}
                  </View>
                  <Animated.View
                    style={[
                      styles.segmentTrack,
                      error
                        ? styles.segmentTrackError
                        : isFilled
                          ? styles.segmentTrackFilled
                          : isCurrent
                            ? [styles.segmentTrackCurrent, { opacity: pulseAnim }]
                            : styles.segmentTrackDefault,
                      error && !isFilled && !isCurrent ? { transform: [{ translateX: shakeAnim }] } : {},
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </TouchableOpacity>

        {error ? (
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <AppText style={styles.error}>{error}</AppText>
          </Animated.View>
        ) : null}

        <DPButton
          label={profilePending ? 'Retry' : 'Verify & continue'}
          onPress={() => void (profilePending ? retryProfile() : onVerify())}
          disabled={profilePending ? verifying : code.length !== OTP_LENGTH || verifying}
          loading={verifying}
        />
        <TouchableOpacity
          onPress={() => void onResend()}
          disabled={resendDisabled}
          style={styles.resend}
          accessibilityRole="button"
          accessibilityLabel={
            profilePending
              ? 'Resend OTP unavailable until the rider profile loads'
              : resendCooldown > 0
                ? `Resend OTP in ${resendCooldown} seconds`
                : 'Resend OTP'
          }
          accessibilityState={{ disabled: resendDisabled }}
        >
          <AppText style={styles.resendText}>
            {resending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
          </AppText>
        </TouchableOpacity>
      </DPSectionCard>
      <TouchableOpacity
        onPress={goBackToPhoneEntry}
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
  body: { paddingTop: vs(16) },
  label: {
    ...DP_TYPE.micro,
    color: DELIVERY.inkMuted,
    marginBottom: vs(6),
  },
  otpField: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: Math.max(DELIVERY.touch.min, vs(48)),
    paddingVertical: vs(8),
    borderRadius: DELIVERY.radius.md,
    borderWidth: 1,
    borderColor: DELIVERY.border,
    backgroundColor: DELIVERY.card,
    marginBottom: vs(12),
  },
  otpFieldError: { borderColor: DELIVERY.danger },
  hiddenOtpInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
  },
  segmentsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: ms(8),
  },
  segmentColumn: { alignItems: 'center', width: Math.max(36, ms(38)) },
  segmentDigitContainer: { height: vs(40), justifyContent: 'center', alignItems: 'center' },
  segmentDigit: { ...DP_TYPE.code, color: DELIVERY.ink },
  segmentDot: { ...DP_TYPE.micro, fontWeight: '600', color: DELIVERY.border },
  segmentTrack: { height: vs(5), borderRadius: ms(3), width: '100%', marginTop: vs(2) },
  segmentTrackDefault: { backgroundColor: DELIVERY.border, opacity: 0.7 },
  segmentTrackCurrent: { backgroundColor: DELIVERY.brand },
  segmentTrackFilled: { backgroundColor: DELIVERY.brand },
  segmentTrackError: { backgroundColor: DELIVERY.danger },
  error: { ...DP_TYPE.caption, color: DELIVERY.danger, marginBottom: vs(12) },
  resend: { minHeight: DELIVERY.touch.min, alignItems: 'center', justifyContent: 'center', marginTop: vs(8) },
  resendText: { ...DP_TYPE.label, fontWeight: '600', color: DELIVERY.brand },
  back: { minHeight: DELIVERY.touch.min, alignItems: 'center', justifyContent: 'center', marginTop: vs(12) },
  backText: { ...DP_TYPE.caption, fontWeight: '500', color: DELIVERY.inkMuted },
});
