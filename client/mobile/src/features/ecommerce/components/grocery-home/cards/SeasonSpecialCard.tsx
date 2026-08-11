import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import AppText from '@/components/AppText';
import { ms, vs } from '@/utils/responsive';
import type { GrocerySeasonSpecial } from '../../../mocks/groceryHomeFeed';
import { GROCERY_GREY, GROCERY_GREEN_DARK, GROCERY_INK } from '../../../mocks/groceryHomeFeed';
import GroceryImage from '../GroceryImage';

interface SeasonSpecialCardProps {
  item: GrocerySeasonSpecial;
  width: number;
  onPress?: () => void;
}

const SeasonSpecialCard = memo(function SeasonSpecialCard({
  item,
  width,
  onPress,
}: SeasonSpecialCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { width, backgroundColor: item.bgHex }]}
      onPress={onPress}
      activeOpacity={0.94}
    >
      <View style={styles.body}>
        <AppText style={styles.title} numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText style={styles.subtitle} numberOfLines={1}>
          {item.subtitle}
        </AppText>
        <View style={styles.btn}>
          <AppText style={styles.btnText}>{item.btnText} →</AppText>
        </View>
      </View>
      <GroceryImage uri={item.imageUrl} style={styles.image} />
    </TouchableOpacity>
  );
});

export default SeasonSpecialCard;

const styles = StyleSheet.create({
  card: {
    height: vs(120),
    borderRadius: ms(12),
    flexDirection: 'row',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    padding: ms(12),
    justifyContent: 'center',
    gap: vs(4),
  },
  title: {
    fontSize: ms(14),
    fontWeight: '800',
    color: GROCERY_INK,
  },
  subtitle: {
    fontSize: ms(10),
    fontWeight: '500',
    color: GROCERY_GREY,
  },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: ms(12),
    paddingHorizontal: ms(10),
    paddingVertical: vs(5),
    marginTop: vs(4),
  },
  btnText: {
    fontSize: ms(9),
    fontWeight: '700',
    color: GROCERY_GREEN_DARK,
  },
  image: {
    width: ms(108),
    height: '100%',
  },
});
