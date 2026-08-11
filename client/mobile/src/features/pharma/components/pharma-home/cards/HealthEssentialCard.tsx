import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { ms, vs } from '@/utils/responsive';
import type { PharmaHealthEssential } from '../../../mocks/pharmaHomeFeed';
import { PHARMA_INK } from '../../../mocks/pharmaHomeFeed';
import PharmaImage from '../PharmaImage';

interface HealthEssentialCardProps {
  item: PharmaHealthEssential;
  width: number;
  onPress?: () => void;
}

const HealthEssentialCard = memo(function HealthEssentialCard({
  item,
  width,
  onPress,
}: HealthEssentialCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.imageWrap}>
        <PharmaImage uri={item.imageUrl} style={styles.image} contentFit="cover" />
      </View>
      <AppText style={styles.title} numberOfLines={2}>
        {item.title}
      </AppText>
    </TouchableOpacity>
  );
});

export default HealthEssentialCard;

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F1F5F5',
    borderRadius: ms(12),
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: ms(10.5),
    fontWeight: '700',
    color: PHARMA_INK,
    textAlign: 'center',
    marginTop: vs(6),
  },
});
