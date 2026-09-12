import React from 'react';
import { StyleSheet, View } from 'react-native';
import { HeartPulse } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, vs, ms } from '@/utils/responsive';
import { BLOOD_RED_SOFT, BLOOD_RED, BLOOD_TEXT, BLOOD_TEXT_MUTED, BLOOD_RADII } from '../tokens';

interface StepPlaceholderProps {
  title: string;
  /** Optional body copy — defaults to the wizard's step wording. */
  subtitle?: string;
}

export function StepPlaceholder({ title, subtitle }: StepPlaceholderProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <HeartPulse size={ms(26)} color={BLOOD_RED} />
      </View>
      <AppText style={styles.title}>{title}</AppText>
      <AppText style={styles.subtitle}>
        {subtitle ?? 'This step is coming next. Continue to review your blood details so far.'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: BLOOD_RADII.card,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingHorizontal: hs(24),
    paddingVertical: vs(32),
    alignItems: 'center',
  },
  iconBox: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    backgroundColor: BLOOD_RED_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(14),
  },
  title: {
    fontSize: ms(14),
    fontWeight: '800',
    color: BLOOD_TEXT,
    marginBottom: vs(6),
  },
  subtitle: {
    fontSize: ms(12),
    color: BLOOD_TEXT_MUTED,
    textAlign: 'center',
    lineHeight: vs(17),
  },
});
