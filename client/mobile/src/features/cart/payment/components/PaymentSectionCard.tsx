import React from 'react';
import { StyleSheet, View } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { BRAND } from '../constants';

interface PaymentSectionCardProps {
  title: string;
  children: React.ReactNode;
}

/**
 * White rounded card container with a padded section title.
 * Child rows are rendered stacked; separators are handled by PaymentRow.
 */
export default function PaymentSectionCard({ title, children }: PaymentSectionCardProps) {
  return (
    <View style={styles.sectionWrap}>
      <AppText style={styles.title}>{title}</AppText>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    marginBottom: vs(18),
  },
  title: {
    fontSize: ms(14),
    fontWeight: '700',
    color: BRAND.section,
    marginBottom: vs(9),
    paddingHorizontal: hs(4),
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: ms(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(2),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
});
