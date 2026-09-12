import React, { type ReactNode } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_RED, BLOOD_RED_DARK, BLOOD_BORDER, BLOOD_TEXT_MUTED, BLOOD_RADII } from '../tokens';

interface WizardFooterProps {
  onNext: () => void;
  onBack?: () => void;
  /** Custom CTA label — takes priority over the Submit default on the last step. */
  nextLabel?: string;
  /** Disables the primary action. */
  canProceed?: boolean;
  isLastStep?: boolean;
  /** Optional content rendered below the button row (e.g. a privacy note). */
  footerNote?: ReactNode;
}

export function WizardFooter({
  onNext,
  onBack,
  nextLabel,
  canProceed = true,
  isLastStep = false,
  footerNote,
}: WizardFooterProps) {
  const label = nextLabel ?? (isLastStep ? 'Submit' : 'Next');
  return (
    <View style={styles.footer}>
      <View style={styles.buttonRow}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <AppText style={styles.backText}>Back</AppText>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onNext}
          disabled={!canProceed}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canProceed }}
          style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
        >
          <AppText style={styles.nextText}>{label}</AppText>
          <ArrowRight size={ms(18)} color="#ffffff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      {footerNote ? <View style={styles.noteWrap}>{footerNote}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: 1,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    paddingHorizontal: hs(20),
    paddingVertical: vs(16),
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: hs(12),
  },
  backBtn: {
    height: ms(50),
    paddingHorizontal: hs(20),
    borderRadius: BLOOD_RADII.pill,
    borderWidth: 1.5,
    borderColor: BLOOD_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  backText: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BLOOD_TEXT_MUTED,
  },
  nextBtn: {
    flex: 1,
    height: ms(52),
    borderRadius: BLOOD_RADII.pill,
    backgroundColor: BLOOD_RED,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: hs(8),
  },
  nextBtnDisabled: {
    backgroundColor: BLOOD_RED_DARK,
    opacity: 0.45,
  },
  nextText: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#ffffff',
  },
  noteWrap: {
    marginTop: vs(10),
    alignItems: 'center',
  },
});
