import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';

// Import images matching the source assets
import welcomeIllustration1 from '../../assets/welcome_illustration_1.png';
import welcomeIllustration2 from '../../assets/welcome_illustration_2.png';
import welcomeIllustration3 from '../../assets/welcome_illustration_3.png';
import welcomeIllustration4 from '../../assets/welcome_illustration_4.png';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

interface OnboardingStep {
  title: string;
  subtitle: string;
  description: string;
  bgColor: string;
  accentColor: string;
  bgCircleColor: string;
  image: any;
}

const ONBOARDING_DATA: OnboardingStep[] = [
  {
    title: 'Welcome to Faazio',
    subtitle: 'Your Daily SuperApp',
    description: 'Simplify your life. Shop essentials, order delicious food, book travel tickets, and access trusted local e-services inside one seamless interface.',
    bgColor: '#ffffff',
    accentColor: '#2c56f6',
    bgCircleColor: '#f1f5f9',
    image: welcomeIllustration1,
  },
  {
    title: 'Smart Shopping',
    subtitle: 'Essentials Made Easy',
    description: 'Experience instant deliveries of groceries, household essentials, and favorite brands from vetted local stores direct to your doorstep.',
    bgColor: '#ffffff',
    accentColor: '#e11d48',
    bgCircleColor: '#fff1f2',
    image: welcomeIllustration2,
  },
  {
    title: 'Satisfy Your Hunger',
    subtitle: 'Hot Food Ordering',
    description: 'Craving something hot and delicious? Order from premier local restaurants and track your delivery in real-time with zero hassle.',
    bgColor: '#ffffff',
    accentColor: '#16a34a',
    bgCircleColor: '#f0fdf4',
    image: welcomeIllustration3,
  },
  {
    title: 'Instant E-Services',
    subtitle: 'And Hassle-Free Booking',
    description: 'From certified home repairs to booking movie, bus, or train tickets—Faazio handles your entire chore list instantly.',
    bgColor: '#ffffff',
    accentColor: '#9333ea',
    bgCircleColor: '#faf5ff',
    image: welcomeIllustration4,
  },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function OnboardingScreen({ navigation }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < ONBOARDING_DATA.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      navigation.navigate('Login');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    navigation.navigate('Login');
  };

  const currentData = ONBOARDING_DATA[currentStep];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: currentData.bgColor }]}>
      {/* Header Bar */}
      <View style={styles.header}>
        {/* Custom Faazio Brand Logo Title */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandTitle}>Faazio</Text>
          <View style={styles.brandDot} />
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {/* Rounded dynamic background circle wrapper for illustrations */}
        <View style={[styles.illustrationWrapper, { backgroundColor: currentData.bgCircleColor }]}>
          <Image 
            source={currentData.image} 
            style={styles.illustrationImage} 
            resizeMode="contain" 
          />
        </View>

        {/* Text Details Section */}
        <View style={styles.textDetails}>
          <Text style={styles.titleText}>{currentData.title}</Text>
          <Text style={[styles.subtitleText, { color: currentData.accentColor }]}>
            {currentData.subtitle}
          </Text>
          <View style={[styles.underline, { backgroundColor: currentData.accentColor }]} />
          <Text style={styles.descriptionText}>{currentData.description}</Text>
        </View>
      </View>

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
                    ? [styles.activeDot, { backgroundColor: currentData.accentColor }] 
                    : [styles.inactiveDot, { backgroundColor: '#cbd5e1' }]
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
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.nextButton, { backgroundColor: currentData.accentColor }]}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === ONBOARDING_DATA.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    height: 54,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2c56f6',
    marginLeft: 3,
    marginTop: 4,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  skipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  illustrationWrapper: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SCREEN_HEIGHT < 700 ? 16 : 28,
    overflow: 'hidden',
    padding: 16,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },
  textDetails: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 12,
  },
  titleText: {
    fontSize: SCREEN_HEIGHT < 700 ? 18 : 22,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: SCREEN_HEIGHT < 700 ? 12 : 13,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  underline: {
    width: 36,
    height: 3,
    borderRadius: 1.5,
    marginVertical: SCREEN_HEIGHT < 700 ? 10 : 16,
  },
  descriptionText: {
    fontSize: SCREEN_HEIGHT < 700 ? 11 : 12.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: SCREEN_HEIGHT < 700 ? 16 : 20,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: SCREEN_HEIGHT < 700 ? 16 : 24,
    height: 70,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  activeDot: {
    width: 16,
  },
  inactiveDot: {
    width: 6,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  backButtonText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  nextButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2c56f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
