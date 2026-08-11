import React, { memo } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { hs, vs, ms } from '@/utils/responsive';
import { portalSectors } from '@data/home/rails';
import { subAppIdFor } from './common';
import type { SectionProps } from './common';
import AppText from '@/components/AppText';

function ExploreSectorsSection({ onLaunchSubApp }: SectionProps) {
  return (
    <View style={styles.grid}>
      {portalSectors.map((sector) => (
        <TouchableOpacity
          key={sector.name}
          onPress={() => onLaunchSubApp(subAppIdFor(sector.app))}
          style={styles.sectorButton}
          activeOpacity={0.8}
        >
          <View style={[styles.circle, { backgroundColor: sector.themeColor + '30', borderColor: 'rgba(255,255,255,0.4)' }]}>
            <View pointerEvents="none" style={styles.imgWrap}>
              <Image source={{ uri: sector.imageUrl }} style={styles.img} />
            </View>
            <View style={styles.emojiStamp} pointerEvents="none">
              <AppText style={styles.emojiText}>{sector.emoji}</AppText>
            </View>
          </View>
          <AppText style={styles.name} numberOfLines={1}>{sector.name}</AppText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default memo(ExploreSectorsSection);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  sectorButton: {
    alignItems: 'center',
    width: '23%',
  },
  circle: {
    width: ms(52),
    height: ms(52),
    borderRadius: ms(26),
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  imgWrap: {
    width: '100%',
    height: '100%',
  },
  emojiStamp: {
    position: 'absolute',
    bottom: vs(-1),
    right: hs(-1),
    backgroundColor: 'rgba(255,255,255,0.92)',
    width: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  emojiText: {
    fontSize: ms(9),
  },
  name: {
    fontSize: ms(9),
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
    marginTop: vs(8),
    textTransform: 'uppercase',
  },
});
