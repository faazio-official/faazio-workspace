import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';
import DietToggle from './DietToggle';

interface DiningHeaderProps {
  onBack?: () => void;
}

/**
 * Dedicated Dining header — back chevron + centered diet toggle. Renders below
 * the status-bar inset. The toggle is uncontrolled, so it reads/writes the
 * shared `foodFilterStore` like the rest of the Food home.
 */
const DiningHeader = memo(function DiningHeader({ onBack }: DiningHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + vs(8) }]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={ms(20)} color={foodTheme.textPrimary} strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.toggleWrap}>
          <DietToggle />
        </View>

        <View style={styles.spacer} />
      </View>
    </View>
  );
});

export default DiningHeader;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: hs(16),
    paddingBottom: vs(10),
    backgroundColor: foodTheme.background,
  },
  row: {
    minHeight: vs(72),
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: ms(40),
    height: vs(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  toggleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  spacer: {
    width: ms(40),
  },
});
