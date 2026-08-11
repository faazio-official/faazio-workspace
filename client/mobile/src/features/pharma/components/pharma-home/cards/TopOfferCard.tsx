import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Percent, Truck, Wallet } from 'lucide-react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import type { PharmaTopOffer } from '../../../mocks/pharmaHomeFeed';
import { PHARMA_GREY, PHARMA_INK, PHARMA_PALE, PHARMA_TEAL, PHARMA_TEAL_DARK } from '../../../mocks/pharmaHomeFeed';

interface TopOfferCardProps {
  item: PharmaTopOffer;
  width: number;
  onPress?: () => void;
}

const ICONS: Record<PharmaTopOffer['iconName'], typeof Percent> = {
  percent: Percent,
  truck: Truck,
  wallet: Wallet,
};

const TopOfferCard = memo(function TopOfferCard({ item, width, onPress }: TopOfferCardProps) {
  const Icon = ICONS[item.iconName];
  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.iconWrap}>
        <Icon size={ms(20)} color={PHARMA_TEAL_DARK} strokeWidth={2.2} />
      </View>
      <View style={styles.content}>
        <AppText style={styles.title} numberOfLines={1}>
          {item.title}
        </AppText>
        <AppText style={styles.subtitle} numberOfLines={1}>
          {item.subtitle}
        </AppText>
        <View style={styles.codePill}>
          <AppText style={styles.codeText}>Use code: {item.code}</AppText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default TopOfferCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: PHARMA_PALE,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#A9D6CF',
    borderRadius: ms(8),
    flexDirection: 'row',
    padding: ms(12),
    alignItems: 'center',
  },
  iconWrap: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: hs(10),
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: ms(13),
    fontWeight: '900',
    color: PHARMA_INK,
  },
  subtitle: {
    fontSize: ms(9.5),
    fontWeight: '500',
    color: PHARMA_GREY,
    marginTop: vs(2),
  },
  codePill: {
    alignSelf: 'flex-start',
    backgroundColor: PHARMA_TEAL,
    borderRadius: ms(5),
    paddingHorizontal: hs(7),
    paddingVertical: vs(2),
    marginTop: vs(6),
  },
  codeText: {
    fontSize: ms(8.5),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
