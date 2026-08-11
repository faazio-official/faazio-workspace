import React, { memo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Upload } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { PHARMA_TEAL } from '../../mocks/pharmaHomeFeed';

interface UploadPrescriptionFABProps {
  onPress?: () => void;
}

const UploadPrescriptionFAB = memo(function UploadPrescriptionFAB({
  onPress,
}: UploadPrescriptionFABProps) {
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel="Upload prescription"
    >
      <Upload size={ms(18)} color="#FFFFFF" strokeWidth={2.4} />
      <AppText style={styles.text}>Upload Prescription{'\n'}Get medicines faster</AppText>
    </TouchableOpacity>
  );
});

export default UploadPrescriptionFAB;

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: vs(16),
    right: hs(16),
    backgroundColor: PHARMA_TEAL,
    borderRadius: ms(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(10),
    paddingVertical: vs(12),
    paddingHorizontal: hs(14),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 20,
  },
  text: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: ms(14),
  },
});
