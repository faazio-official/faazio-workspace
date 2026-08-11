import React, { memo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Clock, ShieldCheck, Percent, RotateCcw } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { PharmaFeatureChip } from '../../mocks/pharmaHomeFeed';
import { PHARMA_GREY, PHARMA_INK, PHARMA_TEAL } from '../../mocks/pharmaHomeFeed';

const ICONS: Record<PharmaFeatureChip['iconName'], typeof Clock> = {
  clock: Clock,
  shield: ShieldCheck,
  percent: Percent,
  rotate: RotateCcw,
};

interface FeatureChipsRailProps {
  badges: PharmaFeatureChip[];
}

const FeatureChipsRail = memo(function FeatureChipsRail({ badges }: FeatureChipsRailProps) {
  return (
    <View style={styles.card}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        bounces={false}
      >
        {badges.map((badge, index) => {
          const Icon = ICONS[badge.iconName];
          const isLast = index === badges.length - 1;
          return (
            <View key={badge.id} style={[styles.item, isLast && styles.itemLast]}>
              <Icon size={ms(20)} color={PHARMA_TEAL} strokeWidth={2.2} />
              <View style={styles.textWrap}>
                <AppText style={styles.title} numberOfLines={1}>
                  {badge.title}
                </AppText>
                <AppText style={styles.subtitle} numberOfLines={1}>
                  {badge.subtitle}
                </AppText>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

export default FeatureChipsRail;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: hs(16),
    marginTop: vs(12),
    borderRadius: ms(12),
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    paddingVertical: vs(12),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: hs(4),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    paddingHorizontal: hs(14),
    borderRightWidth: 1,
    borderRightColor: '#EEEEEE',
  },
  itemLast: {
    borderRightWidth: 0,
  },
  textWrap: {
    justifyContent: 'center',
    gap: vs(1),
  },
  title: {
    fontSize: ms(11),
    fontWeight: '700',
    color: PHARMA_INK,
  },
  subtitle: {
    fontSize: ms(9),
    fontWeight: '500',
    color: PHARMA_GREY,
  },
});
