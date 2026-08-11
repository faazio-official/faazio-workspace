import React, { memo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { FileText } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { PharmaQuickReorderItem } from '../../mocks/pharmaHomeFeed';
import { PHARMA_PALE, PHARMA_TEAL, PHARMA_TEAL_DARK } from '../../mocks/pharmaHomeFeed';
import PharmaSectionHeader from './PharmaSectionHeader';
import QuickReorderCard from './cards/QuickReorderCard';

const CARD_W = hs(140);
const INTRO_W = hs(150);
const CARD_H = vs(116);

interface QuickReorderRailProps {
  items: PharmaQuickReorderItem[];
  onPress?: (item: PharmaQuickReorderItem) => void;
  onAdd?: (item: PharmaQuickReorderItem) => void;
  onViewAll?: () => void;
}

const QuickReorderRail = memo(function QuickReorderRail({
  items,
  onPress,
  onAdd,
  onViewAll,
}: QuickReorderRailProps) {
  return (
    <View style={styles.wrap}>
      <PharmaSectionHeader title="Quick Reorder" onViewAll={onViewAll} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        <View style={[styles.introBox, { width: INTRO_W, height: CARD_H }]}>
          <View style={styles.introIconWrap}>
            <FileText size={ms(22)} color={PHARMA_TEAL} strokeWidth={2.2} />
          </View>
          <AppText style={styles.introText}>
            Your health essentials,{'\n'}delivered again
          </AppText>
        </View>
        {items.map((item) => (
          <View key={item.id} style={styles.cardGap}>
            <QuickReorderCard
              item={item}
              width={CARD_W}
              onPress={() => onPress?.(item)}
              onAdd={() => onAdd?.(item)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

export default QuickReorderRail;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: vs(8),
  },
  content: {
    paddingHorizontal: hs(16),
  },
  cardGap: {
    marginLeft: hs(10),
  },
  introBox: {
    backgroundColor: PHARMA_PALE,
    borderRadius: ms(12),
    padding: ms(14),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  introIconWrap: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: vs(8),
  },
  introText: {
    fontSize: ms(12),
    fontWeight: '800',
    color: PHARMA_TEAL_DARK,
    lineHeight: ms(17),
  },
});
