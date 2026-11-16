import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, type TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import AppText from '@/components/AppText';
import { DPPage, DPButton, DPField, DPSectionCard } from '@/components/shared/dp';
import { DELIVERY, DP_TYPE } from '@/theme/deliveryTokens';
import { sendOtp } from '@/services/firebaseAuth';
import { armSmsUserConsent, disarmSmsUserConsent } from '@/lib/smsUserConsent';
import { otpErrorMessage } from '@/lib/otpError';
import { formatAsYouType, nationalDigits, toE164 } from '@/lib/phone';
import { getRecentPhones, saveRecentPhone } from '@/lib/recentPhones';
import { GatewayHttpError, gateway } from '@/services/api/GatewayClient';
import { useAuthStore } from '@/state/authStore';
import { useDeliveryPartnerStore } from '@/state/deliveryPartnerStore';
import { hs, vs } from '@/utils/responsive';
import { DpAuthHero } from '../components/DpAuthHero';
import type { DeliveryPartnerStackParamList } from '../navigation';
import { resetToTab } from '../navigationRoutes';

type Props = NativeStackScreenProps<DeliveryPartnerStackParamList, 'PhoneEntry'>;

/** India-only entry: the dial code is fixed and a 10-digit national number auto-advances. */
const COUNTRY_DIAL = '+91';
/** Delay before a 10th digit auto-sends the OTP, matching the customer LoginScreen. */
const PHONE_ADVANCE_MS = 150;

function validPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 && /^[6-9]/.test(digits);
}

function recentLabel(e164: string): string {
  return `${COUNTRY_DIAL} ${formatAsYouType(nationalDigits(e164))}`;
}

export function PhoneEntryScreen({ navigation }: Props) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentPhones, setRecentPhones] = useState<string[]>([]);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setStorePhone = useDeliveryPartnerStore((s) => s.setPhone);
  const setRider = useDeliveryPartnerStore((s) => s.setRider);
  const [checking, setChecking] = useState(false);
  const isFocused = useIsFocused();
  const phoneInputRef = useRef<TextInput>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resume = useCallback(async () => {
    setChecking(true);
    try {
      const rider = await gateway.getDeliveryPartnerMe();
      setRider(rider);
      // Resolve an existing session straight to its rider status (cold-start convenience).
      if (rider.status === 'ACTIVE') resetToTab(navigation, 'Dashboard');
      else navigation.replace('SubmissionSuccess');
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

  useEffect(() => {
    // Focus after the navigation transition settles; retry once if Android dismissed the keyboard.
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      phoneInputRef.current?.focus();
      if (phoneInputRef.current && !phoneInputRef.current.isFocused()) {
        retryTimer = setTimeout(() => phoneInputRef.current?.focus(), 200);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => () => {
    if (advanceRef.current) clearTimeout(advanceRef.current);
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    void getRecentPhones().then((list) => {
      if (active) setRecentPhones(list);
    });
    return () => {
      active = false;
    };
  }, [isFocused]);

  const sendOtpFor = useCallback(
    async (digits: string) => {
      // A manual tap owns the send; cancel any pending auto-advance so it cannot double-fire.
      if (advanceRef.current) {
        clearTimeout(advanceRef.current);
        advanceRef.current = null;
      }
      if (sending) return;
      if (!validPhone(digits)) {
        setError('Enter a valid 10-digit mobile number.');
        return;
      }
      setError(null);
      setSending(true);
      // Start listening before the SMS is sent; the OTP screen attaches the listener on mount.
      armSmsUserConsent();
      try {
        await sendOtp(digits);
        setStorePhone(digits);
        // Remember the number so it can be suggested on the next signed-out visit.
        await saveRecentPhone(toE164(digits));
        navigation.navigate('OtpVerify', { phone: digits });
      } catch (err) {
        disarmSmsUserConsent();
        setError(otpErrorMessage(err, 'Could not send the OTP. Try again.'));
      } finally {
        setSending(false);
      }
    },
    [navigation, sending, setStorePhone],
  );

  const handlePhoneChange = useCallback(
    (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, 10);
      setPhone(digits);
      setError(null);
      if (advanceRef.current) {
        clearTimeout(advanceRef.current);
        advanceRef.current = null;
      }
      // India-only entry: a complete 10-digit number auto-advances to the OTP screen.
      if (digits.length === 10 && !sending && !checking) {
        advanceRef.current = setTimeout(() => {
          advanceRef.current = null;
          void sendOtpFor(digits);
        }, PHONE_ADVANCE_MS);
      }
    },
    [checking, sendOtpFor, sending],
  );

  const onPickRecent = useCallback(
    (e164: string) => {
      const digits = nationalDigits(e164);
      if (digits) handlePhoneChange(digits);
    },
    [handlePhoneChange],
  );

  return (
    <DPPage contentStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardAvoiding>
      <DpAuthHero headline="Delivery Partner" />

      <DPSectionCard>
        <DPField
          inputRef={phoneInputRef}
          label="Mobile number"
          prefix={COUNTRY_DIAL}
          value={phone}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder="10-digit mobile number"
          maxLength={10}
          error={error}
        />

        {recentPhones.length > 0 && phone.length === 0 ? (
          <View style={styles.recentWrap}>
            <AppText style={styles.recentLabel}>Recent numbers</AppText>
            <View style={styles.recentRow}>
              {recentPhones.map((e164) => (
                <TouchableOpacity
                  key={e164}
                  style={styles.chip}
                  onPress={() => onPickRecent(e164)}
                  disabled={sending || checking}
                  accessibilityRole="button"
                  accessibilityLabel={`Use number ${recentLabel(e164)}`}
                >
                  <AppText style={styles.chipText}>{recentLabel(e164)}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        <DPButton
          label="Get OTP"
          onPress={() => void sendOtpFor(phone)}
          disabled={!validPhone(phone) || checking || sending}
          loading={sending || checking}
        />
      </DPSectionCard>
    </DPPage>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: vs(16) },
  recentWrap: { marginBottom: vs(12) },
  recentLabel: {
    ...DP_TYPE.micro,
    color: DELIVERY.inkMuted,
    marginBottom: vs(8),
  },
  recentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: hs(8) },
  chip: {
    minHeight: DELIVERY.touch.min,
    justifyContent: 'center',
    paddingHorizontal: hs(14),
    borderRadius: DELIVERY.radius.pill,
    borderWidth: 1,
    borderColor: DELIVERY.border,
    backgroundColor: DELIVERY.surfaceAlt,
  },
  chipText: { ...DP_TYPE.label, color: DELIVERY.ink, fontWeight: '600' },
});
