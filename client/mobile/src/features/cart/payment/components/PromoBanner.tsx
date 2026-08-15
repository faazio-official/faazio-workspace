import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Wallet } from 'lucide-react-native';
import { hs, vs, ms } from '@/utils/responsive';
import AppText from '@/components/AppText';
import { PROMO } from '../paymentData';

/**
 * Full-width (minus padding) orange gradient promo banner with a right-aligned
 * wallet icon. Radius 8.
 */
export default function PromoBanner() {
  return (
    <LinearGradient
      colors={['#FF8A1F', '#FF6B1A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.banner}
    >
      <View style={styles.textWrap}>
        <AppText style={styles.title}>{PROMO.title}</AppText>
        <AppText style={styles.body}>{PROMO.body}</AppText>
        <AppText style={styles.sub}>{PROMO.sub}</AppText>
      </View>
      <View style={styles.iconWrap}>
        <Wallet size={ms(30)} color="#ffffff" strokeWidth={1.8} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ms(8),
    paddingVertical: vs(14),
    paddingHorizontal: hs(16),
    marginHorizontal: hs(16),
    marginTop: vs(18),
    marginBottom: vs(20),
  },
  textWrap: {
    flex: 1,
    marginRight: hs(12),
  },
  title: {
    fontSize: ms(15),
    fontWeight: '800',
    color: '#ffffff',
  },
  body: {
    fontSize: ms(11),
    color: 'rgba(255,255,255,0.92)',
    marginTop: vs(3),
    lineHeight: ms(15),
  },
  sub: {
    fontSize: ms(10),
    color: 'rgba(255,255,255,0.78)',
    marginTop: vs(4),
  },
  iconWrap: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
