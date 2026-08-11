import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { MealCombo } from '../../mocks/orderFeed';
import RemoteImage from '../RemoteImage';

const CARD_W = 220;

interface MealsComboRailProps {
  combos: MealCombo[];
  onPress?: (combo: MealCombo) => void;
}

/**
 * Section 7 — "Meals & Combos" horizontal rail. Slightly wider rectangular
 * cards: landscape image on top (rounded), title + "From ₹X" subtext below.
 */
const MealsComboRail = memo(function MealsComboRail({ combos, onPress }: MealsComboRailProps) {
  const renderItem = useCallback(
    ({ item }: { item: MealCombo }) => (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPress?.(item)}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, from ₹${item.startingPrice}`}
      >
        <RemoteImage uri={item.image} variant="restaurant" style={styles.image} />
        <View style={styles.body}>
          <AppText style={styles.name} numberOfLines={1}>
            {item.name}
          </AppText>
          <AppText style={styles.subtext}>From ₹{item.startingPrice}</AppText>
        </View>
      </TouchableOpacity>
    ),
    [onPress],
  );

  return (
    <View style={styles.wrap}>
      <FlashList
        data={combos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      />
    </View>
  );
});

export default MealsComboRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
  },
  card: {
    width: CARD_W,
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginRight: hs(12),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  image: {
    width: '100%',
    height: vs(110),
    backgroundColor: '#F5F5F5',
  },
  body: {
    paddingHorizontal: hs(10),
    paddingVertical: vs(8),
  },
  name: {
    fontSize: ms(13),
    fontWeight: '700',
    color: '#1E2022',
  },
  subtext: {
    fontSize: ms(11),
    fontWeight: '400',
    color: '#666666',
    marginTop: vs(2),
  },
});
