import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { PharmaQuickReorderItem } from '../../../mocks/pharmaHomeFeed';
import { PHARMA_GREY, PHARMA_INK, PHARMA_TEAL } from '../../../mocks/pharmaHomeFeed';

interface QuickReorderCardProps {
  item: PharmaQuickReorderItem;
  width: number;
  onPress?: () => void;
  onAdd?: () => void;
}

const QuickReorderCard = memo(function QuickReorderCard({
  item,
  width,
  onPress,
  onAdd,
}: QuickReorderCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <AppText style={styles.name} numberOfLines={2}>
        {item.name}
      </AppText>
      <AppText style={styles.strip} numberOfLines={1}>
        {item.stripDetails}
      </AppText>
      <View style={styles.bottomRow}>
        <AppText style={styles.price}>₹{item.price}</AppText>
        <TouchableOpacity
          onPress={onAdd}
          style={styles.addBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name} to cart`}
        >
          <Plus size={ms(13)} color="#FFFFFF" strokeWidth={3} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

export default QuickReorderCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: ms(12),
    padding: ms(12),
    justifyContent: 'space-between',
  },
  name: {
    fontSize: ms(12),
    fontWeight: '700',
    color: PHARMA_INK,
    minHeight: vs(32),
  },
  strip: {
    fontSize: ms(10),
    fontWeight: '500',
    color: PHARMA_GREY,
    marginTop: vs(4),
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: vs(10),
  },
  price: {
    fontSize: ms(14),
    fontWeight: '900',
    color: PHARMA_INK,
  },
  addBtn: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(12),
    backgroundColor: PHARMA_TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
