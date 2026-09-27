import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

interface FoodDetailTopBarProps {
  title: string;
  onBack: () => void;
  /** Optional trailing node (e.g. a diet toggle) shown at the right edge. */
  right?: React.ReactNode;
}

/**
 * Simple back + title bar for pushed Food detail screens (Dining / Order).
 * Respects the status-bar inset.
 */
const FoodDetailTopBar = memo(function FoodDetailTopBar({ title, onBack, right }: FoodDetailTopBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + vs(6) }]}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={ms(20)} color={foodTheme.textPrimary} strokeWidth={2.4} />
      </TouchableOpacity>
      <AppText style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {right ? <View style={styles.rightSlot}>{right}</View> : <View style={styles.spacer} />}
    </View>
  );
});

export default FoodDetailTopBar;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(16),
    paddingBottom: vs(8),
    backgroundColor: foodTheme.background,
  },
  backBtn: {
    width: ms(40),
    height: vs(40),
    borderRadius: ms(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    flex: 1,
    fontSize: ms(16),
    fontWeight: '700',
    color: foodTheme.textPrimary,
    textAlign: 'center',
    marginHorizontal: hs(8),
  },
  spacer: {
    width: ms(40),
  },
  rightSlot: {
    minWidth: ms(40),
    alignItems: 'flex-end',
  },
});
