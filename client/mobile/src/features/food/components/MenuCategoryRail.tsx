import React, { memo } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import AppText from '@/components/AppText';
import { hs, ms, vs } from '@/utils/responsive';
import { foodTheme } from '../constants/theme';

interface MenuCategoryRailProps {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
  /** Extra box styles for the rail — e.g. vertical padding (menu) or marginBottom (profile). */
  style?: StyleProp<ViewStyle>;
  /** Extra styles for the content container. */
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Shared category pill rail for the restaurant profile and full-menu pages.
 *
 * Layout contract: the rail is a **fixed, non-flexing** sibling. React Native
 * injects `flexGrow: 1, flexShrink: 1` into every ScrollView; in the full menu
 * that let the tall vertical list squeeze the ~50px rail down to a clipped
 * sliver (each glyph half-cut). Pinning `flexGrow: 0, flexShrink: 0` makes the
 * rail's height purely padding + chip, so the vertical list's `flex: 1` owns the
 * leftover space. Do not drop these two styles.
 */
const MenuCategoryRail = memo(function MenuCategoryRail({
  categories,
  active,
  onSelect,
  style,
  contentContainerStyle,
}: MenuCategoryRailProps) {
  return (
    <ScrollView
      style={[styles.rail, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {categories.map((cat) => {
        const isActive = active === cat;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            style={[styles.chip, isActive && styles.activeChip]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <AppText style={[styles.text, isActive && styles.activeText]}>{cat}</AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

export default MenuCategoryRail;

const styles = StyleSheet.create({
  rail: {
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    paddingHorizontal: hs(16),
    gap: hs(12),
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: hs(16),
    paddingVertical: vs(8),
    borderRadius: ms(20),
    minHeight: vs(36),
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeChip: {
    backgroundColor: foodTheme.primarySoft,
    borderColor: foodTheme.primary,
  },
  text: { fontSize: ms(14), color: foodTheme.textSecondary, fontWeight: '500' },
  activeText: { color: foodTheme.primary, fontWeight: 'bold' },
});
