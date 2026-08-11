import React, { memo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ms } from '@/utils/responsive';
import type { PharmaFeaturedBrand } from '../../../mocks/pharmaHomeFeed';
import PharmaImage from '../PharmaImage';

interface FeaturedBrandCardProps {
  item: PharmaFeaturedBrand;
  width: number;
  onPress?: () => void;
}

const FeaturedBrandCard = memo(function FeaturedBrandCard({
  item,
  width,
  onPress,
}: FeaturedBrandCardProps) {
  return (
    <TouchableOpacity
      style={[styles.circle, { width }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <PharmaImage uri={item.logoUrl} style={styles.logo} contentFit="contain" />
    </TouchableOpacity>
  );
});

export default FeaturedBrandCard;

const styles = StyleSheet.create({
  circle: {
    aspectRatio: 1,
    borderRadius: ms(999),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: ms(14),
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
});
