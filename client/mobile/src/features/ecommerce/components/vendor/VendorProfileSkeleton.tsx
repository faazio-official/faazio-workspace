import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { hs, ms, vs } from '@/utils/responsive';
import { SPACE } from '@/theme/spacing';
import { BG_GRAY } from './theme';

const VendorProfileSkeleton = memo(function VendorProfileSkeleton() {
  return (
    <View style={styles.root}>
      <View style={styles.hero} />
      <View style={styles.board}>
        <View style={styles.storeRow}>
          <View style={styles.logo} />
          <View style={styles.storeText}>
            <View style={styles.lineWide} />
            <View style={styles.lineShort} />
            <View style={styles.lineShort} />
          </View>
        </View>
        <View style={styles.highlights} />
        <View style={styles.sectionTitle} />
        <View style={styles.rail}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.railCard} />
          ))}
        </View>
      </View>
    </View>
  );
});

export default VendorProfileSkeleton;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  hero: {
    height: vs(120),
    backgroundColor: '#FACC15',
    opacity: 0.5,
  },
  board: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: ms(24),
    borderTopRightRadius: ms(24),
    marginTop: vs(-24),
    paddingTop: SPACE.SECTION,
    paddingHorizontal: hs(16),
  },
  storeRow: { flexDirection: 'row', marginBottom: SPACE.SECTION },
  logo: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(12),
    backgroundColor: BG_GRAY,
    marginRight: hs(12),
  },
  storeText: { flex: 1, justifyContent: 'center', gap: vs(8) },
  lineWide: { height: vs(14), width: '70%', borderRadius: 4, backgroundColor: BG_GRAY },
  lineShort: { height: vs(10), width: '50%', borderRadius: 4, backgroundColor: BG_GRAY },
  highlights: {
    height: vs(90),
    borderRadius: ms(12),
    backgroundColor: BG_GRAY,
    marginBottom: SPACE.SECTION,
  },
  sectionTitle: {
    height: vs(16),
    width: '40%',
    borderRadius: 4,
    backgroundColor: BG_GRAY,
    marginBottom: SPACE.BLOCK,
  },
  rail: { flexDirection: 'row' },
  railCard: {
    width: ms(150),
    height: vs(180),
    borderRadius: ms(14),
    backgroundColor: BG_GRAY,
    marginRight: hs(12),
  },
});
