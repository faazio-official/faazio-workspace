import React, { useState, useRef, useEffect, useCallback } from 'react';
import { neutral } from '@/theme/brandTokens';
import { semantic } from '@/theme/brandTokens';
import { semanticTint } from '@/theme/brandTokens';
import { categorical } from '@/theme/categorical';
import { parentRamp } from '@/theme/brandTokens';
import { brandRamp } from '@/theme/brandTokens';
import { SHADOW_COLOR } from '@/theme/tokens';
import { StyleSheet, View, TouchableOpacity, Pressable, Platform, Image, Keyboard, KeyboardAvoidingView, Animated, Easing, BackHandler, ActivityIndicator } from 'react-native';
import type { TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { navigationRef } from '@/navigation/navigationRef';
import { ChevronLeft, X } from 'lucide-react-native';
import Svg, {
  Circle,
  Ellipse,
  Path,
  Polyline,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { SCREEN_W, hs, vs, ms, wp, hp, DOME_RADIUS } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import PressableScale from '@/components/shared/PressableScale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import phoneAuthBackgroundImg from '@/assets/phone_auth_background.webp';
import AppTextInput from '@/components/AppTextInput';
import AppText from '@/components/AppText';
import { useAuthStore } from '@/state/authStore';
import { useOnboardingStore } from '@/state/onboardingStore';
import { useAuthFunnelStore } from '@/state/authFunnelStore';
import { clearPendingAuthAction, consumePendingAuthAction } from '@/services/authGate';
import { openTrustedUrl } from '@/lib/externalLinks';
import { PRIVACY_URL, TERMS_URL } from '@/lib/site';
import { decodeIdToken } from '@/lib/tokenClaims';
import { formatAsYouType, isValidPhone, nationalDigits, toE164 } from '@/lib/phone';
import { getRecentPhones, saveRecentPhone } from '@/lib/recentPhones';
import {
  cancelPrimaryOtp,
  consumeAutoVerifiedOtp,
  firebaseAuthConfigured,
  sendOtp,
  subscribeOtpAutoVerified,
  verifyOtp,
  type FirebaseSession,
} from '@/services/firebaseAuth';
import { otpErrorMessage } from '@/lib/otpError';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { gateway } from '@/services/api/GatewayClient';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const GRADIENT_ID = 'loginBrandGrad';

function BrandGradient({ borderRadius = 0, diagonal = false, startOffset = '0%' }: { borderRadius?: number; diagonal?: boolean; startOffset?: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient
          id={GRADIENT_ID}
          x1="0%"
          y1="0%"
          x2={diagonal ? '100%' : '0%'}
          y2="100%"
        >
          <Stop offset="0%" stopColor={parentRamp.base} />
          <Stop offset={startOffset} stopColor={parentRamp.base} />
          <Stop offset="100%" stopColor={parentRamp.deep} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${GRADIENT_ID})`} rx={borderRadius} ry={borderRadius} />
    </Svg>
  );
}

function ScalePressable({ onPress, style, children, ...rest }: any) {
  return (
    <PressableScale onPress={onPress} style={style} {...rest}>
      {children}
    </PressableScale>
  );
}

const SmilingCoinHandIllustration = () => (
  <Svg viewBox="0 0 100 100" width={ms(88)} height={ms(88)}>
    <Circle cx="50" cy="50" r="45" fill={brandRamp.MART.base} />
    <Circle cx="50" cy="50" r="41" fill={brandRamp.MART.base} />
    <Circle cx="50" cy="50" r="38" fill={brandRamp.MART.base} />
    <Circle cx="36" cy="42" r="5" fill={neutral.ink} />
    <Circle cx="64" cy="42" r="5" fill={neutral.ink} />
    <Circle cx="34" cy="40" r="1.5" fill={neutral.card} />
    <Circle cx="62" cy="40" r="1.5" fill={neutral.card} />
    <Ellipse cx="26" cy="54" rx="7" ry="4" fill={categorical.rose} opacity={0.6} />
    <Ellipse cx="74" cy="54" rx="7" ry="4" fill={categorical.rose} opacity={0.6} />
    <Path d="M 30 60 Q 50 80 70 60" fill="none" stroke={neutral.ink} strokeWidth={4} strokeLinecap="round" />
    <Path d="M 40 68 Q 50 78 60 68" fill="none" stroke={semantic.danger} strokeWidth={3} strokeLinecap="round" />
  </Svg>
);

function RotatingSpinner({ size = 14, borderWidth = 2, color = neutral.ink }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);
  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth,
        borderColor: color,
        borderTopColor: 'transparent',
        transform: [{ rotate }],
      }}
    />
  );
}

const RESEND_COOLDOWN_S = 30;

/** Matches the gateway's profile-name bound (`PUT /profile`), so a name never fails server-side. */
const MAX_NAME_LENGTH = 80;

/** Customer phone auth is India-only; the dial code is fixed, never user-selectable. */
const COUNTRY_DIAL = '+91';

export function LoginScreen({ navigation, route }: Props) {
  const login = useAuthStore((s) => s.login);
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const markOnboardingSeen = useOnboardingStore((s) => s.markSeen);
  const setFunnelStage = useAuthFunnelStore((s) => s.setStage);
  const resumeAfterLogin = route.params?.resume === true;
  const insets = useSafeAreaInsets();

  // Hardware-back / swipe dismissal leaves the screen without a successful sign-in. Drop the
  // pending gated action so a later sign-in from another surface cannot replay a stale tap.
  useEffect(() => {
    return () => {
      if (!useAuthStore.getState().isAuthenticated) clearPendingAuthAction();
    };
  }, []);
  const reduceMotion = useReducedMotion();
  const handleOpenTerms = useCallback(() => {
    void openTrustedUrl(TERMS_URL);
  }, []);
  const handleOpenPrivacy = useCallback(() => {
    void openTrustedUrl(PRIVACY_URL);
  }, []);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  // Phone first: verifying the number tells us whether this customer already has a name, so only a
  // first-time user is asked for one. `otpState` is derived so every OTP guard reads one source.
  const [authStep, setAuthStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const otpState = authStep === 'otp';
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isFinishingName, setIsFinishingName] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [recentPhones, setRecentPhones] = useState<string[]>([]);

  const nameInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);
  const submitRef = useRef(false);
  const resendRef = useRef(false);
  // Verified Firebase session held while the (new) customer chooses a name. The session is not
  // persisted until the name is set, so abandoning the step cannot leave a signed-in unnamed user.
  const verifiedSessionRef = useRef<FirebaseSession | null>(null);
  // Synchronous guard: state (`isSending`) only flips on the next render, so two quick taps could
  // otherwise both start a native send before the spinner replaces the button.
  const sendRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const digitAnimsRef = useRef<Animated.Value[] | null>(null);
  if (!digitAnimsRef.current) {
    digitAnimsRef.current = Array.from({ length: 6 }, () => new Animated.Value(1));
  }
  const digitAnims = digitAnimsRef.current;
  const prevOtpLength = useRef(0);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      const target =
        authStep === 'otp'
          ? otpInputRef.current
          : authStep === 'phone'
            ? phoneInputRef.current
            : nameInputRef.current;
      if (!target) return;
      target.focus();
      if (!target.isFocused()) {
        retryTimer = setTimeout(() => target.focus(), 200);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [authStep]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    // Suggest previously used numbers whenever the phone step is showing.
    if (authStep !== 'phone') return;
    let active = true;
    void getRecentPhones().then((list) => {
      if (active) setRecentPhones(list);
    });
    return () => {
      active = false;
    };
  }, [authStep]);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [authStep, fadeAnim]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (reduceMotion) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, reduceMotion]);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -5, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (otpError) {
      digitAnims.forEach((a) => { if (a) a.setValue(1); });
      prevOtpLength.current = otpCode.length;
      triggerShake();
    }
  }, [otpError]);

  useEffect(() => {
    if (otpCode.length > prevOtpLength.current) {
      const newIdx = prevOtpLength.current;
      if (newIdx < 6 && digitAnims[newIdx]) {
        digitAnims[newIdx].setValue(0);
        Animated.spring(digitAnims[newIdx], {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }).start();
      }
    } else if (otpCode.length < prevOtpLength.current) {
      const removedIdx = prevOtpLength.current - 1;
      if (removedIdx >= 0 && removedIdx < 6 && digitAnims[removedIdx]) {
        digitAnims[removedIdx].setValue(1);
      }
    }
    prevOtpLength.current = otpCode.length;
  }, [otpCode, digitAnims]);

  const dial = COUNTRY_DIAL;
  const phoneE164 = toE164(phone);
  const phoneValid = isValidPhone(phone);

  /**
   * After a session is stored: a guest-gate sign-in closes back to the browsing screen it was
   * opened from and resumes the action that triggered the gate; a first-run sign-in continues
   * into the language + location onboarding chain.
   */
  const finishLoginNavigation = useCallback((): boolean => {
    if (!navigationRef.isReady()) return false;
    // A signed-in user is out of the skip funnel: a later sign-out lands on the app, not mid-funnel.
    setFunnelStage('home');
    if (resumeAfterLogin) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      // The origin screen stayed mounted under the pushed Login screen.
      setTimeout(consumePendingAuthAction, 0);
      return true;
    }
    navigation.replace('LanguageSelection');
    return true;
  }, [navigation, resumeAfterLogin, setFunnelStage]);

  /**
   * Read the customer's stored name with the freshly verified OTP token. A first-time phone-auth
   * user is provisioned with a placeholder (`hasName: false`), so the name step is shown only then;
   * a returning customer signs straight in with the name already on their profile.
   */
  const completeLogin = useCallback(
    async (session: FirebaseSession): Promise<boolean> => {
      let profileName = '';
      try {
        const profile = await gateway.getProfile(session.accessToken);
        if (profile?.hasName) profileName = profile.name.trim();
      } catch (err) {
        // An unreachable profile must not block sign-in: fall through and ask for the name.
        if (__DEV__) {
          console.warn('[phone-auth] profile lookup failed:', (err as Error)?.message);
        }
      }

      if (profileName) {
        const claims = decodeIdToken(session.accessToken);
        await login({
          user: {
            id: session.user.uid,
            name: profileName,
            email: session.user.email ?? '',
            phone: phoneE164,
            role: claims.role,
            stateCode: claims.stateCode,
            districtCode: claims.districtCode,
            sellerId: claims.sellerId,
          },
          accessToken: session.accessToken,
        });
        return finishLoginNavigation();
      }

      // No name on the account yet: keep the verified session in memory and ask for one. It is
      // only persisted once the customer submits a name.
      verifiedSessionRef.current = session;
      setName('');
      setNameError('');
      setAuthStep('name');
      return false;
    },
    [finishLoginNavigation, login, phoneE164],
  );

  /** Persist the verified session with the customer's chosen name, then finish sign-in. */
  const submitName = useCallback(async () => {
    const session = verifiedSessionRef.current;
    if (!session || isFinishingName) return;
    const typedName = name.trim();
    if (!typedName) {
      setNameError('Enter your name');
      return;
    }
    setNameError('');
    setIsFinishingName(true);
    Keyboard.dismiss();
    try {
      const claims = decodeIdToken(session.accessToken);
      // Keychain now holds the bearer, so the profile write below authenticates.
      await login({
        user: {
          id: session.user.uid,
          name: typedName,
          email: session.user.email ?? '',
          phone: phoneE164,
          role: claims.role,
          stateCode: claims.stateCode,
          districtCode: claims.districtCode,
          sellerId: claims.sellerId,
        },
        accessToken: session.accessToken,
      });
      // Best-effort on purpose: a failed write must never block a successful sign-in (the session
      // already carries the name and the next sign-in re-reads the profile).
      void gateway.updateProfileName(typedName).catch((err: unknown) => {
        if (__DEV__) {
          console.warn('[phone-auth] profile name sync failed:', (err as Error)?.message);
        }
      });
      // Keep the verified session reference until navigation succeeds so a retry can still finish
      // (the Keychain session is already persisted, so this only guards the navigation step).
      if (finishLoginNavigation()) {
        verifiedSessionRef.current = null;
      } else {
        setIsFinishingName(false);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[phone-auth] name save failed:', (err as Error)?.message);
      }
      setNameError('Could not save your name. Please try again.');
      setIsFinishingName(false);
    }
  }, [finishLoginNavigation, isFinishingName, login, name, phoneE164]);

  const submitOtp = useCallback(async () => {
    if (submitRef.current || otpCode.length !== 6 || !phoneValid) return;
    submitRef.current = true;
    setIsVerifying(true);
    Keyboard.dismiss();
    otpInputRef.current?.blur();

    try {
      if (firebaseAuthConfigured()) {
        // Real Firebase phone-OTP session: the ID token is the same bearer the gateway verifies.
        const session = await verifyOtp(phoneE164, otpCode);
        if (await completeLogin(session)) return;
      } else if (__DEV__) {
        // Dev-only fallback when Firebase Auth is unconfigured (local AUTH_DISABLED gateway).
        // Release builds never reach here — configure.js refuses to embed a mock-login build. No
        // profile read is possible with the placeholder token, so ask for the name like a new user.
        verifiedSessionRef.current = {
          accessToken: `placeholder.${phone}.${Date.now()}`,
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          user: { uid: `user_${phoneE164}`, phoneNumber: phoneE164, email: '' },
        };
        setName('');
        setNameError('');
        setAuthStep('name');
        submitRef.current = false;
        setIsVerifying(false);
        return;
      } else {
        throw new Error('auth-unconfigured');
      }
      submitRef.current = false;
      setIsVerifying(false);
    } catch (err) {
      submitRef.current = false;
      setIsVerifying(false);
      setOtpError(otpErrorMessage(err, 'That code was not valid. Please try again.'));
    }
  }, [completeLogin, otpCode, phoneE164, phoneValid]);

  // Submission derives from state, not from the 6th keystroke's onChangeText:
  // this fires however the code arrived (fast typing, paste, re-render race).
  useEffect(() => {
    if (otpState && otpCode.length === 6 && !submitRef.current) {
      void submitOtp();
    }
  }, [otpState, otpCode, submitOtp]);

  // Native Firebase can verify the OTP without the user typing (auto-retrieval). Consume the
  // resulting session and finish login exactly like a manual submit.
  const applyAutoVerified = useCallback(() => {
    if (!otpState || submitRef.current || !phoneValid) return;
    const session = consumeAutoVerifiedOtp(phoneE164);
    if (!session) return;
    submitRef.current = true;
    setIsVerifying(true);
    setOtpError('');
    void completeLogin(session)
      .then((navigated) => {
        if (navigated) return;
        submitRef.current = false;
        setIsVerifying(false);
      })
      .catch(() => {
        submitRef.current = false;
        setIsVerifying(false);
        setOtpError('That code was not valid. Please try again.');
      });
  }, [completeLogin, otpState, phoneE164, phoneValid]);

  useEffect(() => {
    if (!otpState) return;
    applyAutoVerified();
    return subscribeOtpAutoVerified(applyAutoVerified);
  }, [applyAutoVerified, otpState]);

  /** Send the SMS OTP, then advance to the code screen. Dev-only when Firebase is unconfigured. */
  const requestOtp = useCallback(
    async (digits: string) => {
      if (isSending || sendRef.current) return;
      if (!isValidPhone(digits)) {
        setPhoneError('Enter a valid Indian mobile number.');
        return;
      }
      Keyboard.dismiss();
      setPhoneError('');
      setOtpError('');
      setOtpCode('');
      submitRef.current = false;
      setIsVerifying(false);
      if (firebaseAuthConfigured()) {
        sendRef.current = true;
        setIsSending(true);
        try {
          await sendOtp(toE164(digits));
          // Remember the number so it can be suggested on the next signed-out visit.
          void saveRecentPhone(toE164(digits));
        } catch (err) {
          // Log the Firebase code in dev without surfacing raw SDK details in the UI.
          if (__DEV__) {
            const code = (err as { code?: string })?.code ?? 'unknown';
            console.warn('[phone-auth] sendOtp failed:', code, (err as Error)?.message);
          }
          setPhoneError(otpErrorMessage(err, 'Could not send the code. Check your number and try again.'));
          return;
        } finally {
          // Every path — success, rejection, or the hard timeout in `firebaseAuth` — must release
          // the Send button. Without this the spinner could stay up forever on iOS/iPad.
          sendRef.current = false;
          setIsSending(false);
        }
      }
      // Freeze the number that actually received the SMS, even if the field was edited mid-send.
      setPhone(digits);
      setAuthStep('otp');
      setResendCooldown(RESEND_COOLDOWN_S);
    },
    [isSending],
  );

  const handleNameChange = (val: string) => {
    // Bounded to match the server's profile-name limit; the name is user copy, never an id.
    setName(val.slice(0, MAX_NAME_LENGTH));
    setNameError('');
  };

  const handlePhoneChange = (val: string) => {
    const numericVal = val.replace(/\D/g, '').slice(0, 15);
    setPhone(numericVal);
    setPhoneError('');
  };

  const handleOtpChange = (val: string) => {
    const numericVal = val.replace(/\D/g, '').slice(0, 6);
    setOtpCode(numericVal);
    setOtpError('');
    if (numericVal.length < 6) {
      submitRef.current = false;
      setIsVerifying(false);
    }
  };

  // Two-step back from OTP: close the keyboard first, then return to phone entry
  // (preserving the typed number). Used by both the chevron and hardware back.
  const goBackFromOtp = useCallback(() => {
    // Never abandon the screen mid-verification; the in-flight `verifyOtp` would still navigate.
    if (isVerifying) return;
    if (keyboardVisible) {
      Keyboard.dismiss();
      return;
    }
    // Abandon this request entirely: a late auto-retrieval for the old number must not be
    // consumed by the next send, and a phantom native session must not linger.
    cancelPrimaryOtp();
    setAuthStep('phone');
    setOtpCode('');
    setOtpError('');
    submitRef.current = false;
    setIsVerifying(false);
  }, [isVerifying, keyboardVisible]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // OTP → phone step (two-step: keyboard first). The post-verification name step is
        // mandatory, so back is consumed there instead of dropping an authenticated session.
        if (otpState) {
          goBackFromOtp();
          return true;
        }
        if (authStep === 'name') return true;
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [otpState, authStep, goBackFromOtp]),
  );

  const handleResend = () => {
    if (resendRef.current || submitRef.current || isSending || sendRef.current || resendCooldown > 0)
      return;
    setOtpCode('');
    setOtpError('');
    submitRef.current = false;
    setIsVerifying(false);
    setResendCooldown(RESEND_COOLDOWN_S);
    if (firebaseAuthConfigured()) {
      resendRef.current = true;
      sendRef.current = true;
      void sendOtp(phoneE164)
        .catch((err: unknown) => {
          if (__DEV__) {
            const code = (err as { code?: string })?.code ?? 'unknown';
            console.warn('[phone-auth] resend failed:', code, (err as Error)?.message);
          }
          setOtpError(otpErrorMessage(err, 'Could not resend the code. Try again in a moment.'));
        })
        .finally(() => {
          resendRef.current = false;
          sendRef.current = false;
        });
    } else {
      setOtpError(`A new demo code has been sent to ${dial} ${phone}.`);
    }
  };

  // Funnel skip: only the phone and OTP steps may skip, and they skip *forward* into the
  // mandatory location step — never back to the carousel and never to a guest home. The name
  // step (post-verification) is not skippable, and a resumed (gated-action) sign-in keeps its
  // close button instead.
  const handleFunnelSkip = useCallback(() => {
    clearPendingAuthAction();
    markOnboardingSeen();
    setFunnelStage('location');
    navigation.reset({ index: 0, routes: [{ name: 'Location' }] });
  }, [clearPendingAuthAction, markOnboardingSeen, navigation, setFunnelStage]);

  // A sign-in resumed from a gated action (add to cart, checkout, …) closes instead of skipping:
  // the rest of the app is already behind it and nothing may be skipped on its behalf.
  const handleCloseResumedSignIn = useCallback(() => {
    clearPendingAuthAction();
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  }, [clearPendingAuthAction, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.avoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {!otpState ? (
        <View style={styles.phoneStateContainer}>

          {authStep === 'phone' ? (
            resumeAfterLogin ? (
              <ScalePressable
                onPress={handleCloseResumedSignIn}
                style={[styles.backBtn, { top: insets.top + vs(8) }]}
                accessibilityRole="button"
                accessibilityLabel="Close sign in"
              >
                <X size={ms(20)} color={neutral.ink} strokeWidth={2.5} />
              </ScalePressable>
            ) : !hasSeenOnboarding ? (
              <ScalePressable
                onPress={() => navigation.navigate('Onboarding')}
                style={[styles.backBtn, { top: insets.top + vs(8) }]}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <ChevronLeft size={ms(20)} color={neutral.ink} strokeWidth={2.5} />
              </ScalePressable>
            ) : null
          ) : null}

          {/* Funnel skip: phone step only, and only when not resuming a gated action —
              it advances to the mandatory location step (no guest escape). The name step is
              not skippable. */}
          {authStep === 'phone' && !resumeAfterLogin ? (
            <ScalePressable
              onPress={handleFunnelSkip}
              style={[styles.guestBtn, { top: insets.top + vs(8) }]}
              accessibilityRole="button"
              accessibilityLabel="Skip to location"
            >
              <AppText style={styles.guestBtnText}>Skip</AppText>
            </ScalePressable>
          ) : null}

          <View style={styles.topImageContainer}>
            <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
              <Image
                source={phoneAuthBackgroundImg}
                style={styles.topImage}
                resizeMode="cover"
              />
            </Pressable>
          </View>

          <View style={styles.phoneCurveOverlay}>
            <BrandGradient />
          </View>

          <Pressable
            onPress={() => Keyboard.dismiss()}
            style={styles.bottomSheet}
          >
            <View style={styles.gradientClipLayer}>
              <BrandGradient />
            </View>

            <View style={styles.badgeContainer}>
              <SmilingCoinHandIllustration />
            </View>

            <View style={styles.exploreTitleWrap}>
              <AppText style={styles.exploreTitle}>
                Explore
              </AppText>
            </View>

            <View style={styles.formContainer}>
              {authStep === 'name' ? (
                <View style={styles.stepBlock}>
                  <View style={[styles.phoneInputRow, isNameFocused && styles.phoneInputRowFocused]}>
                    <AppTextInput
                      ref={nameInputRef}
                      value={name}
                      onChangeText={handleNameChange}
                      placeholder="Enter your name"
                      placeholderTextColor={neutral.border}
                      style={styles.textInput}
                      onFocus={() => setIsNameFocused(true)}
                      onBlur={() => setIsNameFocused(false)}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => { void submitName(); }}
                      editable={!isFinishingName}
                      accessibilityLabel="Name"
                    />
                  </View>
                  {nameError ? (
                    <AppText style={styles.phoneErrorText} accessibilityLiveRegion="polite">
                      {nameError}
                    </AppText>
                  ) : null}

                  <View style={styles.loaderContainer}>
                    {isFinishingName ? (
                      <View style={styles.loadingPill}>
                        <RotatingSpinner size={14} borderWidth={2} color={neutral.ink} />
                        <AppText style={styles.loadingText}>Saving…</AppText>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => { void submitName(); }}
                        accessibilityRole="button"
                        accessibilityLabel="Continue"
                        style={styles.sendBtn}
                      >
                        <AppText style={styles.sendBtnText}>Continue</AppText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.stepBlock}>
                  <View style={[styles.phoneInputRow, isPhoneFocused && styles.phoneInputRowFocused]}>
                    <AppText style={styles.countryCode}>{COUNTRY_DIAL}</AppText>
                    <View style={styles.separator} />
                    <AppTextInput
                      ref={phoneInputRef}
                      style={styles.textInput}
                      placeholder="Enter your mobile number"
                      placeholderTextColor={neutral.border}
                      keyboardType="phone-pad"
                      maxLength={15}
                      value={phone}
                      onChangeText={handlePhoneChange}
                      onFocus={() => setIsPhoneFocused(true)}
                      onBlur={() => setIsPhoneFocused(false)}
                      accessibilityLabel="Mobile number"
                    />
                  </View>

                  {recentPhones.length > 0 && phone.length === 0 ? (
                    <View style={styles.recentRow}>
                      {recentPhones.map((e164) => {
                        const national = nationalDigits(e164);
                        return (
                          <TouchableOpacity
                            key={e164}
                            style={styles.recentChip}
                            onPress={() => handlePhoneChange(national)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`Use number ${COUNTRY_DIAL} ${formatAsYouType(national)}`}
                          >
                            <AppText style={styles.recentChipText}>
                              {COUNTRY_DIAL} {formatAsYouType(national)}
                            </AppText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}

                  <AppText style={styles.termsText}>
                    By clicking, I accept the{' '}
                    <AppText style={styles.termsLink} onPress={handleOpenTerms} accessibilityRole="link">
                      Terms & Conditions
                    </AppText>{' '}
                    and{' '}
                    <AppText style={styles.termsLink} onPress={handleOpenPrivacy} accessibilityRole="link">
                      Privacy Policy
                    </AppText>
                  </AppText>

                  <View style={styles.loaderContainer}>
                    {isSending ? (
                      <View style={styles.loadingPill}>
                        <RotatingSpinner size={14} borderWidth={2} color={neutral.ink} />
                        <AppText style={styles.loadingText}>Sending code…</AppText>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={!phoneValid}
                        onPress={() => void requestOtp(phone)}
                        accessibilityRole="button"
                        accessibilityLabel="Send code"
                        accessibilityState={{ disabled: !phoneValid }}
                        style={[styles.sendBtn, !phoneValid && styles.sendBtnDisabled]}
                      >
                        <AppText style={styles.sendBtnText}>Send code</AppText>
                      </TouchableOpacity>
                    )}
                    {phoneError ? (
                      <AppText style={styles.phoneErrorText} accessibilityLiveRegion="polite">
                        {phoneError}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      ) : (
        <View style={styles.otpStateContainer}>
          <BrandGradient diagonal />

          <TouchableOpacity
            style={styles.otpTopDismissArea}
            onPress={() => Keyboard.dismiss()}
            activeOpacity={1}
          />

          <ScalePressable
            onPress={goBackFromOtp}
            style={[styles.backBtn, { top: insets.top + vs(8) }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={ms(20)} color={neutral.ink} strokeWidth={2.5} />
          </ScalePressable>

          {/* The OTP step is the last skippable point: it advances to the location step. */}
          {!resumeAfterLogin ? (
            <ScalePressable
              onPress={handleFunnelSkip}
              style={[styles.guestBtn, { top: insets.top + vs(8) }]}
              accessibilityRole="button"
              accessibilityLabel="Skip to location"
            >
              <AppText style={styles.guestBtnText}>Skip</AppText>
            </ScalePressable>
          ) : null}

          <View style={styles.otpHeaderContainer}>
            <AppText style={styles.otpHeaderTitle}>Let's get verified</AppText>
          </View>

          <View style={styles.checkCircleBg} />
          <View style={styles.checkCircleIcon}>
            <Svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
              <Polyline
                points="20 6 9 17 4 12"
                stroke={neutral.card}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.otpBlueCurve} />

          <TouchableOpacity
            style={styles.otpWhiteDome}
            onPress={() => otpInputRef.current?.focus()}
            activeOpacity={1}
          >
            <View style={styles.otpWhiteContent}>
              <View style={styles.otpPromptContainer}>
                <AppText style={styles.securePromptSub}>Secure verification</AppText>
                <AppText style={styles.securePromptMain}>Enter the code sent to</AppText>
                <AppText style={styles.securePromptPhone}>{phone ? `${dial} ${phone}` : 'your number'}</AppText>
              </View>

              <View style={styles.otpSegmentsContainer}>
                <AppTextInput
                  ref={otpInputRef}
                  style={styles.hiddenOtpInput}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={handleOtpChange}
                  caretHidden={true}
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  editable={!isVerifying}
                  accessibilityLabel="Enter the 6-digit code"
                  accessibilityHint="The code was sent to your phone"
                  accessibilityValue={{ text: `${otpCode.length} of 6 digits entered` }}
                />

                <View style={styles.segmentsRow}>
                  {Array.from({ length: 6 }).map((_, index) => {
                      const digit = otpCode[index];
                      const isCurrent = index === otpCode.length;
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
                              otpError
                                ? styles.segmentTrackError
                                : isFilled
                                  ? styles.segmentTrackFilled
                                  : isCurrent
                                    ? [
                                        styles.segmentTrackCurrent,
                                        { opacity: pulseAnim },
                                      ]
                                    : styles.segmentTrackDefault,
                              otpError && !isFilled && !isCurrent
                                ? { transform: [{ translateX: shakeAnim }] }
                                : {},
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.otpFooterContainer}>
                {otpError ? (
                  <Animated.View
                    style={[
                      styles.errorToast,
                      { transform: [{ translateX: shakeAnim }] },
                    ]}
                  >
                    <View style={styles.errorToastIconCircle}>
                      <Svg width={ms(16)} height={ms(16)} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          stroke={neutral.card}
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </View>
                    <View style={styles.errorToastTextContainer}>
                      <AppText style={styles.errorToastTitle}>Verification Failed</AppText>
                      <AppText style={styles.errorToastMessage}>{otpError}</AppText>
                    </View>
                  </Animated.View>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={otpCode.length !== 6 || isVerifying}
                  onPress={() => { void submitOtp(); }}
                  style={[
                    styles.verifyBtn,
                    (otpCode.length !== 6 || isVerifying) && styles.verifyBtnDisabled,
                  ]}
                >
                  {isVerifying ? (
                    <ActivityIndicator size="small" color={neutral.card} />
                  ) : (
                    <AppText style={styles.verifyBtnText}>Verify</AppText>
                  )}
                </TouchableOpacity>

                <View style={styles.resendRow}>
                  <AppText style={styles.resendTextSub}>Didn't get the code? </AppText>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={isVerifying || isSending || resendCooldown > 0}
                    onPress={handleResend}
                    accessibilityRole="button"
                    accessibilityLabel={resendCooldown > 0 ? `Resend code in ${resendCooldown} seconds` : 'Resend code'}
                    accessibilityState={{ disabled: isVerifying || isSending || resendCooldown > 0 }}
                  >
                    <AppText style={styles.resendTextAction}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
                    </AppText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: parentRamp.base },
  avoiding: { flex: 1 },
  phoneStateContainer: { flex: 1, position: 'relative' },
  backBtn: {
    position: 'absolute',
    left: hs(16),
    zIndex: 40,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: neutral.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.1)',
  },
  guestBtn: {
    position: 'absolute',
    right: hs(16),
    zIndex: 40,
    minHeight: 44,
    paddingHorizontal: hs(18),
    borderRadius: 22,
    backgroundColor: neutral.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.1)',
  },
  guestBtnText: {
    fontSize: ms(13),
    fontWeight: '600',
    color: parentRamp.base,
  },
  topImageContainer: { width: '100%', backgroundColor: neutral.card, zIndex: 1, height: hp(20) + DOME_RADIUS },
  topImage: { width: '100%', height: '100%' },
  bottomSheet: {
    flex: 1,
    backgroundColor: 'transparent',
    borderTopLeftRadius: DOME_RADIUS,
    borderTopRightRadius: DOME_RADIUS,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: -15 },
    shadowOpacity: 0.18,
    shadowRadius: 35,
    elevation: 20,
    paddingHorizontal: hs(24),
    marginTop: -44,
    paddingTop: 32,
    paddingBottom: 48,
    position: 'relative',
    zIndex: 10,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  gradientClipLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: DOME_RADIUS,
    borderTopRightRadius: DOME_RADIUS,
    overflow: 'hidden',
  },

  phoneCurveOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: hp(20),
    zIndex: 5,
    borderTopLeftRadius: DOME_RADIUS,
    borderTopRightRadius: DOME_RADIUS,
    overflow: 'hidden',
  },

  exploreTitleWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },

  badgeContainer: {
    position: 'absolute',
    top: -vs(44),
    left: wp(50) - DOME_RADIUS,
    width: ms(88),
    height: ms(88),
    borderRadius: DOME_RADIUS,
    backgroundColor: neutral.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 25,
  },
  headerBlock: { alignItems: 'center' },
  exploreTitle: {
    color: neutral.card,
    fontWeight: '600',
    fontSize: ms(28),
  },
  formContainer: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: SPACE.SECTION },
  stepBlock: { width: '100%', alignItems: 'center' },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: neutral.card,
    borderRadius: ms(30),
    paddingHorizontal: hs(20),
    paddingVertical: vs(12),
    width: '100%',
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 25,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  phoneInputRowFocused: {
    borderColor: categorical.green,
    shadowColor: categorical.green,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  countryCode: { fontSize: ms(14), fontWeight: '600', color: neutral.ink },
  separator: { width: 1, height: vs(16), backgroundColor: neutral.border, marginHorizontal: hs(10) },
  textInput: { flex: 1, fontSize: ms(14), fontWeight: '600', color: neutral.ink },
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: hs(8),
    marginTop: SPACE.BLOCK,
    paddingHorizontal: hs(4),
  },
  recentChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: hs(14),
    borderRadius: ms(18),
    backgroundColor: neutral.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  recentChipText: { fontSize: ms(12), fontWeight: '600', color: parentRamp.base },
  termsText: {
    fontSize: ms(10),
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: SPACE.BLOCK,
    paddingHorizontal: hs(8),
    lineHeight: ms(16),
  },
  termsLink: { fontWeight: '600', textDecorationLine: 'underline' },
  loaderContainer: { minHeight: Math.max(44, vs(44)), marginTop: SPACE.BLOCK, alignItems: 'center', justifyContent: 'center' },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: categorical.green,
    paddingHorizontal: hs(40),
    paddingVertical: vs(14),
    borderRadius: ms(30),
    shadowColor: categorical.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    gap: hs(10),
  },
  loadingText: { color: neutral.ink, fontWeight: '600', fontSize: ms(12) },
  sendBtn: {
    minHeight: Math.max(48, vs(48)),
    minWidth: hs(200),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ms(30),
    backgroundColor: categorical.green,
    shadowColor: categorical.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.35)', shadowOpacity: 0, elevation: 0 },
  sendBtnText: { color: neutral.ink, fontWeight: '600', fontSize: ms(14) },
  phoneErrorText: {
    marginTop: SPACE.BLOCK,
    fontSize: ms(12),
    color: semanticTint.danger,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: hs(12),
  },
  otpStateContainer: { flex: 1, backgroundColor: parentRamp.base, position: 'relative' },
  otpTopDismissArea: { position: 'absolute', top: 0, left: 0, right: 0, height: '24.2%', zIndex: 30 },
  otpHeaderContainer: { position: 'absolute', top: '9%', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  otpHeaderTitle: { color: neutral.card, fontWeight: '600', fontSize: ms(24) },
  checkCircleBg: {
    position: 'absolute',
    top: '14%',
    left: wp(50) - wp(13.3) / 2,
    width: '13.3%',
    aspectRatio: 1,
    borderRadius: SCREEN_W,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    zIndex: 10,
  },
  checkCircleIcon: {
    position: 'absolute',
    top: '15.25%',
    left: wp(50) - wp(8) / 2,
    width: '8%',
    aspectRatio: 1,
    zIndex: 20,
  },
  otpBlueCurve: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: hp(13.7),
    backgroundColor: parentRamp.base,
    zIndex: 10,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: -24 },
    shadowOpacity: 0.08,
    shadowRadius: 33,
    elevation: 15,
    borderTopLeftRadius: DOME_RADIUS,
    borderTopRightRadius: DOME_RADIUS,
  },
  otpWhiteDome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: hp(15.2),
    backgroundColor: neutral.card,
    zIndex: 20,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: -24 },
    shadowOpacity: 0.08,
    shadowRadius: 33,
    elevation: 20,
    borderTopLeftRadius: DOME_RADIUS,
    borderTopRightRadius: DOME_RADIUS,
  },
  otpWhiteContent: { flex: 1, paddingVertical: SPACE.SECTION, paddingHorizontal: hs(24), alignItems: 'center' },
  otpPromptContainer: { alignItems: 'center', marginBottom: SPACE.SECTION },
  securePromptSub: { fontSize: ms(11), fontWeight: '600', color: neutral.inkSubtle, marginBottom: vs(6) },
  securePromptMain: { fontSize: ms(18), fontWeight: '600', color: neutral.ink, marginBottom: vs(2) },
  securePromptPhone: { fontSize: ms(20), fontWeight: '600', color: parentRamp.base, letterSpacing: 0.5 },
  otpSegmentsContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', width: '100%', position: 'relative', paddingTop: vs(8) },
  hiddenOtpInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: 40, color: 'transparent' },
  segmentsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: hs(12), width: '100%', maxWidth: hs(320), zIndex: 30 },
  segmentColumn: { alignItems: 'center', width: Math.max(44, vs(44)) },
  segmentDigitContainer: { height: vs(48), justifyContent: 'center', alignItems: 'center' },
  segmentDigit: { fontSize: ms(30), fontWeight: '600', color: neutral.ink, letterSpacing: -1 },
  segmentDot: { fontSize: ms(12), fontWeight: '600', color: neutral.border, opacity: 0.7 },
  segmentTrack: { height: vs(6), borderRadius: ms(3), width: '100%', marginTop: vs(4) },
  segmentTrackDefault: { backgroundColor: neutral.border, opacity: 0.7 },
  segmentTrackCurrent: { backgroundColor: parentRamp.base, height: vs(5) },
  segmentTrackFilled: {
    backgroundColor: parentRamp.base,
    height: vs(5),
    shadowColor: parentRamp.base,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentTrackError: {
    backgroundColor: categorical.rose,
    height: vs(5),
    shadowColor: categorical.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  otpFooterContainer: { width: '100%', alignItems: 'center', paddingBottom: SPACE.LIST_BOTTOM, gap: SPACE.SECTION },
  errorToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: semanticTint.danger,
    borderWidth: 1,
    borderColor: semanticTint.danger,
    borderRadius: ms(16),
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    maxWidth: hs(290),
    gap: hs(12),
    shadowColor: categorical.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  errorToastIconCircle: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: categorical.rose,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: categorical.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  errorToastTextContainer: { flexShrink: 1 },
  errorToastTitle: { fontSize: ms(11), fontWeight: '600', color: semantic.danger, lineHeight: ms(14) },
  errorToastMessage: { fontSize: ms(10), fontWeight: '600', color: semantic.danger, marginTop: vs(2), lineHeight: ms(14) },
  verifyBtn: {
    width: '100%',
    maxWidth: hs(290),
    height: vs(48),
    borderRadius: ms(24),
    backgroundColor: parentRamp.base,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: parentRamp.base,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  verifyBtnDisabled: { backgroundColor: neutral.border, shadowOpacity: 0, elevation: 0 },
  verifyBtnText: { color: neutral.card, fontWeight: '600', fontSize: ms(15), letterSpacing: 0.5 },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  resendTextSub: { fontSize: ms(12), color: neutral.inkMuted, fontWeight: '600' },
  resendTextAction: { fontSize: ms(12), color: parentRamp.base, fontWeight: '600' },
});
