import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Pressable, Platform, Alert, Image, Keyboard, KeyboardAvoidingView, Animated, Easing, BackHandler, ActivityIndicator } from 'react-native';
import type { TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { navigationRef } from '@/navigation/navigationRef';
import { ChevronLeft } from 'lucide-react-native';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import phoneAuthBackgroundImg from '@/assets/phone_auth_background.webp';
import AppTextInput from '@/components/AppTextInput';
import AppText from '@/components/AppText';
import { useAuthStore } from '@/state/authStore';
import { decodeIdToken } from '@/lib/tokenClaims';
import {
  displayName,
  firebaseAuthConfigured,
  sendOtp,
  verifyOtp,
} from '@/services/firebaseAuth';

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
          <Stop offset="0%" stopColor="#2c56f6" />
          <Stop offset={startOffset} stopColor="#2c56f6" />
          <Stop offset="100%" stopColor="#122bb3" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${GRADIENT_ID})`} rx={borderRadius} ry={borderRadius} />
    </Svg>
  );
}

function ScalePressable({ onPress, style, children, ...rest }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.9, friction: 8, tension: 100, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start()}
      style={style}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const SmilingCoinHandIllustration = () => (
  <Svg viewBox="0 0 100 100" width={ms(88)} height={ms(88)}>
    <Circle cx="50" cy="50" r="45" fill="#ffd037" />
    <Circle cx="50" cy="50" r="41" fill="#ffc107" />
    <Circle cx="50" cy="50" r="38" fill="#ffd037" />
    <Circle cx="36" cy="42" r="5" fill="#1e293b" />
    <Circle cx="64" cy="42" r="5" fill="#1e293b" />
    <Circle cx="34" cy="40" r="1.5" fill="#ffffff" />
    <Circle cx="62" cy="40" r="1.5" fill="#ffffff" />
    <Ellipse cx="26" cy="54" rx="7" ry="4" fill="#ff8a80" opacity={0.6} />
    <Ellipse cx="74" cy="54" rx="7" ry="4" fill="#ff8a80" opacity={0.6} />
    <Path d="M 30 60 Q 50 80 70 60" fill="none" stroke="#1e293b" strokeWidth={4} strokeLinecap="round" />
    <Path d="M 40 68 Q 50 78 60 68" fill="none" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
  </Svg>
);

function RotatingSpinner({ size = 14, borderWidth = 2, color = '#212121' }) {
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

export function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((s) => s.login);
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [otpState, setOtpState] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const phoneInputRef = useRef<TextInput>(null);
  const otpInputRef = useRef<TextInput>(null);
  const submitRef = useRef(false);
  const phoneAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const target = otpState ? otpInputRef.current : phoneInputRef.current;
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
  }, [otpState]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => () => {
    if (phoneAdvanceRef.current) clearTimeout(phoneAdvanceRef.current);
  }, []);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [otpState, fadeAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const triggerShake = () => {
    shakeAnim.setValue(0);
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

  const submitOtp = useCallback(async () => {
    if (submitRef.current || otpCode.length !== 6 || phone.length < 10) return;
    submitRef.current = true;
    setIsVerifying(true);
    Keyboard.dismiss();
    otpInputRef.current?.blur();

    try {
      if (firebaseAuthConfigured()) {
        // Real Firebase phone-OTP session: the ID token is the same bearer the gateway verifies.
        const session = await verifyOtp(phone, otpCode);
        const claims = decodeIdToken(session.accessToken);
        await login({
          user: {
            id: session.user.uid,
            name: displayName(session.user),
            email: session.user.email ?? '',
            phone,
            role: claims.role,
            stateCode: claims.stateCode,
            districtCode: claims.districtCode,
            sellerId: claims.sellerId,
          },
          accessToken: session.accessToken,
        });
      } else if (__DEV__) {
        // Dev-only fallback when Firebase Auth is unconfigured (local AUTH_DISABLED gateway).
        // Release builds never reach here — configure.js refuses to embed a mock-login build.
        const placeholderToken = `placeholder.${phone}.${Date.now()}`;
        await login({
          user: { id: `user_${phone}`, name: 'Faazio User', email: '', phone },
          accessToken: placeholderToken,
        });
      } else {
        throw new Error('auth-unconfigured');
      }
    } catch {
      submitRef.current = false;
      setIsVerifying(false);
      setOtpError('That code was not valid. Please try again.');
      return;
    }

    if (navigationRef.isReady()) {
      navigation.replace('LanguageSelection');
    } else {
      submitRef.current = false;
      setIsVerifying(false);
    }
  }, [otpCode, phone, login, navigation]);

  // Submission derives from state, not from the 6th keystroke's onChangeText:
  // this fires however the code arrived (fast typing, paste, re-render race).
  useEffect(() => {
    if (otpState && otpCode.length === 6 && !submitRef.current) {
      void submitOtp();
    }
  }, [otpState, otpCode, submitOtp]);

  /** Send the SMS OTP, then advance to the code screen. Dev-only when Firebase is unconfigured. */
  const requestOtp = useCallback(
    async (digits: string) => {
      if (isSending) return;
      Keyboard.dismiss();
      setOtpError('');
      setOtpCode('');
      submitRef.current = false;
      setIsVerifying(false);
      if (firebaseAuthConfigured()) {
        setIsSending(true);
        try {
          await sendOtp(digits);
        } catch {
          setIsSending(false);
          Alert.alert('Could not send OTP', 'Please check your number and try again.');
          return;
        }
        setIsSending(false);
      }
      setOtpState(true);
    },
    [isSending],
  );

  const handlePhoneChange = (val: string) => {
    const numericVal = val.replace(/\D/g, '').slice(0, 10);
    setPhone(numericVal);
    if (phoneAdvanceRef.current) {
      clearTimeout(phoneAdvanceRef.current);
      phoneAdvanceRef.current = null;
    }
    if (numericVal.length === 10 && !otpState) {
      phoneAdvanceRef.current = setTimeout(() => {
        phoneAdvanceRef.current = null;
        void requestOtp(numericVal);
      }, 150);
    }
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
    if (keyboardVisible) {
      Keyboard.dismiss();
      return;
    }
    setOtpState(false);
    setOtpCode('');
    setOtpError('');
    submitRef.current = false;
    setIsVerifying(false);
  }, [keyboardVisible]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (!otpState) return false; // phone entry → let the stack pop to Welcome
        goBackFromOtp();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [otpState, goBackFromOtp]),
  );

  const handleResend = () => {
    setOtpCode('');
    setOtpError('');
    submitRef.current = false;
    setIsVerifying(false);
    if (firebaseAuthConfigured()) {
      void sendOtp(phone).catch(() =>
        Alert.alert('Could not send OTP', 'Please try again in a moment.'),
      );
    } else {
      Alert.alert('Resend', 'A new demo OTP code has been sent to (+91) ' + phone);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.avoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {!otpState ? (
        <View style={styles.phoneStateContainer}>

          <ScalePressable
            onPress={() => navigation.navigate('Onboarding')}
            style={[styles.backBtn, { top: Platform.OS === 'ios' ? vs(44) : insets.top + vs(8) }]}
          >
            <ChevronLeft size={ms(20)} color="#1e293b" strokeWidth={2.5} />
          </ScalePressable>

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
              <View>
                <View style={[styles.phoneInputRow, isPhoneFocused && styles.phoneInputRowFocused]}>
                  <AppText style={styles.countryCode}>(+91)</AppText>
                  <View style={styles.separator} />
                  <AppTextInput
                    ref={phoneInputRef}
                    style={styles.textInput}
                    placeholder="Enter your mobile number"
                    placeholderTextColor="#e2e8f0"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={handlePhoneChange}
                    onFocus={() => setIsPhoneFocused(true)}
                    onBlur={() => setIsPhoneFocused(false)}
                  />
                </View>

                <AppText style={styles.termsText}>
                  By clicking, I accept the{' '}
                  <AppText style={styles.termsLink}>Terms & Conditions</AppText> and{' '}
                  <AppText style={styles.termsLink}>Privacy Policy</AppText>
                </AppText>

                <View style={styles.loaderContainer}>
                  {phone.length === 10 && (
                    <View style={styles.loadingPill}>
                      <RotatingSpinner size={14} borderWidth={2} color="#212121" />
                      <AppText style={styles.loadingText}>Sending OTP...</AppText>
                    </View>
                  )}
                </View>
              </View>
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
            style={[styles.backBtn, { top: Platform.OS === 'ios' ? vs(44) : insets.top + vs(8) }]}
          >
            <ChevronLeft size={ms(20)} color="#1e293b" strokeWidth={2.5} />
          </ScalePressable>

          <View style={styles.otpHeaderContainer}>
            <AppText style={styles.otpHeaderTitle}>Lets get verified</AppText>
          </View>

          <View style={styles.checkCircleBg} />
          <View style={styles.checkCircleIcon}>
            <Svg viewBox="0 0 24 24" fill="none" width="100%" height="100%">
              <Polyline
                points="20 6 9 17 4 12"
                stroke="#ffffff"
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
                <AppText style={styles.securePromptSub}>Secure Verification</AppText>
                <AppText style={styles.securePromptMain}>Enter the code sent to</AppText>
                <AppText style={styles.securePromptPhone}>{phone ? `+91 ${phone}` : '+9876543210'}</AppText>
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
                          stroke="#ffffff"
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
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <AppText style={styles.verifyBtnText}>Verify</AppText>
                  )}
                </TouchableOpacity>

                <View style={styles.resendRow}>
                  <AppText style={styles.resendTextSub}>Didn't get the code? </AppText>
                  <TouchableOpacity activeOpacity={0.7} onPress={handleResend}>
                    <AppText style={styles.resendTextAction}>Resend</AppText>
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
  container: { flex: 1, backgroundColor: '#1f40d4' },
  avoiding: { flex: 1 },
  phoneStateContainer: { flex: 1, position: 'relative' },
  backBtn: {
    position: 'absolute',
    left: hs(16),
    zIndex: 40,
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.1)',
  },
  topImageContainer: { width: '100%', backgroundColor: '#ffffff', zIndex: 1, height: hp(20) + DOME_RADIUS },
  topImage: { width: '100%', height: '100%' },
  bottomSheet: {
    flex: 1,
    backgroundColor: 'transparent',
    borderTopLeftRadius: DOME_RADIUS,
    borderTopRightRadius: DOME_RADIUS,
    shadowColor: '#000000',
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
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
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
    color: '#ffffff',
    fontWeight: '900',
    fontSize: ms(28),
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  formContainer: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: SPACE.SECTION },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: ms(30),
    paddingHorizontal: hs(20),
    paddingVertical: vs(12),
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 25,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  phoneInputRowFocused: {
    borderColor: '#41E68F',
    shadowColor: '#41E68F',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  countryCode: { fontSize: ms(14), fontWeight: '800', color: '#212121' },
  separator: { width: 1, height: vs(16), backgroundColor: '#e2e8f0', marginHorizontal: hs(10) },
  textInput: { flex: 1, fontSize: ms(14), fontWeight: '600', color: '#212121' },
  termsText: {
    fontSize: ms(10),
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: SPACE.BLOCK,
    paddingHorizontal: hs(8),
    lineHeight: ms(16),
  },
  termsLink: { fontWeight: '800', textDecorationLine: 'underline' },
  loaderContainer: { minHeight: Math.max(44, vs(44)), marginTop: SPACE.BLOCK, alignItems: 'center', justifyContent: 'center' },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#41E68F',
    paddingHorizontal: hs(40),
    paddingVertical: vs(14),
    borderRadius: ms(30),
    shadowColor: '#41E68F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    gap: hs(10),
  },
  loadingText: { color: '#212121', fontWeight: '900', fontSize: ms(12) },
  otpStateContainer: { flex: 1, backgroundColor: '#1f40d4', position: 'relative' },
  otpTopDismissArea: { position: 'absolute', top: 0, left: 0, right: 0, height: '24.2%', zIndex: 30 },
  otpHeaderContainer: { position: 'absolute', top: '9%', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  otpHeaderTitle: { color: '#ffffff', fontWeight: '900', textTransform: 'uppercase', fontSize: ms(24), letterSpacing: -0.5 },
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
    backgroundColor: '#2b51db',
    zIndex: 10,
    shadowColor: '#000000',
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
    backgroundColor: '#ffffff',
    zIndex: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -24 },
    shadowOpacity: 0.08,
    shadowRadius: 33,
    elevation: 20,
    borderTopLeftRadius: DOME_RADIUS,
    borderTopRightRadius: DOME_RADIUS,
  },
  otpWhiteContent: { flex: 1, paddingVertical: SPACE.SECTION, paddingHorizontal: hs(24), alignItems: 'center' },
  otpPromptContainer: { alignItems: 'center', marginBottom: SPACE.SECTION },
  securePromptSub: { fontSize: ms(10), fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: vs(6) },
  securePromptMain: { fontSize: ms(18), fontWeight: '900', color: '#1e293b', marginBottom: vs(2) },
  securePromptPhone: { fontSize: ms(20), fontWeight: '900', color: '#2f80ed', letterSpacing: 0.5 },
  otpSegmentsContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', width: '100%', position: 'relative', paddingTop: vs(8) },
  hiddenOtpInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: 40, color: 'transparent' },
  segmentsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: hs(12), width: '100%', maxWidth: hs(320), zIndex: 30 },
  segmentColumn: { alignItems: 'center', width: Math.max(44, vs(44)) },
  segmentDigitContainer: { height: vs(48), justifyContent: 'center', alignItems: 'center' },
  segmentDigit: { fontSize: ms(30), fontWeight: '900', color: '#1e293b', letterSpacing: -1 },
  segmentDot: { fontSize: ms(12), fontWeight: '900', color: '#cbd5e1', opacity: 0.7 },
  segmentTrack: { height: vs(6), borderRadius: ms(3), width: '100%', marginTop: vs(4) },
  segmentTrackDefault: { backgroundColor: '#cbd5e1', opacity: 0.7 },
  segmentTrackCurrent: { backgroundColor: '#3b82f6', height: vs(5) },
  segmentTrackFilled: {
    backgroundColor: '#2f80ed',
    height: vs(5),
    shadowColor: '#2f80ed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentTrackError: {
    backgroundColor: '#f43f5e',
    height: vs(5),
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  otpFooterContainer: { width: '100%', alignItems: 'center', paddingBottom: SPACE.LIST_BOTTOM, gap: SPACE.SECTION },
  errorToast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#ffe4e6',
    borderRadius: ms(16),
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    maxWidth: hs(290),
    gap: hs(12),
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  errorToastIconCircle: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(16),
    backgroundColor: '#f43f5e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  errorToastTextContainer: { flexShrink: 1 },
  errorToastTitle: { fontSize: ms(11), fontWeight: '900', color: '#9f1239', lineHeight: ms(14) },
  errorToastMessage: { fontSize: ms(10), fontWeight: '700', color: '#e11d48', marginTop: vs(2), lineHeight: ms(14) },
  verifyBtn: {
    width: '100%',
    maxWidth: hs(290),
    height: vs(48),
    borderRadius: ms(24),
    backgroundColor: '#2f80ed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2f80ed',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 6,
  },
  verifyBtnDisabled: { backgroundColor: '#cbd5e1', shadowOpacity: 0, elevation: 0 },
  verifyBtnText: { color: '#ffffff', fontWeight: '900', fontSize: ms(15), letterSpacing: 0.5 },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  resendTextSub: { fontSize: ms(12), color: '#64748b', fontWeight: '600' },
  resendTextAction: { fontSize: ms(12), color: '#2f80ed', fontWeight: '800' },
});
