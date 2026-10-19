import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { PharmaHealthCornerArticle } from '../../../mocks/pharmaHomeFeed';
import { PHARMA_GREY, PHARMA_INK, PHARMA_TEAL } from '../../../mocks/pharmaHomeFeed';
import PharmaImage from '../PharmaImage';

interface HealthCornerCardProps {
  item: PharmaHealthCornerArticle;
  width: number;
  /** When absent the card is static editorial (no "Read More" affordance, no dead tap). */
  onPress?: () => void;
}

const HealthCornerCard = memo(function HealthCornerCard({
  item,
  width,
  onPress,
}: HealthCornerCardProps) {
  const body = (
    <>
      <PharmaImage uri={item.imageUrl} style={styles.thumb} contentFit="cover" />
      <View style={styles.body}>
        <AppText style={styles.title} numberOfLines={2}>
          {item.title}
        </AppText>
        <AppText style={styles.subtitle} numberOfLines={2}>
          {item.subtitle}
        </AppText>
        {onPress ? (
          <View style={styles.readRow}>
            <AppText style={styles.readText}>Read More</AppText>
            <ChevronRight size={ms(12)} color={PHARMA_TEAL} strokeWidth={2.6} />
          </View>
        ) : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={[styles.card, { width }]}>{body}</View>;
  }
  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.9}>
      {body}
    </TouchableOpacity>
  );
});

export default HealthCornerCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    borderWidth: 1,
    borderColor: '#EFEFEF',
    flexDirection: 'row',
    padding: ms(12),
    alignItems: 'center',
  },
  thumb: {
    width: ms(72),
    height: ms(72),
    borderRadius: ms(10),
    backgroundColor: '#FAFAFA',
  },
  body: {
    flex: 1,
    marginLeft: hs(12),
  },
  title: {
    fontSize: ms(13),
    fontWeight: '800',
    color: PHARMA_INK,
  },
  subtitle: {
    fontSize: ms(10),
    fontWeight: '500',
    color: PHARMA_GREY,
    marginTop: vs(3),
  },
  readRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: vs(8),
  },
  readText: {
    fontSize: ms(11),
    fontWeight: '700',
    color: PHARMA_TEAL,
  },
});
