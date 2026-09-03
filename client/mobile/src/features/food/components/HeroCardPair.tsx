import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import { DINING_BANNER, ORDER_FOOD_BANNER } from '../constants/assets';

interface HeroCardConfig {
  id: string;
  title: string;
  subtitle: string;
  image: any;
  onPress?: () => void;
}

interface HeroCardPairProps {
  onDiningPress?: () => void;
  onOrderFoodPress?: () => void;
}

/**
 * Section 2 — hero cards replacing the old mode toggle. Two image-backed
 * cards (~48% width each): "Dining" and "Order Food". White circular arrow
 * button bottom-left. No delivery-time badges. Uses expo-image so the local
 * AVIF banners decode correctly.
 */
const HeroCardPair = memo(function HeroCardPair({
  onDiningPress,
  onOrderFoodPress,
}: HeroCardPairProps) {
  const cards: HeroCardConfig[] = [
    {
      id: 'dining',
      title: 'Dining',
      subtitle: 'Book a table and enjoy your meal',
      image: DINING_BANNER,
      onPress: onDiningPress,
    },
    {
      id: 'order-food',
      title: 'Order Food',
      subtitle: 'Order food & get it delivered fast',
      image: ORDER_FOOD_BANNER,
      onPress: onOrderFoodPress,
    },
  ];

  return (
    <View style={styles.row}>
      {cards.map((card) => (
        <HeroCard key={card.id} card={card} />
      ))}
    </View>
  );
});

const HeroCard = memo(function HeroCard({ card }: { card: HeroCardConfig }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={card.onPress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.subtitle}`}
    >
      <ExpoImage source={card.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.62)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <AppText style={styles.title}>{card.title}</AppText>
        <AppText style={styles.subtitle} numberOfLines={2}>
          {card.subtitle}
        </AppText>
        <View style={styles.arrowBtn}>
          <ArrowRight size={ms(18)} color={foodTheme.primary} strokeWidth={2.6} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default HeroCardPair;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: hs(12),
    paddingHorizontal: hs(16),
    paddingVertical: vs(8),
  },
  card: {
    flex: 1,
    height: vs(168),
    borderRadius: ms(18),
    overflow: 'hidden',
    backgroundColor: foodTheme.card,
    ...foodTheme.shadowCard,
  },
  content: {
    position: 'absolute',
    left: hs(12),
    right: hs(12),
    bottom: vs(12),
    gap: vs(3),
  },
  title: {
    fontSize: ms(21),
    fontWeight: '800',
    color: foodTheme.white,
  },
  subtitle: {
    fontSize: ms(10.5),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.88)',
    lineHeight: ms(13),
  },
  arrowBtn: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(18),
    backgroundColor: foodTheme.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(6),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
});
