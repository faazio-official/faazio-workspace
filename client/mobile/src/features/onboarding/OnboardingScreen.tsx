import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { FaazioLogo } from '../../components/FaazioLogo';
import { SCREEN_W, SCREEN_H, hs, vs, ms, wp, hp, STATUS_BAR_INSET } from '@/utils/responsive';

import welcomeIllustration1 from '../../assets/welcome_illustration_1.webp';
import welcomeIllustration2 from '../../assets/welcome_illustration_2.webp';
import welcomeIllustration3 from '../../assets/welcome_illustration_3.webp';
import welcomeIllustration4 from '../../assets/welcome_illustration_4.webp';
import AppText from '@/components/AppText';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

interface OnboardingStep {
  title: string;
  subtitle: string;
  description: string;
  bgColor: string;
  accentColor: string;
  image: any;
}

const BRAND_BLUE = '#2c56f6';

const ONBOARDING_DATA: OnboardingStep[] = [
  {
    title: 'Welcome to Faazio',
    subtitle: 'Your Daily SuperApp',
    description: 'Simplify your life. Shop essentials, order delicious food, book travel tickets, and access trusted local e-services inside one seamless interface.',
    bgColor: '#ffffff',
    accentColor: BRAND_BLUE,
    image: welcomeIllustration1,
  },
  {
    title: 'Smart Shopping',
    subtitle: 'Essentials Made Easy',
    description: 'Experience instant deliveries of groceries, household essentials, and favorite brands from vetted local stores direct to your doorstep.',
    bgColor: '#ffffff',
    accentColor: BRAND_BLUE,
    image: welcomeIllustration2,
  },
  {
    title: 'Satisfy Your Hunger',
    subtitle: 'Hot Food Ordering',
    description: 'Craving something hot and delicious? Order from premier local restaurants and track your delivery in real-time with zero hassle.',
    bgColor: '#ffffff',
    accentColor: BRAND_BLUE,
    image: welcomeIllustration3,
  },
  {
    title: 'Instant E-Services',
    subtitle: 'And Hassle-Free Booking',
    description: 'From certified home repairs to booking movie, bus, or train tickets—Faazio handles your entire chore list instantly.',
    bgColor: '#ffffff',
    accentColor: BRAND_BLUE,
    image: welcomeIllustration4,
  },
];

const LOGO_HEIGHT = Math.round(Math.min(Math.max(SCREEN_W * 0.09, 30), 42));

export function OnboardingScreen({ navigation }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const directionRef = useRef<'next' | 'back'>('next');
  const isFirstRender = useRef(true);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const offset = directionRef.current === 'next' ? 120 : -120;
    slideAnim.setValue(offset);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_DATA.length - 1) {
      directionRef.current = 'next';
      setCurrentStep((prev) => prev + 1);
    } else {
      navigation.navigate('Login');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      directionRef.current = 'back';
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    navigation.navigate('Login');
  };

  const currentData = ONBOARDING_DATA[currentStep];

  return (
    <View style={[styles.container, { backgroundColor: currentData.bgColor }]}>
      <Animated.View
        style={[
          styles.animatedWrapper,
          {
            opacity: opacityAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          <FaazioLogo size={LOGO_HEIGHT} />
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton} activeOpacity={0.8}>
            <AppText style={styles.skipText}>Skip</AppText>
          </TouchableOpacity>
        </View>

        {/* Main Content Area */}
        <View style={styles.contentContainer}>
          <View style={styles.illustrationWrapper}>
            <Image
              source={currentData.image}
              style={styles.illustrationImage}
              resizeMode="contain"
            />
          </View>

          {/* Text Details Section */}
          <View style={styles.textDetails}>
            <AppText style={styles.titleText}>{currentData.title}</AppText>
            <AppText style={[styles.subtitleText, { color: BRAND_BLUE }]}>
              {currentData.subtitle}
            </AppText>
            <View style={[styles.underline, { backgroundColor: BRAND_BLUE }]} />
            <AppText style={styles.descriptionText}>{currentData.description}</AppText>
          </View>
        </View>
      </Animated.View>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        {/* Progress Dots Indicator */}
        <View style={styles.dotsContainer}>
          {ONBOARDING_DATA.map((_, index) => {
            const isActive = index === currentStep;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isActive
                    ? [styles.activeDot, { backgroundColor: BRAND_BLUE }]
                    : [styles.inactiveDot, { backgroundColor: '#cbd5e1' }],
                ]}
              />
            );
          })}
        </View>

        {/* Action Button Controls */}
        <View style={styles.buttonsRow}>
          {currentStep > 0 && (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={0.8}
            >
              <ChevronLeft size={ms(12)} color="#475569" />
              <AppText style={styles.backButtonText}>Back</AppText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.nextButton, { backgroundColor: BRAND_BLUE }]}
            activeOpacity={0.8}
          >
            <AppText style={styles.nextButtonText}>
              {currentStep === ONBOARDING_DATA.length - 1 ? 'Get Started' : 'Next'}
            </AppText>
            <ChevronRight size={ms(12)} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  animatedWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(24),
    paddingTop: STATUS_BAR_INSET + vs(12),
    height: STATUS_BAR_INSET + vs(54),
  },
  skipButton: {
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
    borderRadius: ms(16),
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.5)',
  },
  skipText: {
    fontSize: ms(11),
    color: '#475569',
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: hs(24),
  },
  illustrationWrapper: {
    width: '100%',
    maxWidth: hs(310),
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SCREEN_H < 700 ? vs(16) : vs(20),
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },
  textDetails: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: hs(12),
  },
  titleText: {
    fontSize: SCREEN_H < 700 ? ms(18) : ms(20),
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: SCREEN_H < 700 ? ms(12) : ms(13),
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: vs(4),
  },
  underline: {
    width: hs(40),
    height: vs(2),
    borderRadius: 1,
    marginVertical: SCREEN_H < 700 ? vs(10) : vs(12),
  },
  descriptionText: {
    fontSize: SCREEN_H < 700 ? ms(11) : ms(12),
    color: '#64748b',
    textAlign: 'center',
    lineHeight: SCREEN_H < 700 ? ms(16) : ms(18),
    fontWeight: '500',
    maxWidth: hs(320),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: hs(24),
    paddingBottom: SCREEN_H < 700 ? vs(16) : vs(24),
    height: vs(70),
    borderTopWidth: 1,
    borderColor: 'rgba(226,232,240,0.5)',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    height: ms(6),
    borderRadius: ms(3),
    marginHorizontal: hs(3),
  },
  activeDot: {
    width: hs(20),
  },
  inactiveDot: {
    width: ms(6),
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(8),
    paddingHorizontal: hs(14),
    borderRadius: ms(20),
    backgroundColor: 'rgba(226,232,240,0.8)',
    marginRight: hs(8),
    gap: hs(2),
  },
  backButtonText: {
    color: '#475569',
    fontSize: ms(12),
    fontWeight: '700',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: vs(8),
    paddingHorizontal: hs(16),
    borderRadius: ms(20),
    justifyContent: 'center',
    gap: hs(2),
    shadowColor: BRAND_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: ms(12),
    fontWeight: '700',
  },
});
