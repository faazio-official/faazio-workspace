import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_DONOR_STEPS } from '@data/index';
import type { BloodDonorStep } from '@data/index';
import { BLOOD_RED, BLOOD_RED_DARK, BLOOD_BORDER, BLOOD_TEXT_MUTED } from '../tokens';

interface StepperHeaderProps {
  /** Zero-based index of the active step. */
  activeIndex: number;
}

export function StepperHeader({ activeIndex }: StepperHeaderProps) {
  const total = BLOOD_DONOR_STEPS.length;
  return (
    <View style={styles.wrap}>
      <View style={styles.connectorRow}>
        {BLOOD_DONOR_STEPS.map((step: BloodDonorStep, idx) => {
          const isDone = idx < activeIndex;
          const isActive = idx === activeIndex;
          return (
            <React.Fragment key={step.id}>
              {idx > 0 && (
                <View
                  style={[
                    styles.connector,
                    idx <= activeIndex && { backgroundColor: BLOOD_RED },
                  ]}
                />
              )}
              <View
                style={[
                  styles.circle,
                  isDone && styles.circleDone,
                  isActive && styles.circleActive,
                ]}
              >
                {isDone ? (
                  <Check size={ms(13)} color="#ffffff" strokeWidth={3} />
                ) : (
                  <AppText
                    style={[
                      styles.circleText,
                      isActive && styles.circleTextActive,
                    ]}
                  >
                    {idx + 1}
                  </AppText>
                )}
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <View style={styles.labelRow}>
        {BLOOD_DONOR_STEPS.map((step: BloodDonorStep, idx) => (
          <View
            key={step.id}
            style={[styles.labelCell, { width: `${100 / total}%` }]}
          >
            <AppText
              numberOfLines={2}
              style={[
                styles.label,
                idx <= activeIndex && { color: BLOOD_RED_DARK, fontWeight: '700' },
              ]}
            >
              {step.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: hs(16),
  },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    height: 3,
    flex: 1,
    maxWidth: hs(34),
    backgroundColor: BLOOD_BORDER,
    marginHorizontal: hs(2),
  },
  circle: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    borderWidth: 2,
    borderColor: BLOOD_BORDER,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: BLOOD_RED,
    borderColor: BLOOD_RED,
  },
  circleActive: {
    borderColor: BLOOD_RED,
  },
  circleText: {
    fontSize: ms(13),
    fontWeight: '800',
    color: BLOOD_TEXT_MUTED,
  },
  circleTextActive: {
    color: BLOOD_RED_DARK,
  },
  labelRow: {
    flexDirection: 'row',
    marginTop: vs(8),
  },
  labelCell: {
    alignItems: 'center',
    paddingHorizontal: hs(2),
  },
  label: {
    fontSize: ms(8.5),
    color: BLOOD_TEXT_MUTED,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: vs(11),
  },
});
