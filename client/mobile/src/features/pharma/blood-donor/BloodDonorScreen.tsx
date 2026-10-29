import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { ChevronLeft, ShieldCheck, Droplet } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { BLOOD_DONOR_STEPS, PRIVACY_NOTE, ASK_BLOOD_COPY } from '@data/index';
import type { RootStackParamList } from '@/navigation/types';
import { useBloodDonorStore } from '@/state/bloodDonorStore';
import { StepperHeader } from './components/StepperHeader';
import { InfoBanner } from './components/InfoBanner';
import { BloodDetailsStep } from './components/BloodDetailsStep';
import { HealthInfoStep } from './components/HealthInfoStep';
import { AvailabilityStep } from './components/AvailabilityStep';
import { NotificationsStep } from './components/NotificationsStep';
import { ReviewStep } from './components/ReviewStep';
import { StepPlaceholder } from './components/StepPlaceholder';
import { WizardFooter } from './components/WizardFooter';
import AskBloodSheet from './components/AskBloodSheet';
import { DonorDashboard } from './DonorDashboard';
import { firstIncompleteStep, isStepComplete } from './stepValidation';
import { BLOOD_BG, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_RED, BLOOD_RED_DARK, BLOOD_RADII } from './tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'BloodDonor'>;

export function BloodDonorScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const registration = useBloodDonorStore((s) => s.registration);
  const draft = useBloodDonorStore((s) => s.draft);
  const hydrated = useBloodDonorStore((s) => s.hydrated);
  const updateDraft = useBloodDonorStore((s) => s.updateDraft);
  const register = useBloodDonorStore((s) => s.register);

  const [stepIndex, setStepIndex] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const total = BLOOD_DONOR_STEPS.length;
  const step = BLOOD_DONOR_STEPS[stepIndex];
  const isLast = stepIndex === total - 1;

  // Clever resume: once the persisted draft has hydrated, re-open the wizard
  // at the first incomplete step (all complete → Review). Applied once per mount
  // so it never fights the user's own navigation.
  const resumeApplied = useRef(false);
  useEffect(() => {
    if (!hydrated || resumeApplied.current) return;
    resumeApplied.current = true;
    setStepIndex(firstIncompleteStep(draft));
  }, [hydrated, draft]);

  /** Header chevron steps back within the wizard; exits only on step 1. */
  const handleStepBack = useCallback(() => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else navigation.goBack();
  }, [navigation, stepIndex]);

  useEffect(() => {
    if (registration) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepIndex > 0) {
        setStepIndex((i) => i - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [registration, stepIndex]);

  const canProceed = isStepComplete(step.id, draft);

  const handleNext = () => {
    if (!canProceed) return;
    if (isLast) {
      void register();
      setStepIndex(0);
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const renderStep = () => {
    switch (step.id) {
      case 'blood-details':
        return <BloodDetailsStep draft={draft} onUpdate={updateDraft} />;
      case 'health-info':
        return <HealthInfoStep draft={draft} onUpdate={updateDraft} />;
      case 'availability':
        return <AvailabilityStep draft={draft} onUpdate={updateDraft} />;
      case 'notifications':
        return <NotificationsStep draft={draft} onUpdate={updateDraft} />;
      case 'review':
        return <ReviewStep draft={draft} onUpdate={updateDraft} onEdit={() => setStepIndex(0)} />;
      default:
        return <StepPlaceholder title={step.title} />;
    }
  };

  // Back-nav is handled by the header chevron + hardware back on every step,
  // so the footer stays a full-width Next throughout the wizard.
  const showFooterBack = false;

  // Registered: the dashboard is the success landing (in-route, navbar-less).
  // From the Pharma Donor tab onward it renders in-wrapper with the navbar.
  if (registration) {
    return <DonorDashboard />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleStepBack}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={ms(26)} color={BLOOD_TEXT} strokeWidth={2.2} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Blood Donor Registration</AppText>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <StepperHeader activeIndex={stepIndex} />

        <View style={styles.titleBlock}>
          <AppText style={styles.title}>{step.title}</AppText>
          <AppText style={styles.subtitle}>{step.subtitle}</AppText>
        </View>

        {step.showBanner ? <InfoBanner /> : null}

        <View style={styles.stepBody}>{renderStep()}</View>
      </ScrollView>

      <WizardFooter
        onNext={handleNext}
        onBack={showFooterBack ? () => setStepIndex((i) => i - 1) : undefined}
        canProceed={canProceed}
        isLastStep={isLast}
        nextLabel={isLast ? 'Complete Registration' : undefined}
        footerNote={
          isLast ? (
            <View style={styles.privacyNote}>
              <ShieldCheck size={ms(14)} color={BLOOD_TEXT_MUTED} strokeWidth={2.2} />
              <AppText style={styles.privacyText}>{PRIVACY_NOTE}</AppText>
            </View>
          ) : undefined
        }
      />

      {/* Ask Blood floating action — available even mid-wizard; needing blood
          doesn't require being a registered donor. Anchored above the footer. */}
      <TouchableOpacity
        onPress={() => setAskOpen(true)}
        style={styles.fab}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={ASK_BLOOD_COPY.fabLabel}
      >
        <Droplet size={ms(18)} color="#ffffff" fill="#ffffff" strokeWidth={2.2} />
        <AppText style={styles.fabText}>{ASK_BLOOD_COPY.fabLabel}</AppText>
      </TouchableOpacity>

      <AskBloodSheet visible={askOpen} onClose={() => setAskOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLOOD_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingTop: vs(10),
    paddingBottom: SPACE.BLOCK,
    backgroundColor: '#ffffff',
  },
  backButton: {
    marginRight: hs(8),
    padding: hs(2),
  },
  headerTitle: {
    fontSize: ms(17),
    fontWeight: '800',
    color: BLOOD_TEXT,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: hs(20),
    paddingTop: SPACE.SECTION,
    paddingBottom: SPACE.SECTION,
    gap: SPACE.SECTION,
  },
  titleBlock: {
    gap: vs(4),
  },
  title: {
    fontSize: ms(22),
    fontWeight: '900',
    color: BLOOD_TEXT,
  },
  subtitle: {
    fontSize: ms(13),
    color: '#64748B',
    lineHeight: vs(18),
  },
  stepBody: {
    marginTop: vs(4),
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
  },
  privacyText: {
    fontSize: ms(11),
    color: BLOOD_TEXT_MUTED,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: hs(20),
    bottom: vs(112),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(6),
    backgroundColor: BLOOD_RED,
    borderRadius: BLOOD_RADII.pill,
    paddingHorizontal: hs(16),
    paddingVertical: vs(12),
    shadowColor: BLOOD_RED_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: ms(13),
    fontWeight: '800',
    color: '#ffffff',
  },
});
